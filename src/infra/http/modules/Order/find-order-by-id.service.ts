import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { FindOrderByIdUseCase } from '@/domain/application/Order/use-cases/find-order-by-id-use.case';

@Injectable()
export class FindOrderByIdService extends FindOrderByIdUseCase {
  constructor(ordersRepository: OrdersRepository) {
    super(ordersRepository);
  }
}
