import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { MakeOrderUseCase } from '@/domain/application/Order/use-cases/make-order-use-case';

@Injectable()
export class MakeOrderService extends MakeOrderUseCase {
  constructor(ordersRepository: OrdersRepository) {
    super(ordersRepository);
  }
}
