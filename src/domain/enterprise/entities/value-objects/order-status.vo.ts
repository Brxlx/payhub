import { OrderStatusError } from './errors/order-status.error';

export type OrderStatusValue = 'DRAFT' | 'PLACED' | 'CANCELLED';

/**
 * Única fonte da verdade sobre quais transições de status são válidas.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  DRAFT: ['PLACED', 'CANCELLED'],
  PLACED: ['CANCELLED'],
  CANCELLED: [],
};

/**
 * Value Object que encapsula o ciclo de vida do status de um pedido.
 * Imutável: toda transição retorna uma nova instância em vez de mutar a
 * existente, e transições inválidas lançam `OrderStatusError`.
 */
export class OrderStatus {
  private constructor(private readonly value: OrderStatusValue) {}

  static draft(): OrderStatus {
    return new OrderStatus('DRAFT');
  }

  static create(value: OrderStatusValue): OrderStatus {
    return new OrderStatus(value);
  }

  get current(): OrderStatusValue {
    return this.value;
  }

  public is(value: OrderStatusValue): boolean {
    return this.value === value;
  }

  public canTransitionTo(next: OrderStatusValue): boolean {
    return ORDER_STATUS_TRANSITIONS[this.value].includes(next);
  }

  public transitionTo(next: OrderStatusValue): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new OrderStatusError(`Cannot transition order status from "${this.value}" to "${next}"`);
    }

    return new OrderStatus(next);
  }

  public equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }
}
