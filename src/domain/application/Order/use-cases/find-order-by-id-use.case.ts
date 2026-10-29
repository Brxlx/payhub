import { Either, left, right } from '@/core/types/either';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';
import { Order } from '@/domain/enterprise/entities/order';

import { OrdersRepository } from '../repositories/orders.repository';

interface FindOrderByIdUseCaseRequest {
  id: string;
}

type FindOrderByIdUseCaseResponse = Either<OrderError, { order: Order }>;

export class FindOrderByIdUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({ id }: FindOrderByIdUseCaseRequest): Promise<FindOrderByIdUseCaseResponse> {
    if (!id) {
      return left(new OrderError('Order ID is required'));
    }

    const order = await this.ordersRepository.findById(id);

    if (!order) return left(new OrderError('Order not found'));

    return right({ order });
  }
}
