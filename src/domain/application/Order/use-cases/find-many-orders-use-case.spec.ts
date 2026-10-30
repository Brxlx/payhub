import { makeOrderFactory } from 'test/factories/make-order';
import { InMemoryOrdersRepository } from 'test/repositories/in-memory-orders-repository';

import { OrderError } from '@/domain/enterprise/entities/errors/order.error';

import { FindManyOrdersUseCase } from './find-many-orders-use-case';

describe('[FindManyOrdersUseCase]', () => {
  let inMemoryOrdersRepository: InMemoryOrdersRepository;
  let sut: FindManyOrdersUseCase;

  beforeEach(() => {
    inMemoryOrdersRepository = new InMemoryOrdersRepository();
    sut = new FindManyOrdersUseCase(inMemoryOrdersRepository);
  });

  async function seedOrders(amount: number) {
    for (let i = 0; i < amount; i++) {
      await inMemoryOrdersRepository.create(makeOrderFactory());
    }
  }

  it('should list orders using default pagination when none is provided', async () => {
    await seedOrders(5);

    const result = await sut.execute({});

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());
    expect(result.value.orders).toHaveLength(5);
    expect(result.value.page).toBe(1);
    expect(result.value.itemsPerPage).toBe(20);
    expect(result.value.total).toBe(5);
    expect(result.value.hasMore).toBeFalsy();
  });

  it('should paginate orders according to page and itemsPerPage', async () => {
    await seedOrders(25);

    const firstPage = await sut.execute({ page: 1, itemsPerPage: 10 });
    const secondPage = await sut.execute({ page: 2, itemsPerPage: 10 });
    const thirdPage = await sut.execute({ page: 3, itemsPerPage: 10 });

    assert(firstPage.isRight());
    assert(secondPage.isRight());
    assert(thirdPage.isRight());

    expect(firstPage.value.orders).toHaveLength(10);
    expect(firstPage.value.hasMore).toBeTruthy();

    expect(secondPage.value.orders).toHaveLength(10);
    expect(secondPage.value.hasMore).toBeTruthy();

    expect(thirdPage.value.orders).toHaveLength(5);
    expect(thirdPage.value.hasMore).toBeFalsy();
    expect(thirdPage.value.total).toBe(25);
  });

  it('should return an empty list without erroring when the page is past the last one', async () => {
    await seedOrders(3);

    const result = await sut.execute({ page: 5, itemsPerPage: 10 });

    expect(result.isRight()).toBeTruthy();
    assert(result.isRight());
    expect(result.value.orders).toHaveLength(0);
    expect(result.value.hasMore).toBeFalsy();
    expect(result.value.total).toBe(3);
  });

  it('should return an error when page is not a positive integer', async () => {
    const result = await sut.execute({ page: 0 });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
  });

  it('should return an error when page is not an integer', async () => {
    const result = await sut.execute({ page: 1.5 });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
  });

  it('should return an error when itemsPerPage is zero or negative', async () => {
    const result = await sut.execute({ itemsPerPage: 0 });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
  });

  it('should return an error when itemsPerPage exceeds the maximum of 100', async () => {
    const result = await sut.execute({ itemsPerPage: 101 });

    expect(result.isLeft()).toBeTruthy();
    assert(result.isLeft());
    expect(result.value).toBeInstanceOf(OrderError);
  });

  it('should accept itemsPerPage at the upper bound of 100', async () => {
    const result = await sut.execute({ itemsPerPage: 100 });

    expect(result.isRight()).toBeTruthy();
  });
});
