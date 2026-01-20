import { AsyncLocalStorage } from 'node:async_hooks';

export type LogContext = {
  callSessionId?: string;
  twilioCallSid?: string;
  twilioStreamSid?: string;
};

const logContextStorage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return logContextStorage.run(context, fn);
}

export function withLogContext<T extends (...args: any[]) => any>(
  context: LogContext,
  fn: T
): T {
  return ((...args: Parameters<T>) =>
    logContextStorage.run(context, () => fn(...args))) as T;
}

export function bindLogContext<T extends (...args: any[]) => any>(fn: T): T {
  const store = logContextStorage.getStore();
  if (!store) {
    return fn;
  }
  return withLogContext(store, fn);
}

export function getLogContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

export function updateLogContext(next: LogContext): void {
  const store = logContextStorage.getStore();
  if (!store) {
    return;
  }
  Object.assign(store, next);
}
