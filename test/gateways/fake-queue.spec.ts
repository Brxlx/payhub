import { makeQueueMessageFactory } from 'test/factories/make-queue-message';

import { QueueErrorMessagesConsts } from '@/core/consts/queue.consts';
import { QueueError } from '@/domain/application/shared/errors/queue.error';

import { FakeQueue } from './fake-queue';

describe('[FakeQueue]', () => {
  let fakeQueue: FakeQueue;

  beforeEach(() => {
    fakeQueue = new FakeQueue();
  });

  describe('publish', () => {
    it('should record a published message alongside its exchange', async () => {
      const message = makeQueueMessageFactory();

      await fakeQueue.publish('orders.events', message);

      expect(fakeQueue.publishedMessages).toEqual([{ exchange: 'orders.events', message }]);
    });

    it('should keep publishedMessages in the order they were published', async () => {
      const first = makeQueueMessageFactory({ messageId: 'message-1' });
      const second = makeQueueMessageFactory({ messageId: 'message-2' });

      await fakeQueue.publish('orders.events', first);
      await fakeQueue.publish('orders.events', second);

      expect(fakeQueue.publishedMessages.map((entry) => entry.message.messageId)).toEqual([
        'message-1',
        'message-2',
      ]);
    });

    it('should throw a default QueueError when a publish failure is set without a custom error', async () => {
      fakeQueue.setPublishFailure();

      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow(QueueError);
      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow(
        QueueErrorMessagesConsts.SEND_TO_QUEUE_ERROR,
      );
    });

    it('should throw the custom error passed to setPublishFailure', async () => {
      const customError = new Error('broker unreachable');

      fakeQueue.setPublishFailure(customError);

      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow(
        customError,
      );
    });

    it('should not record the message when publish fails', async () => {
      fakeQueue.setPublishFailure();

      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow();

      expect(fakeQueue.publishedMessages).toHaveLength(0);
    });

    it('should keep failing on every call until clearPublishFailure is called', async () => {
      fakeQueue.setPublishFailure();

      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow();
      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).rejects.toThrow();

      fakeQueue.clearPublishFailure();

      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).resolves.toBeUndefined();
      expect(fakeQueue.publishedMessages).toHaveLength(1);
    });
  });

  describe('consume + deliverTo', () => {
    it('should deliver a message to the handler registered for that queue', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const message = makeQueueMessageFactory();

      await fakeQueue.consume('notifications.order-placed', handler);
      await fakeQueue.deliverTo('notifications.order-placed', message);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should not deliver to a handler registered for a different queue', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await fakeQueue.consume('notifications.order-placed', handler);

      await expect(fakeQueue.deliverTo('analytics.order-placed', makeQueueMessageFactory())).rejects.toThrow(
        QueueError,
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw a QueueError when delivering to a queue with no registered consumer', async () => {
      await expect(
        fakeQueue.deliverTo('notifications.order-placed', makeQueueMessageFactory()),
      ).rejects.toThrow(QueueError);
    });

    it('should let the caller observe a handler rejection (a failed delivery)', async () => {
      const handlerError = new Error('handler blew up');
      const handler = vi.fn().mockRejectedValue(handlerError);

      await fakeQueue.consume('notifications.order-placed', handler);

      await expect(
        fakeQueue.deliverTo('notifications.order-placed', makeQueueMessageFactory()),
      ).rejects.toThrow(handlerError);
    });

    it("should replace a queue's handler when consume is called again for the same queue name", async () => {
      const firstHandler = vi.fn().mockResolvedValue(undefined);
      const secondHandler = vi.fn().mockResolvedValue(undefined);
      const message = makeQueueMessageFactory();

      await fakeQueue.consume('notifications.order-placed', firstHandler);
      await fakeQueue.consume('notifications.order-placed', secondHandler);
      await fakeQueue.deliverTo('notifications.order-placed', message);

      expect(firstHandler).not.toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalledTimes(1);
      expect(secondHandler).toHaveBeenCalledWith(message);
    });
  });

  describe('reset', () => {
    it('should clear published messages, registered consumers and any pending publish failure', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await fakeQueue.consume('notifications.order-placed', handler);
      await fakeQueue.publish('orders.events', makeQueueMessageFactory());
      fakeQueue.setPublishFailure();

      fakeQueue.reset();

      expect(fakeQueue.publishedMessages).toHaveLength(0);
      await expect(
        fakeQueue.deliverTo('notifications.order-placed', makeQueueMessageFactory()),
      ).rejects.toThrow(QueueError);
      await expect(fakeQueue.publish('orders.events', makeQueueMessageFactory())).resolves.toBeUndefined();
    });
  });
});
