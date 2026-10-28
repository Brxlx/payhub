import { OrderStatus, OrderStatusError } from './order-status.vo';

describe('[OrderStatus]', () => {
  let status: OrderStatus;

  beforeEach(() => {
    status = OrderStatus.draft();
  });

  it('should create a draft status', () => {
    expect(status.is('DRAFT')).toBeTruthy();
  });

  it('should create a status from an explicit value', () => {
    const placed = OrderStatus.create('PLACED');

    expect(placed.is('PLACED')).toBeTruthy();
  });

  it('should allow transitioning from draft to placed', () => {
    const placed = status.transitionTo('PLACED');

    expect(placed.is('PLACED')).toBeTruthy();
    expect(status.is('DRAFT')).toBeTruthy(); // instância original é imutável
  });

  it('should allow transitioning from draft to cancelled', () => {
    const cancelled = status.transitionTo('CANCELLED');

    expect(cancelled.is('CANCELLED')).toBeTruthy();
  });

  it('should allow transitioning from placed to cancelled', () => {
    const placed = status.transitionTo('PLACED');
    const cancelled = placed.transitionTo('CANCELLED');

    expect(cancelled.is('CANCELLED')).toBeTruthy();
  });

  it('should not allow transitioning from cancelled to any other status', () => {
    const cancelled = status.transitionTo('CANCELLED');

    expect(() => cancelled.transitionTo('PLACED')).toThrow(OrderStatusError);
  });

  it('should not allow transitioning from placed back to draft', () => {
    const placed = status.transitionTo('PLACED');

    expect(() => placed.transitionTo('DRAFT')).toThrow(OrderStatusError);
  });

  it('should compare equality by value', () => {
    expect(OrderStatus.draft().equals(OrderStatus.draft())).toBeTruthy();
    expect(
      OrderStatus.draft().equals(OrderStatus.create('PLACED')),
    ).toBeFalsy();
  });
});
