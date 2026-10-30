import { Logger } from '@nestjs/common';

export function prefixedLogger(prefix: string, context: string | undefined = undefined) {
  const formattedPrefix = prefix.toUpperCase();
  const toLog =
    typeof context === 'string'
      ? new Logger(`${formattedPrefix}][${context}`)
      : new Logger(`${formattedPrefix}`);

  return toLog;
}
