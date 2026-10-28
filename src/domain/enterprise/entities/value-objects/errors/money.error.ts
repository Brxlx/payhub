import { EntityError } from '@/core/errors/entity.error';

export class MoneyError extends Error implements EntityError {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}
