import { ORDERS_EXCHANGE } from '@/core/consts/messaging.consts';
import { ID } from '@/core/entities/id';
import { Either, left, right } from '@/core/types/either';
import { publishDomainEvents } from '@/domain/application/shared/events/publish-domain-events';
import { Logger } from '@/domain/application/shared/gateways/logger';
import { Queue } from '@/domain/application/shared/gateways/queue';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { OrderItemError } from '@/domain/enterprise/entities/errors/order-item.error';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { MoneyError } from '@/domain/enterprise/entities/value-objects/errors/money.error';
import { Money } from '@/domain/enterprise/entities/value-objects/money.vo';

import { OrdersRepository } from '../repositories/orders.repository';

interface MakeOrderUseCaseRequestItem {
  productId: string;
  quantity: number;
  unitPriceInCents: number;
}

interface MakeOrderUseCaseRequest {
  customerId: string;
  items: MakeOrderUseCaseRequestItem[];
}

type MakeOrderUseCaseResponse = Either<OrderError, { order: Order }>;

/**
 * PayHub não se comporta como carrinho: o pedido chega completo em uma
 * única chamada, então criar e confirmar (`place()`) acontecem juntos aqui
 * — não existe um estado "rascunho salvo" intermediário na API.
 */
export class MakeOrderUseCase {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly queue: Queue,
    private readonly logger: Logger,
  ) {}

  async execute({ customerId, items }: MakeOrderUseCaseRequest): Promise<MakeOrderUseCaseResponse> {
    const customerIdOrError = this.validateCustomerId(customerId);

    if (customerIdOrError.isLeft()) {
      return left(customerIdOrError.value);
    }

    const itemsValidation = this.validateItems(items);

    if (itemsValidation.isLeft()) {
      return left(itemsValidation.value);
    }

    const orderOrError = this.buildOrder(customerIdOrError.value, items);

    if (orderOrError.isLeft()) {
      return left(orderOrError.value);
    }

    const order = orderOrError.value;

    await this.persistOrder(order);

    return right({ order });
  }

  private validateCustomerId(customerId: string): Either<OrderError, ID> {
    const customerIdVo = new ID(customerId);

    if (!customerIdVo.isValid()) {
      return left(new OrderError('Invalid customerId'));
    }

    return right(customerIdVo);
  }

  private validateItems(items: MakeOrderUseCaseRequestItem[]): Either<OrderError, void> {
    if (items.length === 0) {
      return left(new OrderError('Cannot create an order without at least one item'));
    }

    return right(undefined);
  }

  /**
   * Monta os `OrderItem`s, o `Order` e já o confirma (`place()`), capturando
   * qualquer invariante de domínio violada (quantidade inválida, moeda
   * inválida, etc.) e convertendo em `Either` em vez de deixar a exceção
   * estourar para fora do use-case.
   */
  private buildOrder(customerId: ID, items: MakeOrderUseCaseRequestItem[]): Either<OrderError, Order> {
    try {
      const orderId = new ID();

      const orderItems = items.map((item) =>
        OrderItem.create({
          orderId,
          productId: new ID(item.productId),
          quantity: item.quantity,
          unitPrice: Money.fromCents(item.unitPriceInCents),
        }),
      );

      const order = Order.create({ customerId, items: orderItems }, orderId);

      // Sets the `Order` as placed, so that it can be persisted in the same transaction.
      order.place();

      return right(order);
    } catch (error) {
      if (error instanceof OrderError || error instanceof OrderItemError || error instanceof MoneyError) {
        return left(new OrderError(error.message));
      }

      throw error;
    }
  }

  /**
   * Captura os eventos pendentes ANTES de persistir: `ordersRepository.create`
   * despacha `order.domainEvents` via `DomainEvents` internamente, o que
   * limpa o array como efeito colateral (ver
   * `prds/publish-order-domain-events.md`, seção "Armadilha de
   * ordenação"). Só publica na `Queue` depois que a persistência resolver
   * sem lançar — nunca publica um evento de um pedido que não foi de fato
   * salvo.
   */
  private async persistOrder(order: Order): Promise<void> {
    const pendingEvents = [...order.domainEvents];

    await this.ordersRepository.create(order);

    await publishDomainEvents(this.queue, this.logger, ORDERS_EXCHANGE, pendingEvents);
  }
}
