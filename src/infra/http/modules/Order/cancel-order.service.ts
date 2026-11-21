import { Injectable } from '@nestjs/common';

import { OrdersRepository } from '@/domain/application/Order/repositories/orders.repository';
import { CancelOrderUseCase } from '@/domain/application/Order/use-cases/cancel-order-use-case';
import { Logger } from '@/domain/application/shared/gateways/logger';
import { Queue } from '@/domain/application/shared/gateways/queue';

@Injectable()
export class CancelOrderService extends CancelOrderUseCase {
  constructor(ordersRepository: OrdersRepository, queue: Queue, logger: Logger) {
    super(ordersRepository, queue, logger);
  }
}
