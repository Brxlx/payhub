import { makeOrderFactory } from 'test/factories/make-order';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ID } from '@/core/entities/id';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { OrderCancelledEvent } from '@/domain/enterprise/entities/events/order-cancelled.event';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

import { OrderCannotBeCancelledError } from '../errors/order-cannot-be-cancelled.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { CancelOrderUseCase } from './cancel-order-use-case';

describe('[CancelOrderUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let sut: CancelOrderUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    sut = new CancelOrderUseCase(inMemoryOrdersRepository);

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

  it('should not cancel an order that is already cancelled', async () => {
    const order = makeOrderFactory();
    order.cancel();
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
});
