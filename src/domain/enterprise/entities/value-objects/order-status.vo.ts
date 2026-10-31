import { ValueObject } from '@/core/entities/value-object';

import { OrderStatusError } from './errors/order-status.error';

export type OrderStatusValue = 'DRAFT' | 'PLACED' | 'CANCELLED';

interface OrderStatusProps {
  value: OrderStatusValue;
}

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
export class OrderStatus extends ValueObject<OrderStatusProps> {
  private constructor(props: OrderStatusProps) {
    super(props);
  }

  static draft(): OrderStatus {
    return new OrderStatus({ value: 'DRAFT' });
  }

  static create(value: OrderStatusValue): OrderStatus {
    return new OrderStatus({ value });
  }

  get current(): OrderStatusValue {
    return this.props.value;
  }

  public is(value: OrderStatusValue): boolean {
    return this.props.value === value;
  }

  public canTransitionTo(next: OrderStatusValue): boolean {
    return ORDER_STATUS_TRANSITIONS[this.props.value].includes(next);
  }

  public transitionTo(next: OrderStatusValue): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new OrderStatusError(`Cannot transition order status from "${this.props.value}" to "${next}"`);
    }

    return new OrderStatus({ value: next });
  }

  public equals(other: OrderStatus): boolean {
    return this.props.value === other.props.value;
  }
}
