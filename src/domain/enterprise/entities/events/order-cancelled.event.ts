import { ID } from '@/core/entities/id';
import { DomainEvent } from '@/domain/application/shared/events/domain-event';

import { OrderStatusValue } from '../value-objects/order-status.vo';

/**
 * Disparado quando um pedido é cancelado (`Order.cancel()`), venha de
 * `DRAFT` ou de `PLACED`. Consumidor típico: módulo de notificações
 * (avisar o cliente) — ver README, seção 8.1 (routing key
 * `order.cancelled`, queue `notifications.order-cancelled`).
 *
 * `cancelledFrom` carrega o status anterior à transição: é relevante para
 * decidir se algo mais precisa reagir além da notificação — por exemplo,
 * um cancelamento vindo de `PLACED` pode ter que estornar uma cobrança já
 * iniciada, enquanto um vindo de `DRAFT` nunca chegou a gerar cobrança.
 */
export class OrderCancelledEvent implements DomainEvent {
  public ocurredAt: Date;
  public orderId: ID;
  public customerId: ID;
  public cancelledFrom: OrderStatusValue;

  constructor(orderId: ID, customerId: ID, cancelledFrom: OrderStatusValue) {
    this.orderId = orderId;
    this.customerId = customerId;
    this.cancelledFrom = cancelledFrom;
    this.ocurredAt = new Date();
  }

  getAggregateId(): ID {
    return this.orderId;
  }
}
