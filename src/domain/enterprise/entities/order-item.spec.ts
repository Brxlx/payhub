import { makeOrderItemFactory } from 'test/factories/make-order-item';

import { ID } from '@/core/entities/id';

import { OrderItemError } from './errors/order-item.error';
import { OrderItem } from './order-item';
import { Money } from './value-objects/money.vo';

describe('[OrderItem]', () => {
  let orderId: ID;
  let productId: ID;

  beforeEach(() => {
    orderId = new ID();
    productId = new ID();
  });

  it('should create an item with valid props', () => {
    const item = makeOrderItemFactory({
      quantity: 3,
      unitPrice: 500,
    });

    expect(item.quantity).toBe(3);
    expect(item.unitPrice.equals(Money.fromCents(500))).toBeTruthy();
  });

  it('should not allow creating an item with a non-positive quantity', () => {
    expect(() =>
      OrderItem.create({
        orderId,
        productId,
        quantity: 0,
        unitPrice: Money.fromCents(500),
      }),
    ).toThrow(OrderItemError);
  });

  it('should not allow creating an item with a non-integer quantity', () => {
    expect(() =>
      OrderItem.create({
        orderId,
        productId,
        quantity: 1.5,
        unitPrice: Money.fromCents(500),
      }),
    ).toThrow(OrderItemError);
  });

  it('should compute the subtotal as unit price multiplied by quantity', () => {
    const item = OrderItem.create({
      orderId,
      productId,
      quantity: 2,
      unitPrice: Money.fromCents(1000),
    });

    expect(item.subtotal.equals(Money.fromCents(2000))).toBeTruthy();
  });

  it('should change the quantity through changeQuantity', () => {
    const item = OrderItem.create({
      orderId,
      productId,
      quantity: 1,
      unitPrice: Money.fromCents(1000),
    });

    item.changeQuantity(5);

    expect(item.quantity).toBe(5);
  });

  it('should not allow changing to an invalid quantity', () => {
    const item = OrderItem.create({
      orderId,
      productId,
      quantity: 1,
      unitPrice: Money.fromCents(1000),
    });

    expect(() => item.changeQuantity(0)).toThrow(OrderItemError);
  });
});
