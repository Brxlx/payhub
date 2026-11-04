import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { DeleteOrderUseCase } from '@/domain/application/Order/use-cases/delete-order-use-case';

@Injectable()
export class DeleteOrderService extends DeleteOrderUseCase {
  constructor(ordersRepository: OrdersRepository) {
    super(ordersRepository);
  }
}
