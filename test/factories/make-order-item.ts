import { faker } from '@faker-js/faker/locale/pt_BR';

import { ID } from '@/core/entities/id';
import { OrderItem } from '@/domain/enterprise/entities/order-item';
import { Money } from '@/domain/enterprise/entities/value-objects/money.vo';

interface MakeOrderItemProps {
  orderId?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
}

export function makeOrderItemFactory(props: MakeOrderItemProps = {}, id?: ID) {
  return OrderItem.create(
    {
      orderId: new ID(props.orderId),
      productId: new ID(props.productId),
      quantity: props.quantity ?? faker.number.int({ min: 1, max: 10 }),
      unitPrice: Money.fromCents(props.unitPrice ?? faker.number.int({ min: 10, max: 1000 })),
    },
    id,
  );
}
