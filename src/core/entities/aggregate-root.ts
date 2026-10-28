import { DomainEvent } from '@/domain/application/shared/events/domain-event';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';

import { BaseEntity } from './base-entity';

export abstract class AggregateRoot<Props> extends BaseEntity<Props> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
    DomainEvents.markAggregateForDispatch(this);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
