import { ID } from '@/core/entities/id';
import { Either, left, right } from '@/core/types/either';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { Order } from '@/domain/enterprise/entities/order';

import { OrderCannotBeDeletedError } from '../errors/order-cannot-be-deleted.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { OrdersRepository } from '../repositories/orders.repository';

interface DeleteOrderUseCaseRequest {
  orderId: string;
}

type DeleteOrderUseCaseResponse = Either<OrderNotFoundError | OrderCannotBeDeletedError, { order: Order }>;

/**
 * Soft delete de um pedido: nunca remove a linha fisicamente (ver README,
 * seção 6.2 — coluna `deleted_at`). Só é permitido para pedidos `DRAFT` ou
 * `CANCELLED` — a regra em si é um invariante do agregado, aplicado por
 * `Order.delete()`; este use case só orquestra busca, tradução de erros e
 * persistência via `OrdersRepository.update()`.
 *
 * `OrdersRepository.delete()` continua existindo no port, mas reservado
 * para uma futura rotina de purge definitivo (pedidos já soft-deletados há
 * mais de 30 dias) — não é chamado a partir daqui.
 */
export class DeleteOrderUseCase {
  constructor(private readonly orderRepository: OrdersRepository) {}

  async execute({ orderId }: DeleteOrderUseCaseRequest): Promise<DeleteOrderUseCaseResponse> {
    const orderIdVo = new ID(orderId);

    if (!orderIdVo.isValid()) {
      return left(new OrderNotFoundError(orderId));
    }

    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      return left(new OrderNotFoundError(orderId));
    }

    try {
      order.delete();
    } catch (error) {
      if (error instanceof OrderError) {
        return left(new OrderCannotBeDeletedError(error.message));
      }

      throw error;
    }

    await this.orderRepository.update(order);

    return right({ order });
  }
}
