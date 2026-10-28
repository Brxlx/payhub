import { EntityError } from '@/core/errors/entity.error';

export class OrderItemError extends Error implements EntityError {
  constructor(message: string) {
    super(message);
    this.name = 'OrderItemError';
  }
}
