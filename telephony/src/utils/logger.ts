import pino from 'pino';

const pinoLogger = pino as unknown as typeof import('pino').default;

export const logger = pinoLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
