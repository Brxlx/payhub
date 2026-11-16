import { FakeLogger } from 'test/gateways/fake-logger';
import { FakeQueue } from 'test/gateways/fake-queue';

import { ID } from '@/core/entities/id';
import { QueueError } from '@/domain/application/shared/errors/queue.error';

import { DomainEvent } from './domain-event';
import { publishDomainEvents } from './publish-domain-events';

/**
 * `DomainEvent` de teste mínimo — não usa `OrderPlacedEvent`/
 * `OrderCancelledEvent` reais de propósito, para manter este spec isolado
 * de qualquer regra de negócio de `Order` e focado só no contrato que
 * `publishDomainEvents` de fato usa (`eventName`, `getAggregateId`,
 * `toPayload`).
 */
function makeFakeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  const aggregateId = new ID();

  return {
    ocurredAt: new Date(),
    eventName: 'fake.event',
    getAggregateId: () => aggregateId,
    toPayload: () => ({ aggregateId: aggregateId.toValue() }),
    ...overrides,
  };
}

describe('[publishDomainEvents]', () => {
  let fakeQueue: FakeQueue;
  let fakeLogger: FakeLogger;

  beforeEach(() => {
    fakeQueue = new FakeQueue();
    fakeLogger = new FakeLogger();
  });

  it('should publish each event to the given exchange with its eventName as routingKey', async () => {
    const event = makeFakeEvent({ eventName: 'order.placed' });

    await publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', [event]);

    expect(fakeQueue.publishedMessages).toHaveLength(1);
    expect(fakeQueue.publishedMessages[0]).toMatchObject({
      exchange: 'orders.events',
      message: { routingKey: 'order.placed', payload: event.toPayload() },
    });
  });

  it('should generate a messageId for each published message', async () => {
    const event = makeFakeEvent();

    await publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', [event]);

    expect(fakeQueue.publishedMessages[0].message.messageId).toEqual(expect.any(String));
    expect(fakeQueue.publishedMessages[0].message.messageId.length).toBeGreaterThan(0);
  });

  it('should publish events sequentially, preserving their order', async () => {
    const first = makeFakeEvent({ eventName: 'first.event' });
    const second = makeFakeEvent({ eventName: 'second.event' });

    await publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', [first, second]);

    expect(fakeQueue.publishedMessages.map((entry) => entry.message.routingKey)).toEqual([
      'first.event',
      'second.event',
    ]);
  });

  it('should do nothing when given an empty list of events', async () => {
    await publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', []);

    expect(fakeQueue.publishedMessages).toHaveLength(0);
    expect(fakeLogger.errors).toHaveLength(0);
  });

  it('should log the failure and continue instead of throwing when a publish fails', async () => {
    fakeQueue.setPublishFailure();

    const first = makeFakeEvent({ eventName: 'first.event' });
    const second = makeFakeEvent({ eventName: 'second.event' });

    await expect(
      publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', [first, second]),
    ).resolves.toBeUndefined();

    expect(fakeLogger.errors).toHaveLength(2);
    expect(fakeLogger.errors[0].meta).toMatchObject({ eventName: 'first.event', exchange: 'orders.events' });
  });

  it('should keep publishing remaining events even after an earlier one fails', async () => {
    const failing = makeFakeEvent({ eventName: 'will.fail' });
    const succeeding = makeFakeEvent({ eventName: 'will.succeed' });

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await
    vi.spyOn(fakeQueue, 'publish').mockImplementation(async (exchange, message) => {
      callCount += 1;

      if (callCount === 1) {
        throw new QueueError('broker unreachable');
      }

      fakeQueue.publishedMessages.push({ exchange, message });
    });

    await publishDomainEvents(fakeQueue, fakeLogger, 'orders.events', [failing, succeeding]);

    expect(fakeLogger.errors).toHaveLength(1);
    expect(fakeQueue.publishedMessages).toHaveLength(1);
    expect(fakeQueue.publishedMessages[0].message.routingKey).toBe('will.succeed');
  });
});
