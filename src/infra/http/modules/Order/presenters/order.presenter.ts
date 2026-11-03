import { Order } from '@/domain/enterprise/entities/order';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { OrderStatusValue } from '@/domain/enterprise/entities/value-objects/order-status.vo';

export interface OrderItemHTTPResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPriceInCents: number;
}

export interface OrderHTTPResponse {
  id: string;
  customerId: string;
  items: OrderItemHTTPResponse[];
  total: number;
  status: OrderStatusValue;
  createdAt: string;
  updatedAt: string | null;
}

export class OrderPresenter {
  static toHTTP(order: Order): OrderHTTPResponse {
    return {
      id: order.id.toString(),
      customerId: order.customerId.toString(),
      items: order.items.map(OrderPresenter.itemToHTTP),
      total: order.total.toJSON().amountInCents,
      status: order.status.current,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
    };
  }

  static itemToHTTP(this: void, item: OrderItem): OrderItemHTTPResponse {
    return {
      id: item.id.toString(),
      productId: item.productId.toString(),
      quantity: item.quantity,
      unitPriceInCents: item.unitPrice.toJSON().amountInCents,
    };
  }
}
