import { FakeLogger } from 'test/gateways/fake-logger';
import { FakeQueue } from 'test/gateways/fake-queue';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ORDER_ROUTING_KEYS, ORDERS_EXCHANGE } from '@/core/consts/messaging.consts';
import { ID } from '@/core/entities/id';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { OrderPlacedEvent } from '@/domain/enterprise/entities/events/order-placed.event';
import { Money } from '@/domain/enterprise/entities/value-objects/money.vo';

import { MakeOrderUseCase } from './make-order-use-case';

describe('[MakeOrderUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let fakeQueue: FakeQueue;
  let fakeLogger: FakeLogger;
  let sut: MakeOrderUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    fakeQueue = new FakeQueue();
    fakeLogger = new FakeLogger();
    sut = new MakeOrderUseCase(inMemoryOrdersRepository, fakeQueue, fakeLogger);

    // DomainEvents mantém estado estático global (handlers e agregados
    // marcados) — limpa entre testes para um não vazar efeito no outro.
    DomainEvents.clearHandlers();
    DomainEvents.clearMarkedAggregates();
  });

  it('should create and persist an order with a valid customer and items', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [
        { productId: new ID().toValue(), quantity: 2, unitPriceInCents: 1000 },
        { productId: new ID().toValue(), quantity: 1, unitPriceInCents: 500 },
      ],
    });

    expect(result.isRight()).toBeTruthy();
    expect(inMemoryOrdersRepository.items.size).toBe(1);
  });

  it('should return the order already placed, with the total computed from its items', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [
        { productId: new ID().toValue(), quantity: 2, unitPriceInCents: 1000 },
        { productId: new ID().toValue(), quantity: 1, unitPriceInCents: 500 },
      ],
    });

    expect(result.isRight()).toBeTruthy();

    if (result.isRight()) {
      expect(result.value.order.status.is('PLACED')).toBeTruthy();
      expect(result.value.order.total.equals(Money.fromCents(2500))).toBeTruthy();
    }
  });

  it('should not create an order with an invalid customerId', async () => {
    const result = await sut.execute({
      customerId: 'not-a-valid-id',
      items: [{ productId: new ID().toValue(), quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isLeft()).toBeTruthy();
    expect(inMemoryOrdersRepository.items.size).toBe(0);
  });

  it('should not create an order without items', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [],
    });

    expect(result.isLeft()).toBeTruthy();
    expect(inMemoryOrdersRepository.items.size).toBe(0);
  });

  it('should not create an order with an item that has an invalid quantity', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: new ID().toValue(), quantity: 0, unitPriceInCents: 1000 }],
    });

    expect(result.isLeft()).toBeTruthy();
    expect(inMemoryOrdersRepository.items.size).toBe(0);
  });

  it('should not create an order with an item that has an invalid productId', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: 'not-a-valid-id', quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isLeft()).toBeTruthy();
    expect(inMemoryOrdersRepository.items.size).toBe(0);
  });

  it('should dispatch an OrderPlacedEvent after persisting the order', async () => {
    const handler = vi.fn();
    DomainEvents.register(handler, OrderPlacedEvent.name);

    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: new ID().toValue(), quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isRight()).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);

    if (result.isRight()) {
      // o agregado limpa seus eventos assim que o DomainEvents os despacha
      expect(result.value.order.domainEvents).toHaveLength(0);
    }
  });

  it('should publish the OrderPlacedEvent to the orders exchange', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: new ID().toValue(), quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());

    expect(fakeQueue.publishedMessages).toHaveLength(1);
    expect(fakeQueue.publishedMessages[0]).toMatchObject({
      exchange: ORDERS_EXCHANGE,
      message: {
        routingKey: ORDER_ROUTING_KEYS.PLACED,
        payload: {
          orderId: result.value.order.id.toValue(),
          customerId: result.value.order.customerId.toValue(),
        },
      },
    });
  });

  it('should still return right({ order }) even when publishing fails', async () => {
    fakeQueue.setPublishFailure();

    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: new ID().toValue(), quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isRight()).toBeTruthy();
    expect(fakeLogger.errors).toHaveLength(1);
  });

  it('should capture pending events before the repository clears them so publish still happens', async () => {
    const result = await sut.execute({
      customerId: new ID().toValue(),
      items: [{ productId: new ID().toValue(), quantity: 1, unitPriceInCents: 1000 }],
    });

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());

    // Regressão: `InMemoryOrdersRepository.create` limpa `order.domainEvents`
    // internamente, mas `publishDomainEvents` ainda deve ter publicado o
    // evento, pois o use case o capturou antes dessa chamada.
    expect(result.value.order.domainEvents).toHaveLength(0);
    expect(fakeQueue.publishedMessages).toHaveLength(1);
  });
});
