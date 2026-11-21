import { Logger as NestLogger } from '@nestjs/common';

import { EnvService } from '@/infra/shared/env/env.service';

import { NestLoggerAdapter } from './nest-logger.adapter';

function makeEnvServiceMock(): EnvService {
  return { get: vi.fn().mockReturnValue('test') } as unknown as EnvService;
}

describe('[NestLoggerAdapter]', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log only the message when no meta is given', () => {
    const errorSpy = vi.spyOn(NestLogger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = new NestLoggerAdapter(makeEnvServiceMock());

    adapter.error('Failed to publish domain event "order.placed"');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Failed to publish domain event "order.placed"');
  });

  it('should append the serialized meta to the message, readably formatted', () => {
    const errorSpy = vi.spyOn(NestLogger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = new NestLoggerAdapter(makeEnvServiceMock());
    const meta = { eventName: 'order.placed', exchange: 'orders.events' };

    adapter.error('Failed to publish domain event "order.placed"', meta);

    expect(errorSpy).toHaveBeenCalledWith(
      `Failed to publish domain event "order.placed"\n${JSON.stringify(meta, null, 2)}`,
    );
  });

  it('should not collapse the serialized meta into a single unreadable line', () => {
    const errorSpy = vi.spyOn(NestLogger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = new NestLoggerAdapter(makeEnvServiceMock());

    adapter.error('failed', { foo: 'bar', nested: { baz: 1 } });

    const [loggedMessage] = errorSpy.mock.calls[0] as unknown as string;
    expect(loggedMessage).toContain('\n');
  });
});
