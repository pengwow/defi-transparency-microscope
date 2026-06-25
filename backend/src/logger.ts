import { pino, type Logger, type LoggerOptions } from 'pino';

export function createLogger(level: string = process.env.LOG_LEVEL ?? 'info'): Logger {
  const isDev = process.env.NODE_ENV !== 'production' && process.stdout.isTTY;
  const options: LoggerOptions = {
    level,
    base: { service: 'dtm-backend' },
  };
  if (isDev) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service',
      },
    };
  }
  return pino(options);
}

export const logger: Logger = createLogger();
