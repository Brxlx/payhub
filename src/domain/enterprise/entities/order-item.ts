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

  /**
   * Altera a quantidade do item. **Nunca deve ser chamado diretamente** por
   * código fora do agregado `Order` — isso contornaria o guard
   * `assertIsDraft` que protege a invariante "itens só mudam enquanto o
   * pedido é DRAFT". TypeScript não tem como impedir essa chamada em tempo
   * de compilação aqui (não há acesso "package-private" entre classes
   * irmãs); use sempre `Order.changeItemQuantity(itemId, quantity)`.
   */
  public changeQuantity(quantity: number): void {
    OrderItem.assertValidQuantity(quantity);

    this.props.quantity = quantity;
  }

  private static assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderItemError('Quantity must be a positive integer');
    }
  }

  /**
   * Garante que `productId` é um `ID` válido (cuid2). Diferente de
   * `quantity`, não há como alterar o `productId` de um item já criado —
   * por isso essa checagem só acontece em `create`, nunca em um setter.
   */
  private static assertValidProductId(productId: ID): void {
    if (!productId.isValid()) {
      throw new OrderItemError('Invalid productId');
    }
  }

  static create(props: OrderItemProps, id?: ID) {
    OrderItem.assertValidProductId(props.productId);
    OrderItem.assertValidQuantity(props.quantity);

    return new OrderItem(props, id);
  }
}
