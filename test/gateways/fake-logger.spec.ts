import { FakeLogger } from './fake-logger';

describe('[FakeLogger]', () => {
  let fakeLogger: FakeLogger;

  beforeEach(() => {
    fakeLogger = new FakeLogger();
  });

  it('should record an error call with its message and meta', () => {
    fakeLogger.error('failed to publish', { eventName: 'order.placed' });

    expect(fakeLogger.errors).toEqual([
      { message: 'failed to publish', meta: { eventName: 'order.placed' } },
    ]);
  });

  it('should record an error call without meta', () => {
    fakeLogger.error('failed to publish');

    expect(fakeLogger.errors).toEqual([{ message: 'failed to publish', meta: undefined }]);
  });

  it('should keep errors in the order they were recorded', () => {
    fakeLogger.error('first failure');
    fakeLogger.error('second failure');

    expect(fakeLogger.errors.map((entry) => entry.message)).toEqual(['first failure', 'second failure']);
  });

  it('should clear recorded errors on reset', () => {
    fakeLogger.error('failed to publish');

    fakeLogger.reset();

    expect(fakeLogger.errors).toHaveLength(0);
  });
});
