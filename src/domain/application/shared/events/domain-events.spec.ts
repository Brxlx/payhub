import { AggregateRoot } from '@/core/entities/aggregate-root';
import { ID } from '@/core/entities/id';

import { DomainEvent } from './domain-event';
import { DomainEvents } from './domain-events';

// The Domain Event
class CustomAggregateCreated implements DomainEvent {
  public ocurredAt: Date;
  private aggregate: CustomAggregate;

  constructor(aggregate: CustomAggregate) {
    this.ocurredAt = new Date();
    this.aggregate = aggregate;
  }

  public getAggregateId(): ID {
    return this.aggregate.id;
  }
}

class CustomAggregate extends AggregateRoot<null> {
  static create() {
    const aggregate = new CustomAggregate(null);

    aggregate.addDomainEvent(new CustomAggregateCreated(aggregate));

    return aggregate;
  }
}

describe('Domain events', () => {
  it('should be able to dispatch and listen events', () => {
    const callbackSpy = vi.fn();
    // Subscriber cadastrado(ouvindo o evento de "resposta criada")
    DomainEvents.register(callbackSpy, CustomAggregateCreated.name);
    // Create the domain event(without save in db)
    const aggregate = CustomAggregate.create();
    // Created but not dispatched
    expect(aggregate.domainEvents).toHaveLength(1);

    // Saving in db and dispatching the domain event and clear the array
    DomainEvents.dispatchEventsForAggregate(aggregate.id);

    // Subscriber ouve o evento e faz o que precisa ser feito
    expect(callbackSpy).toHaveBeenCalled();
    expect(aggregate.domainEvents).toHaveLength(0);
  });
});
