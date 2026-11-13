import { ORDER_ROUTING_KEYS } from '@/core/consts/messaging.consts';
import { ID } from '@/core/entities/id';

import { OrderCancelledEvent } from './order-cancelled.event';

describe('[OrderCancelledEvent]', () => {
  it('should expose eventName as the "order.cancelled" routing key', () => {
    const event = new OrderCancelledEvent(new ID(), new ID(), 'DRAFT');

    expect(event.eventName).toBe(ORDER_ROUTING_KEYS.CANCELLED);
  });

  it('should return the orderId as the aggregate id', () => {
    const orderId = new ID();
    const event = new OrderCancelledEvent(orderId, new ID(), 'PLACED');

    expect(event.getAggregateId().equals(orderId)).toBeTruthy();
  });

  it('should serialize a JSON-safe payload, including the status it transitioned from', () => {
    const orderId = new ID();
    const customerId = new ID();

    const event = new OrderCancelledEvent(orderId, customerId, 'PLACED');

    expect(event.toPayload()).toEqual({
      orderId: orderId.toValue(),
      customerId: customerId.toValue(),
      cancelledFrom: 'PLACED',
    });
  });

  it('should not duplicate envelope metadata (eventName, ocurredAt) inside the payload', () => {
    // orderId/customerId/cancelledFrom SÃO esperados no payload (são dado
    // de negócio do evento); o que não deve estar lá é o que já vira
    // coluna própria da outbox (event_type, created_at) — ver
    // DomainEvent.toPayload.
    const event = new OrderCancelledEvent(new ID(), new ID(), 'DRAFT');

    const payload = event.toPayload();

    expect(payload).not.toHaveProperty('eventName');
    expect(payload).not.toHaveProperty('ocurredAt');
  });
});
