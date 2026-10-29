import { makeOrderFactory } from 'test/factories/make-order';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ID } from '@/core/entities/id';
import { OrderError } from '@/domain/enterprise/entities/errors/order.error';

import { FindOrderByIdUseCase } from './find-order-by-id-use.case';

describe('[FindOrderByIdUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let sut: FindOrderByIdUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    sut = new FindOrderByIdUseCase(inMemoryOrdersRepository);
  });

  it('should find an order by id', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ id: order.id.toString() });

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());

    expect(result.value.order.id).toEqual(order.id);
    expect(result.value.order.items).toHaveLength(1);
  });

  it('should return an error when order is not found', async () => {
    const order = makeOrderFactory({}, new ID('test-id'));

    await inMemoryOrdersRepository.create(order);

    expect(order.id.toString()).toEqual('test-id');
    expect(inMemoryOrdersRepository.items.get(order.id.toString())?.id.toString()).toEqual('test-id');

    const result = await sut.execute({ id: 'non-existent-id' });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
    expect(result.value.message).toEqual('Order not found');
  });

  it('should return an error when id is an empty string', async () => {
    const result = await sut.execute({ id: '' });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
    expect(result.value.message).toEqual('Order ID is required');
  });

  it('should find an order that has been soft-deleted', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    order.delete();
    await inMemoryOrdersRepository.update(order);

    const result = await sut.execute({ id: order.id.toString() });

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());
    expect(result.value.order.id).toEqual(order.id);
    expect(result.value.order.isDeleted).toBeTruthy();
    expect(result.value.order.deletedAt).toEqual(order.deletedAt);
  });
});
