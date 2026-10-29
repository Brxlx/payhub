import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ID } from '@/core/entities/id';
import { DomainEvents } from '@/domain/application/shared/events/domain-events';
import { OrderPlacedEvent } from '@/domain/enterprise/entities/events/order-placed.event';
import { Money } from '@/domain/enterprise/entities/value-objects/money.vo';

import { MakeOrderUseCase } from './make-order-use-case';

describe('[MakeOrderUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let sut: MakeOrderUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    sut = new MakeOrderUseCase(inMemoryOrdersRepository);

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
});
