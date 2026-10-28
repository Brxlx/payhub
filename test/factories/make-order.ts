import { ID } from '@/core/entities/id';
import { Order } from '@/domain/enterprise/entities/order';
import { OrderStatus } from '@/domain/enterprise/entities/value-objects/order-status.vo';

interface MakeOrderProps {
  customerId?: string;
  status?: OrderStatus;
}

export function makeOrderFactory(props: MakeOrderProps = {}, id?: ID) {
  return Order.create(
    {
      customerId: new ID(props.customerId),
      status: props.status ?? OrderStatus.draft(),
    },
    id,
  );
}
