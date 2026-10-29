import { makeOrderFactory } from 'test/factories/make-order';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { ID } from '@/core/entities/id';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

import { OrderCannotBeDeletedError } from '../errors/order-cannot-be-deleted.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { DeleteOrderUseCase } from './delete-order-use-case';

describe('[DeleteOrderUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let sut: DeleteOrderUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    sut = new DeleteOrderUseCase(inMemoryOrdersRepository);
  });

  it('should soft delete a draft order', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(order.isDeleted).toBeTruthy();
    // soft delete: o agregado continua no "banco", nunca é removido de fato.
    expect(inMemoryOrdersRepository.items.size).toBe(1);
  });

  it('should soft delete a cancelled order', async () => {
    const order = makeOrderFactory({ status: OrderStatus.draft() });
    order.cancel();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isRight()).toBeTruthy();
    expect(order.isDeleted).toBeTruthy();
  });

  it('should not delete a placed order', async () => {
    const order = makeOrderFactory();
    order.place();
    await inMemoryOrdersRepository.create(order);

    const result = await sut.execute({ orderId: order.id.toValue() });

    expect(result.isLeft()).toBeTruthy();
    expect(result.value).toBeInstanceOf(OrderCannotBeDeletedError);
    expect(order.isDeleted).toBeFalsy();
  });

  it('should return an error when the order does not exist', async () => {
    const result = await sut.execute({ orderId: new ID().toValue() });

    expect(result.isLeft()).toBeTruthy();
    expect(result.value).toBeInstanceOf(OrderNotFoundError);
  });

  it('should return an error for an invalid orderId', async () => {
    const result = await sut.execute({ orderId: 'not-a-valid-id' });

    expect(result.isLeft()).toBeTruthy();
    expect(result.value).toBeInstanceOf(OrderNotFoundError);
  });

  it('should not allow deleting an order that was already deleted', async () => {
    const order = makeOrderFactory();
    await inMemoryOrdersRepository.create(order);

    const firstDeletion = await sut.execute({ orderId: order.id.toValue() });
    const secondDeletion = await sut.execute({ orderId: order.id.toValue() });

    expect(firstDeletion.isRight()).toBeTruthy();
    expect(secondDeletion.isLeft()).toBeTruthy();
    expect(secondDeletion.value).toBeInstanceOf(OrderCannotBeDeletedError);
  });
});
