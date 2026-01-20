import 'dotenv/config';
import pino from 'pino';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import { getLogContext } from '../observability/log-context.js';

const pinoLogger = pino as unknown as typeof import('pino').default;

const isDebug = process.env.ULTAURA_DEBUG === 'true';
const logLevel = process.env.LOG_LEVEL || (isDebug ? 'debug' : 'info');
const isProduction = process.env.NODE_ENV === 'production';
const prettySetting = process.env.ULTAURA_LOG_PRETTY;
const prettyEnabled = prettySetting === 'true' || (!isProduction && prettySetting !== 'false');

export const logger = pinoLogger({
  level: logLevel,
  mixin() {
    const context = getLogContext();
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    const traceFields = spanContext && isSpanContextValid(spanContext)
      ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
      : {};
    return {
      ...(context ?? {}),
      ...traceFields,
    };
  },
  ...(prettyEnabled
    ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    }
    : {}),
});
