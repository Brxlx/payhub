import { makeOrderFactory } from 'test/factories/make-order';

import { ID } from '@/core/entities/id';

import { OrderPlacedEvent } from './events/order-placed.event';
import { Order, OrderError } from './order';
import { OrderItem } from './order-item';
import { Money } from './value-objects/money.vo';
import { OrderStatusError } from './value-objects/order-status.vo';

describe('[Order]', () => {
  let customerId: ID;
  let order: Order;

  beforeEach(() => {
    customerId = new ID();
    order = makeOrderFactory({ customerId: customerId.toString() });
  });

  it('should be created in draft status with no items by default', () => {
    expect(order.status.is('DRAFT')).toBeTruthy();
    expect(order.items).toHaveLength(0);
    expect(order.createdAt).toBeInstanceOf(Date);
  });

  it('should compute total as zero when there are no items', () => {
    expect(order.total.equals(Money.zero())).toBeTruthy();
  });

  describe('addItem', () => {
    let item: OrderItem;

    beforeEach(() => {
      item = OrderItem.create({
        orderId: order.id,
        productId: new ID(),
        quantity: 2,
        unitPrice: Money.fromCents(1000),
      });
    });

    it('should add an item while the order is a draft', () => {
      order.addItem(item);

      expect(order.items).toHaveLength(1);
      expect(order.total.equals(Money.fromCents(2000))).toBeTruthy();
    });

    it('should not allow adding items to an order that is not a draft', () => {
      order.addItem(item);
      order.place();

      expect(() => order.addItem(item)).toThrow(OrderError);
    });
  });

  describe('removeItem', () => {
    let item: OrderItem;

    beforeEach(() => {
      item = OrderItem.create({
        orderId: order.id,
        productId: new ID(),
        quantity: 1,
        unitPrice: Money.fromCents(500),
      });
      order.addItem(item);
    });

    it('should remove an item while the order is a draft', () => {
      order.removeItem(item.id);

      expect(order.items).toHaveLength(0);
    });

    it('should not allow removing items from an order that is not a draft', () => {
      order.place();

      expect(() => order.removeItem(item.id)).toThrow(OrderError);
    });
  });

  describe('place', () => {
    it('should not allow placing an order without items', () => {
      expect(() => order.place()).toThrow(OrderError);
    });

    it('should transition status from draft to placed', () => {
      order.addItem(
        OrderItem.create({
          orderId: order.id,
          productId: new ID(),
          quantity: 1,
          unitPrice: Money.fromCents(1000),
        }),
      );

      order.place();

      expect(order.status.is('PLACED')).toBeTruthy();
    });

    it('should emit an OrderPlacedEvent', () => {
      order.addItem(
        OrderItem.create({
          orderId: order.id,
          productId: new ID(),
          quantity: 1,
          unitPrice: Money.fromCents(1000),
        }),
      );

      order.place();

      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderPlacedEvent);
    });
  });

  describe('cancel', () => {
    it('should transition a draft order to cancelled', () => {
      order.cancel();

      expect(order.status.is('CANCELLED')).toBeTruthy();
    });

    it('should transition a placed order to cancelled', () => {
      order.addItem(
        OrderItem.create({
          orderId: order.id,
          productId: new ID(),
          quantity: 1,
          unitPrice: Money.fromCents(1000),
        }),
      );
      order.place();

      order.cancel();

      expect(order.status.is('CANCELLED')).toBeTruthy();
    });

    it('should not allow cancelling an order that is already cancelled', () => {
      order.cancel();

      expect(() => order.cancel()).toThrow(OrderStatusError);
    });
  });
});
