import { ID } from '@/core/entities/id';
import { DomainEvent } from '@/domain/application/shared/events/domain-event';

import { Money } from '../value-objects/money.vo';

/**
 * Disparado quando um pedido em rascunho (`DRAFT`) é confirmado
 * (`Order.place()`). Consumidores típicos: módulo de pagamentos (iniciar
 * cobrança) e módulo de notificações (avisar o cliente) — ver README,
 * seção 8.
 */
export class OrderPlacedEvent implements DomainEvent {
  public ocurredAt: Date;
  public orderId: ID;
  public customerId: ID;
  public total: Money;

  constructor(orderId: ID, customerId: ID, total: Money) {
    this.orderId = orderId;
    this.customerId = customerId;
    this.total = total;
    this.ocurredAt = new Date();
  }

  getAggregateId(): ID {
    return this.orderId;
  }
}
