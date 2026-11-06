import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { FindManyOrdersUseCase } from '@/domain/application/Order/use-cases/find-many-orders-use-case';

@Injectable()
export class FindManyOrdersService extends FindManyOrdersUseCase {
  constructor(ordersRepository: OrdersRepository) {
    super(ordersRepository);
  }
}
