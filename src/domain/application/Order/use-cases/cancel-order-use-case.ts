import { ID } from '@/core/entities/id';
import { Either, left, right } from '@/core/types/either';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderStatusError } from '@/domain/enterprise/entities/value-objects/errors/order-status.error';

import { OrderCannotBeCancelledError } from '../errors/order-cannot-be-cancelled.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { OrdersRepository } from '../repositories/orders.repository';

interface CancelOrderUseCaseRequest {
  orderId: string;
}

type CancelOrderUseCaseResponse = Either<OrderNotFoundError | OrderCannotBeCancelledError, { order: Order }>;

/**
 * Cancela um pedido (`DRAFT` ou `PLACED` → `CANCELLED`, ver
 * `ORDER_STATUS_TRANSITIONS`). A regra de transição em si é invariante do
 * agregado, aplicada por `Order.cancel()`/`OrderStatus.transitionTo`; este
 * use case só orquestra busca, tradução de erros e persistência via
 * `OrdersRepository.update()`.
 *
 * Sem este use case, nenhum pedido criado via `MakeOrderUseCase` (que
 * sempre nasce `PLACED`) jamais alcançaria `CANCELLED` — e, por extensão,
 * `DeleteOrderUseCase` (que só aceita `DRAFT`/`CANCELLED`) ficaria
 * inalcançável na prática para qualquer pedido real.
 */
export class CancelOrderUseCase {
  constructor(private readonly orderRepository: OrdersRepository) {}

  async execute({ orderId }: CancelOrderUseCaseRequest): Promise<CancelOrderUseCaseResponse> {
    const orderIdVo = new ID(orderId);

    if (!orderIdVo.isValid()) {
      return left(new OrderNotFoundError(orderId));
    }

    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      return left(new OrderNotFoundError(orderId));
    }

    try {
      order.cancel();
    } catch (error) {
      // `OrderStatusError`: transição de status inválida (ex.: já cancelado).
      // `OrderError`: regra de negócio do próprio `cancel()` (ex.: janela
      // de cancelamento de pedidos `PLACED` expirada — ver `Order.cancel`).
      if (error instanceof OrderStatusError || error instanceof OrderError) {
        return left(new OrderCannotBeCancelledError(error.message));
      }

      throw error;
    }

    await this.orderRepository.update(order);

    return right({ order });
  }
}
