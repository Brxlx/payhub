import { EntityError } from '@/core/errors/entity.error';

export class OrderStatusError extends Error implements EntityError {
  constructor(message: string) {
    super(message);
    this.name = 'OrderStatusError';
  }
}
