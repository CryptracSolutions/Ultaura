import 'dotenv/config';
import pino from 'pino';

const pinoLogger = pino as unknown as typeof import('pino').default;

const isDebug = process.env.ULTAURA_DEBUG === 'true';
const logLevel = process.env.LOG_LEVEL || (isDebug ? 'debug' : 'info');

export const logger = pinoLogger({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
