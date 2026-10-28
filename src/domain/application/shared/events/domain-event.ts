import { ID } from '@/core/entities/id';

export interface DomainEvent {
  ocurredAt: Date;
  getAggregateId(): ID;
}
