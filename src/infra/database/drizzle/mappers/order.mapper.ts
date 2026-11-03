import { ID } from '@/core/entities/id';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { Currency, Money } from '@/domain/enterprise/entities/value-objects/money.vo';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

import { orders } from '../schemas/order.schema';
import { orderItems } from '../schemas/order-item.schema';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type OrderInsert = typeof orders.$inferInsert;
type OrderItemInsert = typeof orderItems.$inferInsert;

/**
 * Isola o shape relacional (tabelas `orders`/`order_items`) do shape do
 * agregado `Order` (ver README, seção 6.3). Não existe um `restore()`
 * separado no domínio: `Order.create`/`OrderItem.create` servem tanto para
 * criar quanto para hidratar a partir do banco, desde que recebam todos os
 * campos persistidos (incluindo `status`, `placedAt`, `deletedAt` já
 * resolvidos).
 */
export class OrderMapper {
  static toDomain(orderRow: OrderRow, itemRows: OrderItemRow[]): Order {
    const items = itemRows.map((row) =>
      OrderItem.create(
        {
          orderId: new ID(row.orderId),
          productId: new ID(row.productId),
          quantity: row.quantity,
          unitPrice: Money.fromCents(row.unitPriceCents, row.unitPriceCurrency as Currency),
        },
        new ID(row.id),
      ),
    );

    return Order.create(
      {
        customerId: new ID(orderRow.customerId),
        status: OrderStatus.create(orderRow.status),
        items,
        createdAt: orderRow.createdAt,
        updatedAt: orderRow.updatedAt,
        deletedAt: orderRow.deletedAt,
        placedAt: orderRow.placedAt,
      },
      new ID(orderRow.id),
    );
  }

  static toPersistence(order: Order): { order: OrderInsert; items: OrderItemInsert[] } {
    return {
      order: {
        id: order.id.toValue(),
        customerId: order.customerId.toValue(),
        status: order.status.current,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt ?? null,
        placedAt: order.placedAt ?? null,
        deletedAt: order.deletedAt ?? null,
      },
      items: order.items.map((item) => ({
        id: item.id.toValue(),
        orderId: order.id.toValue(),
        productId: item.productId.toValue(),
        quantity: item.quantity,
        unitPriceCents: item.unitPrice.amountInCents,
        unitPriceCurrency: item.unitPrice.currencyCode,
      })),
    };
  }
}
