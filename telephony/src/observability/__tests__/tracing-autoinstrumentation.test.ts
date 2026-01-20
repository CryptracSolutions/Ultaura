import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  ULTAURA_OTEL_ENABLED: process.env.ULTAURA_OTEL_ENABLED,
  ULTAURA_OTEL_TEST_EXPORTER: process.env.ULTAURA_OTEL_TEST_EXPORTER,
  ULTAURA_OTEL_SAMPLE_RATE: process.env.ULTAURA_OTEL_SAMPLE_RATE,
};

afterEach(() => {
  if (ORIGINAL_ENV.ULTAURA_OTEL_ENABLED === undefined) {
    delete process.env.ULTAURA_OTEL_ENABLED;
  } else {
    process.env.ULTAURA_OTEL_ENABLED = ORIGINAL_ENV.ULTAURA_OTEL_ENABLED;
  }

  if (ORIGINAL_ENV.ULTAURA_OTEL_TEST_EXPORTER === undefined) {
    delete process.env.ULTAURA_OTEL_TEST_EXPORTER;
  } else {
    process.env.ULTAURA_OTEL_TEST_EXPORTER = ORIGINAL_ENV.ULTAURA_OTEL_TEST_EXPORTER;
  }

  if (ORIGINAL_ENV.ULTAURA_OTEL_SAMPLE_RATE === undefined) {
    delete process.env.ULTAURA_OTEL_SAMPLE_RATE;
  } else {
    process.env.ULTAURA_OTEL_SAMPLE_RATE = ORIGINAL_ENV.ULTAURA_OTEL_SAMPLE_RATE;
  }
});

describe('tracing auto-instrumentation', () => {
  it('emits HTTP spans when enabled', async () => {
    process.env.ULTAURA_OTEL_ENABLED = 'true';
    process.env.ULTAURA_OTEL_TEST_EXPORTER = 'in-memory';
    process.env.ULTAURA_OTEL_SAMPLE_RATE = '1';

    vi.resetModules();
    const tracing = await import('../tracing.js');
    tracing.initTracing();

    const names = tracing.getActiveInstrumentationNames();
    expect(names).toEqual(expect.arrayContaining([
      '@opentelemetry/instrumentation-http',
      '@opentelemetry/instrumentation-express',
    ]));

    await tracing.shutdownTracing();
  });

  it('does not initialize auto-instrumentation when disabled', async () => {
    process.env.ULTAURA_OTEL_ENABLED = 'false';
    process.env.ULTAURA_OTEL_TEST_EXPORTER = 'in-memory';

    vi.resetModules();
    const tracing = await import('../tracing.js');
    tracing.initTracing();

    expect(tracing.getActiveInstrumentationNames()).toBeUndefined();
  });
});
