export const QueueErrorMessagesConsts = {
  INITIALIZING_QUEUE_ERROR: 'Error initialing queue, check credentials',
  SEND_TO_QUEUE_ERROR: 'Error sending message to queue',
  CONSUME_QUEUE_ERROR: 'Error trying to consume from queue',
} as const;

export const MAX_CONSUME_ATTEMPTS = 3;
export const CONSUME_QUEUE_TIMEOUT = 1000;
