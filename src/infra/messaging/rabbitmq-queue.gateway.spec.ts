import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';

import { QueueErrorMessagesConsts } from '@/core/consts/queue.consts';
import { QueueError } from '@/domain/application/shared/errors/queue.error';

import { makeQueueMessageFactory } from '../../../test/factories/make-queue-message';
import { RabbitMqQueueGateway } from './rabbitmq-queue.gateway';

/**
 * `AmqpConnection` real exige uma conexão de verdade com o broker (ver
 * `init()`), então os testes aqui usam um double mínimo — só os métodos
 * que `RabbitMqQueueGateway` de fato chama — em vez de instanciar a
 * classe real.
 */
function makeAmqpConnectionMock() {
  const publish = vi.fn();
  const createSubscriber = vi.fn();

  const amqpConnection = { publish, createSubscriber } as unknown as AmqpConnection;

  return { amqpConnection, publish, createSubscriber };
}

describe('[RabbitMqQueueGateway]', () => {
  describe('publish', () => {
    it('should publish to the given exchange with the routing key and payload received as parameters', async () => {
      const { amqpConnection, publish } = makeAmqpConnectionMock();
      publish.mockResolvedValue(true);
      const gateway = new RabbitMqQueueGateway(amqpConnection);
      const message = makeQueueMessageFactory();

      await gateway.publish('orders.events', message);

      expect(publish).toHaveBeenCalledWith('orders.events', message.routingKey, message.payload, {
        messageId: message.messageId,
        persistent: true,
      });
    });

    it('should mark the message as persistent so it survives a broker restart', async () => {
      type PublishOptions = {
        assert?: string;
        exchange?: string;
        messageId?: string;
        persistent?: boolean;
      };

      type PublishCallArgs = [
        routingKey: string,
        exchange: string,
        content: unknown,
        options?: PublishOptions,
      ];

      const { amqpConnection, publish } = makeAmqpConnectionMock();
      publish.mockResolvedValue(true);
      const gateway = new RabbitMqQueueGateway(amqpConnection);

      await gateway.publish('orders.events', makeQueueMessageFactory());

      const [, , , options] = publish.mock.calls[0] as PublishCallArgs;
      expect(options).toMatchObject({ persistent: true });
    });

    it('should throw a QueueError when the AMQP client rejects', async () => {
      const { amqpConnection, publish } = makeAmqpConnectionMock();
      publish.mockRejectedValue(new Error('channel closed'));
      const gateway = new RabbitMqQueueGateway(amqpConnection);

      await expect(gateway.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow(QueueError);
      await expect(gateway.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow(
        QueueErrorMessagesConsts.SEND_TO_QUEUE_ERROR,
      );
    });

    it('should preserve the original AMQP error as the cause of the QueueError', async () => {
      const { amqpConnection, publish } = makeAmqpConnectionMock();
      const clientError = new Error('channel closed');
      publish.mockRejectedValue(clientError);
      const gateway = new RabbitMqQueueGateway(amqpConnection);

      const thrown: unknown = await gateway
        .publish('orders.events', makeQueueMessageFactory())
        .catch((error) => error as Error);

      expect(thrown).toBeInstanceOf(QueueError);
      expect((thrown as QueueError).cause).toBe(clientError);
    });
  });

  describe('consume', () => {
    it('should register the handler for the given queue via createSubscriber', async () => {
      const { amqpConnection, createSubscriber } = makeAmqpConnectionMock();
      createSubscriber.mockResolvedValue({ consumerTag: 'tag-1' });
      const gateway = new RabbitMqQueueGateway(amqpConnection);
      const handler = vi.fn().mockResolvedValue(undefined);

      await gateway.consume('notifications.order-placed', handler);

      expect(createSubscriber).toHaveBeenCalledWith(
        expect.any(Function),
        { queue: 'notifications.order-placed' },
        expect.any(String),
      );
    });

    it('should convert the delivered AMQP message into a QueueMessage before calling the handler', async () => {
      type SubscriberCallback = (
        payload: { orderId: string },
        rawMessage: ConsumeMessage,
      ) => Promise<void> | void;

      const { amqpConnection, createSubscriber } = makeAmqpConnectionMock();
      createSubscriber.mockResolvedValue({ consumerTag: 'tag-1' });
      const gateway = new RabbitMqQueueGateway(amqpConnection);
      const handler = vi.fn().mockResolvedValue(undefined);

      await gateway.consume('notifications.order-placed', handler);

      const subscriberCallback = createSubscriber.mock.calls[0][0] as SubscriberCallback;
      const rawMessage = {
        fields: { routingKey: 'order.placed' },
        properties: { messageId: 'message-1' },
      } as ConsumeMessage;

      await subscriberCallback({ orderId: 'order-1' }, rawMessage);

      expect(handler).toHaveBeenCalledWith({
        messageId: 'message-1',
        routingKey: 'order.placed',
        payload: { orderId: 'order-1' },
      });
    });

    it('should throw a QueueError when createSubscriber rejects', async () => {
      const { amqpConnection, createSubscriber } = makeAmqpConnectionMock();
      createSubscriber.mockRejectedValue(new Error('queue does not exist'));
      const gateway = new RabbitMqQueueGateway(amqpConnection);

      await expect(gateway.consume('notifications.order-placed', vi.fn())).rejects.toThrow(QueueError);
      await expect(gateway.consume('notifications.order-placed', vi.fn())).rejects.toThrow(
        QueueErrorMessagesConsts.CONSUME_QUEUE_ERROR,
      );
    });
  });
});
