import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { MakeOrderUseCase } from '@/domain/application/Order/use-cases/make-order-use-case';
import { Logger } from '@/domain/application/shared/gateways/logger';
import { Queue } from '@/domain/application/shared/gateways/queue';

@Injectable()
export class MakeOrderService extends MakeOrderUseCase {
  constructor(ordersRepository: OrdersRepository, queue: Queue, logger: Logger) {
    super(ordersRepository, queue, logger);
  }
}
