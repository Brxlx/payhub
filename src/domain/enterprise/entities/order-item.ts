import { BaseEntity } from '@/core/entities/base-entity';
import { ID } from '@/core/entities/id';

import { OrderItemError } from './errors/order-item.error';
import { Money } from './value-objects/money.vo';

export interface OrderItemProps {
  orderId: ID;
  productId: ID;
  quantity: number;
  unitPrice: Money;
}

/**
 * Entidade filha do agregado `Order`. Não possui ciclo de vida próprio fora
 * de um pedido — por isso não é um Aggregate Root e nunca deve ser
 * persistida ou buscada isoladamente (sempre através do repositório de
 * `Order`, ver README seção 6.3).
 */
export class OrderItem extends BaseEntity<OrderItemProps> {
  get orderId() {
    return this.props.orderId;
  }

  get productId() {
    return this.props.productId;
  }

  get quantity() {
    return this.props.quantity;
  }

  get unitPrice() {
    return this.props.unitPrice;
  }

  get subtotal(): Money {
    return this.props.unitPrice.multiply(this.props.quantity);
  }

  public changeQuantity(quantity: number): void {
    OrderItem.assertValidQuantity(quantity);

    this.props.quantity = quantity;
  }

  private static assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderItemError('Quantity must be a positive integer');
    }
  }

  static create(props: OrderItemProps, id?: ID) {
    OrderItem.assertValidQuantity(props.quantity);

    return new OrderItem(props, id);
  }
}
