import { faker } from '@faker-js/faker/locale/pt_BR';

import { ORDER_ROUTING_KEYS } from '@/core/consts/messaging.consts';
import { createCuid2 } from '@/core/entities/cuid2';
import { QueueMessage } from '@/domain/application/shared/gateways/queue';

export function makeQueueMessageFactory(overrides: Partial<QueueMessage> = {}): QueueMessage {
  return {
    messageId: faker.string.uuid(),
    routingKey: ORDER_ROUTING_KEYS.PLACED,
    // orderId precisa ser um cuid2 válido (mesmo formato de `ID`, ver
    // @/core/entities/id.ts)
    payload: { orderId: createCuid2() },
    ...overrides,
  };
}
