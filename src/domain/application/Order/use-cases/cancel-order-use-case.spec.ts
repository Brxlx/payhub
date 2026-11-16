import { makeOrderFactory } from 'test/factories/make-order';
import { FakeLogger } from 'test/gateways/fake-logger';
import { FakeQueue } from 'test/gateways/fake-queue';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ORDER_ROUTING_KEYS, ORDERS_EXCHANGE } from '@/core/consts/messaging.consts';
import { ID } from '@/core/entities/id';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { OrderCancelledEvent } from '@/domain/enterprise/entities/events/order-cancelled.event';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

import { OrderCannotBeCancelledError } from '../errors/order-cannot-be-cancelled.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { CancelOrderUseCase } from './cancel-order-use-case';

describe('[CancelOrderUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let fakeQueue: FakeQueue;
  let fakeLogger: FakeLogger;
  let sut: CancelOrderUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    fakeQueue = new FakeQueue();
    fakeLogger = new FakeLogger();
    sut = new CancelOrderUseCase(inMemoryOrdersRepository, fakeQueue, fakeLogger);

    DomainEvents.clearHandlers();
    DomainEvents.clearMarkedAggregates();
  });

  it('should cancel a draft order', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(order.status.is('CANCELLED')).toBeTruthy();
  });

  it('should cancel a placed order', async () => {
    const order = makeOrderFactory({ status: OrderStatus.draft() });
    order.place();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(order.status.is('CANCELLED')).toBeTruthy();
  });

  it('should not cancel a placed order after the 1h cancellation window has passed', async () => {
    vi.useFakeTimers();

    const order = makeOrderFactory({ status: OrderStatus.draft() });
    order.place();
    await inMemoryOrdersRepository.create(order);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1h + 1ms

    const result = await sut.execute({ orderId: order.id.toValue() });

    vi.useRealTimers();

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderCannotBeCancelledError);
    expect(order.status.is('PLACED')).toBeTruthy();
  });

  it('should not cancel an order that is already cancelled', async () => {
    const order = makeOrderFactory();
    order.cancel();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderCannotBeCancelledError);
  });

  it('should not cancel a deleted order', async () => {
    const order = makeOrderFactory();
    order.delete();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderCannotBeCancelledError);
  });

  it('should return an error when the order does not exist', async () => {
    const result = await sut.execute({ orderId: new ID().toValue() });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderNotFoundError);
  });

  it('should return an error for an invalid orderId', async () => {
    const result = await sut.execute({ orderId: 'not-a-valid-id' });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderNotFoundError);
  });

  it('should dispatch an OrderCancelledEvent after persisting the order', async () => {
    const handler = vi.fn();
    DomainEvents.register(handler, OrderCancelledEvent.name);

    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(order.domainEvents).toHaveLength(0);
  });

  it('should publish the OrderCancelledEvent to the orders exchange', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();

    expect(fakeQueue.publishedMessages).toHaveLength(1);
    expect(fakeQueue.publishedMessages[0]).toMatchObject({
      exchange: ORDERS_EXCHANGE,
      message: {
        routingKey: ORDER_ROUTING_KEYS.CANCELLED,
        payload: { orderId: order.id.toValue() },
      },
    });
  });

  it('should still return right({ order }) even when publishing fails', async () => {
    fakeQueue.setPublishFailure();

    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(fakeLogger.errors).toHaveLength(1);
  });

  it('should capture pending events before the repository clears them, so publish still happens', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();

    // Regressão: `InMemoryOrdersRepository.update` limpa `order.domainEvents`
    // internamente, mas `publishDomainEvents` ainda deve ter publicado o
    // evento, pois o use case o capturou antes dessa chamada.
    expect(order.domainEvents).toHaveLength(0);
    expect(fakeQueue.publishedMessages).toHaveLength(1);
  });
});
