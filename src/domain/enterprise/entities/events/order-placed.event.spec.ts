import { ORDER_ROUTING_KEYS } from '@/core/consts/messaging.consts';
import { ID } from '@/core/entities/id';

import { Money } from '../value-objects/money.vo';
import { OrderPlacedEvent } from './order-placed.event';

describe('[OrderPlacedEvent]', () => {
  it('should expose eventName as the "order.placed" routing key', () => {
    const event = new OrderPlacedEvent(new ID(), new ID(), Money.fromCents(1000));

    expect(event.eventName).toBe(ORDER_ROUTING_KEYS.PLACED);
  });

  it('should return the orderId as the aggregate id', () => {
    const orderId = new ID();
    const event = new OrderPlacedEvent(orderId, new ID(), Money.fromCents(1000));

    expect(event.getAggregateId().equals(orderId)).toBeTruthy();
  });

  it('should serialize a JSON-safe payload, without leaking raw Value Object instances', () => {
    const orderId = new ID();
    const customerId = new ID();
    const total = Money.fromCents(2500, 'BRL');

    const event = new OrderPlacedEvent(orderId, customerId, total);

    expect(event.toPayload()).toEqual({
      orderId: orderId.toValue(),
      customerId: customerId.toValue(),
      total: { amountInCents: 2500, currency: 'BRL' },
    });
  });

  it('should not duplicate envelope metadata (eventName, ocurredAt) inside the payload', () => {
    // orderId/customerId SÃO esperados no payload (são dado de negócio do
    // evento); o que não deve estar lá é o que já vira coluna própria da
    // outbox (event_type, created_at) — ver DomainEvent.toPayload.
    const event = new OrderPlacedEvent(new ID(), new ID(), Money.fromCents(1000));

    const payload = event.toPayload();

    expect(payload).not.toHaveProperty('eventName');
    expect(payload).not.toHaveProperty('ocurredAt');
  });
});
