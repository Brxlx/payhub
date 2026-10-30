/* eslint-disable @typescript-eslint/require-await */
import {
  FindManyOrdersParams,
  FindManyOrdersResult,
  OrdersRepository,
} from '@/domain/application/Order/repositories/orders.repository';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { Order } from '@/domain/enterprise/entities/order';

/**
 * Double de `OrdersRepository` para uso em testes (unitários de use-case,
 * por exemplo), sem tocar em banco de dados real. Mantém os agregados em
 * memória, indexados pelo próprio id — evita varredura linear (`find`) a
 * cada lookup, igual uma tabela indexada por chave primária faria.
 */
export class InMemoryOrdersRepository implements OrdersRepository {
  public items = new Map<string, Order>();

  async create(order: Order): Promise<void> {
    this.items.set(order.id.toValue(), order);

    // Simula o que a implementação real (Drizzle) deve fazer após o commit
    // da transação: disparar os domain events marcados pelo agregado — ver
    // TODO em `MakeOrderUseCase.persistOrder`.
    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async findById(id: string): Promise<Order | null> {
    return this.items.get(id) ?? null;
  }

  async findManyWithFilters({ pagination }: FindManyOrdersParams): Promise<FindManyOrdersResult> {
    const all = Array.from(this.items.values());
    const total = all.length;

    const start = (pagination.page - 1) * pagination.itemsPerPage;
    const orders = all.slice(start, start + pagination.itemsPerPage);
    const hasMore = start + orders.length < total;

    return { orders, total, hasMore };
  }

  async update(order: Order): Promise<void> {
    if (!this.items.has(order.id.toValue())) {
      return;
    }

    this.items.set(order.id.toValue(), order);

    DomainEvents.dispatchEventsForAggregate(order.id);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
