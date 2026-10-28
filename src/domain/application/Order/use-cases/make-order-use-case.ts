import { ID } from '@/core/entities/id';
import { Either, left, right } from '@/core/types/either';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { OrderItemError } from '@/domain/enterprise/entities/errors/order-item.error';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { MoneyError } from '@/domain/enterprise/entities/value-objects/errors/money.error';
import { Money } from '@/domain/enterprise/entities/value-objects/money.vo';

import { OrdersRepository } from '../repositories/orders.repository';

interface CreateOrderUseCaseRequestItem {
  productId: string;
  quantity: number;
  unitPriceInCents: number;
}

interface CreateOrderUseCaseRequest {
  customerId: string;
  items: CreateOrderUseCaseRequestItem[];
}

type CreateOrderUseCaseResponse = Either<OrderError, { order: Order }>;

/**
 * PayHub não se comporta como carrinho: o pedido chega completo em uma
 * única chamada, então criar e confirmar (`place()`) acontecem juntos aqui
 * — não existe um estado "rascunho salvo" intermediário na API.
 */
export class MakeOrderUseCase {
  constructor(private readonly orderRepository: OrdersRepository) {}

  async execute({ customerId, items }: CreateOrderUseCaseRequest): Promise<CreateOrderUseCaseResponse> {
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

  private validateItems(items: CreateOrderUseCaseRequestItem[]): Either<OrderError, void> {
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
  private buildOrder(customerId: ID, items: CreateOrderUseCaseRequestItem[]): Either<OrderError, Order> {
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

      order.place();

      return right(order);
    } catch (error) {
      if (error instanceof OrderError || error instanceof OrderItemError || error instanceof MoneyError) {
        return left(new OrderError(error.message));
      }

      throw error;
    }
  }

  private async persistOrder(order: Order): Promise<void> {
    await this.orderRepository.create(order);

    // TODO: a implementação concreta de `OrdersRepository.create` (Drizzle)
    // deve, na mesma transação, persistir `orders` + `order_items` e uma
    // linha na tabela de outbox (ver README seção 8.3), e então chamar
    // `DomainEvents.dispatchEventsForAggregate(order.id)` — isso dispara o
    // `OrderPlacedEvent` já presente em `order.domainEvents`.
    // TODO: registrar (em algum setup/bootstrap da aplicação, via
    // `DomainEvents.register(...)`) um handler para `OrderPlacedEvent` que
    // publique no RabbitMQ (exchange `orders.events`, routing key
    // `order.placed`) assim que o módulo de mensageria existir (README
    // seção 8).
  }
}
