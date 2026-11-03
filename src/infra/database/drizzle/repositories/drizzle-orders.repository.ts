import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import {
  FindManyOrdersParams,
  FindManyOrdersResult,
  OrdersRepository,
} from '@/domain/application/Order/repositories/orders.repository';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { Order } from '@/domain/enterprise/entities/order';

import { DrizzleService } from '../drizzle.service';
import { OrderMapper } from '../mappers/order.mapper';
import { orders } from '../schemas/order.schema';
import { orderItems } from '../schemas/order-item.schema';

@Injectable()
export class DrizzleOrdersRepository implements OrdersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(order: Order): Promise<void> {
    const { order: orderRow, items } = OrderMapper.toPersistence(order);

    await this.drizzle.transaction(async (tx) => {
      await tx.insert(orders).values(orderRow);
      await tx.insert(orderItems).values(items);

      // TODO: inserir na tabela `outbox_events` (ainda não existe) nesta
      // mesma transação, antes de publicar — ver README seção 8.3.
    });

    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async findById(id: string): Promise<Order | null> {
    const [orderRow] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .limit(1);

    if (!orderRow) return null;

    const itemRows = await this.drizzle.db.select().from(orderItems).where(eq(orderItems.orderId, id));

    return OrderMapper.toDomain(orderRow, itemRows);
  }

  async findManyWithFilters({ pagination }: FindManyOrdersParams): Promise<FindManyOrdersResult> {
    const { page, itemsPerPage } = pagination;
    const offset = (page - 1) * itemsPerPage;

    const [orderRows, [{ total }]] = await Promise.all([
      this.drizzle.db
        .select()
        .from(orders)
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.createdAt))
        .limit(itemsPerPage)
        .offset(offset),
      this.drizzle.db.select({ total: count() }).from(orders).where(isNull(orders.deletedAt)),
    ]);

    if (orderRows.length === 0) {
      return { orders: [], total, hasMore: false };
    }

    const orderIds = orderRows.map((row) => row.id);

    const itemRows = await this.drizzle.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrderId = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const existing = itemsByOrderId.get(item.orderId) ?? [];
      existing.push(item);
      itemsByOrderId.set(item.orderId, existing);
    }

    const resultOrders = orderRows.map((row) => OrderMapper.toDomain(row, itemsByOrderId.get(row.id) ?? []));

    return {
      orders: resultOrders,
      total,
      hasMore: offset + resultOrders.length < total,
    };
  }

  async update(order: Order): Promise<void> {
    const { order: orderRow, items } = OrderMapper.toPersistence(order);
    const { id, ...orderValues } = orderRow;

    await this.drizzle.transaction(async (tx) => {
      // Atualiza a order em si
      await tx.update(orders).set(orderValues).where(eq(orders.id, id));

      // Primeiro, removemos todos os itens da order
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));

      // agora, inserimos os novos itens criando do zero todos eles
      if (items.length > 0) {
        await tx.insert(orderItems).values(items);
      }
    });

    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async delete(id: string): Promise<void> {
    // Remoção física — order_items cai via onDelete: 'cascade'. Reservado
    // para a rotina de purge futura (ver OrdersRepository.delete).
    await this.drizzle.db.delete(orders).where(eq(orders.id, id));
  }
}
