import { makeOrderFactory } from 'test/factories/make-order';
import { makeOrderItemFactory } from 'test/factories/make-order-item';

import { ID } from '@/core/entities/id';

import { OrderError } from './errors/order.error';
import { OrderCancelledEvent } from './events/order-cancelled.event';
import { OrderPlacedEvent } from './events/order-placed.event';
import { Order } from './order';
import { OrderItem } from './order-item';
import { OrderStatusError } from './value-objects/errors/order-status.error';
import { Money } from './value-objects/money.vo';

describe('[Order]', () => {
  let customerId: ID;
  let order: Order;

  beforeEach(() => {
    customerId = new ID();
    order = makeOrderFactory({ customerId: customerId.toString() });
  });

  it('should be created in draft status with the given items', () => {
    expect(order.status.is('DRAFT')).toBeTruthy();
    expect(order.items).toHaveLength(1);
    expect(order.createdAt).toBeInstanceOf(Date);
  });

  it('should not allow creating an order without items', () => {
    expect(() => Order.create({ customerId, items: [] })).toThrow(OrderError);
  });

  describe('addItem', () => {
    let item: OrderItem;

    beforeEach(() => {
      item = makeOrderItemFactory({ orderId: order.id.toString() });
    });

    it('should add an item while the order is a draft', () => {
      order.addItem(item);

      expect(order.items).toHaveLength(2);
    });

    it('should compute total as the sum of all items subtotals', () => {
      const firstItem = makeOrderItemFactory({ quantity: 2, unitPrice: 1000 });
      const secondItem = makeOrderItemFactory({ quantity: 1, unitPrice: 500 });

      const knownOrder = makeOrderFactory({
        customerId: customerId.toString(),
        items: [firstItem],
      });

      knownOrder.addItem(secondItem);

      expect(knownOrder.total.equals(Money.fromCents(2500))).toBeTruthy();
    });

    it('should not allow adding items to an order that is not a draft', () => {
      order.place();

      expect(() => order.addItem(item)).toThrow(OrderError);
    });

    it('should be able to compute total as the sum of one item, then add another item and sum', () => {
      const firstItem = makeOrderItemFactory({ quantity: 1, unitPrice: 500 });

      const knownOrder = makeOrderFactory({
        customerId: customerId.toString(),
        items: [firstItem],
      });

      expect(knownOrder.total).toEqual(Money.fromCents(500));

      const secondItem = makeOrderItemFactory({ quantity: 1, unitPrice: 500 });

      knownOrder.addItem(secondItem);

      expect(knownOrder.total).toEqual(Money.fromCents(1000));
    });
  });

  describe('removeItem', () => {
    let item: OrderItem;

    beforeEach(() => {
      item = makeOrderItemFactory({ orderId: order.id.toString() });
      order.addItem(item);
    });

    it('should remove an item while the order is a draft', () => {
      order.removeItem(item.id);

      expect(order.items).toHaveLength(1);
    });

    it('should not allow removing the last remaining item', () => {
      order.items.forEach((orderItem) => {
        if (!orderItem.id.equals(item.id)) order.removeItem(orderItem.id);
      });

      expect(() => order.removeItem(item.id)).toThrow(OrderError);
    });

    it('should not allow removing items from an order that is not a draft', () => {
      order.place();

      expect(() => order.removeItem(item.id)).toThrow(OrderError);
    });
  });

  describe('changeItemQuantity', () => {
    let item: OrderItem;

    beforeEach(() => {
      item = makeOrderItemFactory({ orderId: order.id.toString() });
      order.addItem(item);
    });

    it('should change the quantity of an existing item while the order is a draft', () => {
      order.changeItemQuantity(item.id, 7);

      expect(item.quantity).toBe(7);
    });

    it('should not allow changing item quantity in an order that is not a draft', () => {
      order.place();

      expect(() => order.changeItemQuantity(item.id, 7)).toThrow(OrderError);
    });

    it('should throw when the item does not belong to the order', () => {
      const otherItemId = new ID();

      expect(() => order.changeItemQuantity(otherItemId, 7)).toThrow(OrderError);
    });
  });

  describe('place', () => {
    it('should transition status from draft to placed', () => {
      order.place();

      expect(order.status.is('PLACED')).toBeTruthy();
    });

    it('should emit an OrderPlacedEvent', () => {
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
      order.place();

      order.cancel();

      expect(order.status.is('CANCELLED')).toBeTruthy();
    });

    it('should not allow cancelling an order that is already cancelled', () => {
      order.cancel();

      expect(() => order.cancel()).toThrow(OrderStatusError);
    });

    it('should emit an OrderCancelledEvent with cancelledFrom=DRAFT when cancelling a draft order', () => {
      order.cancel();

      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderCancelledEvent);
      expect((order.domainEvents[0] as OrderCancelledEvent).cancelledFrom).toBe('DRAFT');
    });

    it('should emit an OrderCancelledEvent with cancelledFrom=PLACED when cancelling a placed order', () => {
      order.place();
      order.clearEvents();

      order.cancel();

      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderCancelledEvent);
      expect((order.domainEvents[0] as OrderCancelledEvent).cancelledFrom).toBe('PLACED');
    });
  });

  describe('delete', () => {
    it('should soft delete a draft order, setting deletedAt without touching the status', () => {
      order.delete();

      expect(order.isDeleted).toBeTruthy();
      expect(order.deletedAt).toBeInstanceOf(Date);
      expect(order.status.is('DRAFT')).toBeTruthy();
    });

    it('should soft delete a cancelled order', () => {
      order.cancel();

      order.delete();

      expect(order.isDeleted).toBeTruthy();
    });

    it('should not allow deleting a placed order', () => {
      order.place();

      expect(() => order.delete()).toThrow(OrderError);
      expect(order.isDeleted).toBeFalsy();
    });

    it('should not allow deleting an order that is already deleted', () => {
      order.delete();

      expect(() => order.delete()).toThrow(OrderError);
    });
  });
});
