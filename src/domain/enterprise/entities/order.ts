import { AggregateRoot } from '@/core/entities/aggregate-root';
import { ID } from '@/core/entities/id';
import { Optional } from '@/core/types/optional';

import { OrderError } from './errors/order.error';
import { OrderPlacedEvent } from './events/order-placed.event';
import { OrderItem } from './order-item';
import { Money } from './value-objects/money.vo';
import { OrderStatus } from './value-objects/order-status.vo';

export interface OrderProps {
  customerId: ID;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

/**
 * Aggregate Root do contexto de pedidos. É a fronteira de consistência
 * transacional: toda alteração em `items` ou `status` passa por aqui, nunca
 * diretamente pelas entidades/VOs internas (ver README, seções 5.1 e 5.3).
 */
export class Order extends AggregateRoot<OrderProps> {
  get customerId() {
    return this.props.customerId;
  }

  get status() {
    return this.props.status;
  }

  get items(): readonly OrderItem[] {
    return this.props.items;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  /** `true` quando o pedido já passou por soft delete (ver `delete()`). */
  get isDeleted(): boolean {
    return this.props.deletedAt != null;
  }

  /** Soma dos subtotais de todos os itens. Sempre derivado, nunca armazenado. */
  get total(): Money {
    return this.props.items.reduce((total, item) => total.add(item.subtotal), Money.zero());
  }

  /**
   * Adiciona um item ao pedido. Só é permitido enquanto o pedido estiver
   * em rascunho (`DRAFT`) — um pedido já confirmado é imutável em seus itens.
   */
  public addItem(item: OrderItem): void {
    this.assertIsDraft('add items to');

    this.props.items.push(item);
    this.touch();
  }

  /**
   * Remove um item do pedido pelo seu id. Mesma restrição de `addItem`, mais
   * uma: nunca pode deixar o pedido sem itens — para isso, cancele o pedido.
   */
  public removeItem(itemId: ID): void {
    this.assertIsDraft('remove items from');

    const remaining = this.props.items.filter((item) => !item.id.equals(itemId));

    if (remaining.length === 0) {
      throw new OrderError('Cannot remove the last item of an order — cancel the order instead');
    }

    this.props.items = remaining;
    this.touch();
  }

  /**
   * Confirma o pedido: `DRAFT` → `PLACED`. Exige ao menos um item e dispara
   * `OrderPlacedEvent`, que só é efetivamente publicado após o repositório
   * persistir o agregado (ver README, seção 5.3 e 8.3 — Transactional Outbox).
   */
  public place(): void {
    if (this.props.items.length === 0) {
      throw new OrderError('Cannot place an order without items');
    }

    this.props.status = this.props.status.transitionTo('PLACED');
    this.touch();

    this.addDomainEvent(new OrderPlacedEvent(this.id, this.props.customerId, this.total));
  }

  /** Cancela o pedido, seja ele um rascunho ou já confirmado. */
  public cancel(): void {
    this.props.status = this.props.status.transitionTo('CANCELLED');
    this.touch();
  }

  /**
   * Soft delete: o pedido nunca é fisicamente removido (ver README, seção
   * 6.2 — coluna `deleted_at`). Só pode ser aplicado a pedidos que ainda não
   * produziram efeitos colaterais confirmados: `DRAFT` (nunca confirmado) ou
   * `CANCELLED` (já terminal). Um pedido `PLACED` precisa ser cancelado
   * antes. A remoção definitiva de pedidos já deletados há muito tempo é
   * responsabilidade de uma rotina de purge futura, não deste método.
   */
  public delete(): void {
    if (this.isDeleted) {
      throw new OrderError('Order is already deleted');
    }

    if (!this.props.status.is('DRAFT') && !this.props.status.is('CANCELLED')) {
      throw new OrderError(
        // eslint-disable-next-line max-len
        `Cannot delete an order that is not a draft or cancelled (current status: ${this.props.status.current})`,
      );
    }

    this.props.deletedAt = new Date();
    this.touch();
  }

  private assertIsDraft(action: string): void {
    if (!this.props.status.is('DRAFT')) {
      throw new OrderError(
        `Cannot ${action} an order that is not a draft (current status: ${this.props.status.current})`,
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  static create(props: Optional<OrderProps, 'createdAt' | 'status'>, id?: ID) {
    if (props.items.length === 0) {
      throw new OrderError('Cannot create an order without at least one item');
    }

    return new Order(
      {
        ...props,
        status: props.status ?? OrderStatus.draft(),
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );
  }
}
