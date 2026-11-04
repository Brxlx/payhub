import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { CancelOrderUseCase } from '@/domain/application/Order/use-cases/cancel-order-use-case';

@Injectable()
export class CancelOrderService extends CancelOrderUseCase {
  constructor(ordersRepository: OrdersRepository) {
    super(ordersRepository);
  }
}
