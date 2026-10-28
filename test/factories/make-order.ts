import { ID } from '@/core/entities/id';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

import { makeOrderItemFactory } from './make-order-item';

interface MakeOrderProps {
  customerId?: string;
  status?: OrderStatus;
  items?: OrderItem[];
}

export function makeOrderFactory(props: MakeOrderProps = {}, id?: ID) {
  return Order.create(
    {
      customerId: new ID(props.customerId),
      status: props.status ?? OrderStatus.draft(),
      items: props.items ?? [makeOrderItemFactory()],
    },
    id,
  );
}
