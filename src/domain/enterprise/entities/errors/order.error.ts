import { EntityError } from '@/core/errors/entity.error';

export class OrderError extends Error implements EntityError {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}
