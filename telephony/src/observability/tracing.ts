import {
  context,
  trace,
  SpanKind,
  SpanStatusCode,
  type Attributes,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
import type { ExpressInstrumentationConfig } from '@opentelemetry/instrumentation-express';
import type { HttpInstrumentationConfig } from '@opentelemetry/instrumentation-http';
import type { InMemorySpanExporter, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogContext } from './log-context.js';

const SERVICE_NAME = 'ultaura-telephony';
const HTTP_INSTRUMENTATION = '@opentelemetry/instrumentation-http';
const EXPRESS_INSTRUMENTATION = '@opentelemetry/instrumentation-express';
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/;
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_QUERY_KEYS = new Set(['From', 'To', 'Caller', 'Called', 'from', 'to', 'caller', 'called']);

export const isTracingEnabled = process.env.ULTAURA_OTEL_ENABLED === 'true';
export const tracer = trace.getTracer(SERVICE_NAME);

let tracingInitialized = false;
let nodeSdk: import('@opentelemetry/sdk-node').NodeSDK | undefined;
let testSpanExporter: InMemorySpanExporter | undefined;
let activeInstrumentationNames: string[] | undefined;

const require = createRequire(import.meta.url);

function resolveOtlpEndpoint(): string | undefined {
  return process.env.ULTAURA_OTEL_EXPORTER_OTLP_ENDPOINT
    ?? process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
}

function resolveSampleRate(): number {
  const fallback = process.env.NODE_ENV === 'production' ? 0.05 : 1;
  const raw = process.env.ULTAURA_OTEL_SAMPLE_RATE;
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

function loadPackageVersion(filePath: string): string | undefined {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { name?: string; version?: string };
    if (parsed.name === '@ultaura/telephony' && parsed.version) {
      return parsed.version;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveServiceVersion(): string | undefined {
  const cwdCandidate = loadPackageVersion(join(process.cwd(), 'package.json'));
  if (cwdCandidate) {
    return cwdCandidate;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return loadPackageVersion(resolve(moduleDir, '../../package.json'));
}

function resolveTraceExporter(): SpanExporter {
  if (process.env.ULTAURA_OTEL_TEST_EXPORTER === 'in-memory') {
    const { InMemorySpanExporter } = require('@opentelemetry/sdk-trace-base') as typeof import('@opentelemetry/sdk-trace-base');
    testSpanExporter = new InMemorySpanExporter();
    return testSpanExporter;
  }

  const exporterEndpoint = resolveOtlpEndpoint();
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc') as typeof import('@opentelemetry/exporter-trace-otlp-grpc');
  return new OTLPTraceExporter(exporterEndpoint ? { url: exporterEndpoint } : undefined);
}

function extractCorrelationFromRequest(request: { url?: string; headers?: Record<string, unknown>; query?: unknown; body?: unknown; }): LogContext {
  const context: LogContext = {};
  const query = request.query && typeof request.query === 'object'
    ? request.query as Record<string, unknown>
    : undefined;
  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : undefined;

  if (query && typeof query.callSessionId === 'string') {
    context.callSessionId = query.callSessionId;
  }

  if (body) {
    if (typeof body.callSessionId === 'string') {
      context.callSessionId = body.callSessionId;
    }
    if (typeof body.CallSid === 'string') {
      context.twilioCallSid = body.CallSid;
    }
    if (typeof body.StreamSid === 'string') {
      context.twilioStreamSid = body.StreamSid;
    }
  }

  if (!context.callSessionId && typeof request.url === 'string') {
    const host = typeof request.headers?.host === 'string' ? request.headers.host : 'localhost';
    try {
      const url = new URL(request.url, `http://${host}`);
      const callSessionId = url.searchParams.get('callSessionId');
      if (callSessionId) {
        context.callSessionId = callSessionId;
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return context;
}

function applyCorrelationAttributes(span: Span, context: LogContext): void {
  if (context.callSessionId) {
    span.setAttribute('callSessionId', context.callSessionId);
  }
  if (context.twilioCallSid) {
    span.setAttribute('twilioCallSid', context.twilioCallSid);
  }
  if (context.twilioStreamSid) {
    span.setAttribute('twilioStreamSid', context.twilioStreamSid);
  }
}

function headerString(headers: unknown, key: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const value = (headers as Record<string, unknown>)[key];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function resolveRequestScheme(request: unknown): 'http' | 'https' {
  if (request && typeof request === 'object') {
    const headers = (request as { headers?: unknown }).headers;
    const forwardedProto = headerString(headers, 'x-forwarded-proto');
    if (forwardedProto) {
      const value = forwardedProto.split(',')[0]?.trim().toLowerCase();
      if (value === 'https') {
        return 'https';
      }
      if (value === 'http') {
        return 'http';
      }
    }

    const encrypted = (request as { socket?: { encrypted?: unknown } }).socket?.encrypted;
    if (encrypted === true) {
      return 'https';
    }
  }

  return 'http';
}

function sanitizeUrlForSpan(request: unknown): { target: string; query: string; url: string } | undefined {
  if (!request || typeof request !== 'object') {
    return undefined;
  }

  const rawUrl = (request as { url?: unknown }).url;
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return undefined;
  }

  const headers = (request as { headers?: unknown }).headers;
  const host = headerString(headers, 'host');
  const scheme = resolveRequestScheme(request);
  const base = host ? `${scheme}://${host}` : `${scheme}://localhost`;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl, base);
  } catch {
    return undefined;
  }

  const originalParams = Array.from(parsed.searchParams.entries());
  const sanitizedParams = new URLSearchParams();
  for (const [key, value] of originalParams) {
    const shouldRedact = SENSITIVE_QUERY_KEYS.has(key) || PHONE_PATTERN.test(value);
    sanitizedParams.append(key, shouldRedact ? REDACTED_VALUE : value);
  }

  parsed.search = sanitizedParams.toString();

  const query = sanitizedParams.toString();
  const target = query ? `${parsed.pathname}?${query}` : parsed.pathname;
  const url = host ? parsed.toString() : target;

  return { target, query, url };
}

function applyUrlRedaction(span: Span, request: unknown): void {
  const sanitized = sanitizeUrlForSpan(request);
  if (!sanitized) {
    return;
  }

  // Overwrite common URL attributes to ensure query PII is never exported.
  span.setAttribute('http.target', sanitized.target);
  span.setAttribute('url.query', sanitized.query);
  span.setAttribute('http.url', sanitized.url);
}

function buildInstrumentations() {
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node') as typeof import('@opentelemetry/auto-instrumentations-node');
  const httpConfig: HttpInstrumentationConfig = {
    headersToSpanAttributes: {
      client: { requestHeaders: [], responseHeaders: [] },
      server: { requestHeaders: [], responseHeaders: [] },
    },
    redactedQueryParams: ['From', 'To', 'Caller', 'Called', 'from', 'to'],
    requestHook: (span, request) => {
      const correlation = extractCorrelationFromRequest(request as {
        url?: string;
        headers?: Record<string, unknown>;
        query?: unknown;
        body?: unknown;
      });
      applyCorrelationAttributes(span, correlation);
    },
    applyCustomAttributesOnSpan: (span, request) => {
      applyUrlRedaction(span, request);
    },
  };

  const expressConfig: ExpressInstrumentationConfig = {
    requestHook: (span, info) => {
      const correlation = extractCorrelationFromRequest(info.request as {
        url?: string;
        headers?: Record<string, unknown>;
        query?: unknown;
        body?: unknown;
      });
      applyCorrelationAttributes(span, correlation);
    },
  };

  const instrumentations = getNodeAutoInstrumentations({
    [HTTP_INSTRUMENTATION]: httpConfig,
    [EXPRESS_INSTRUMENTATION]: expressConfig,
  });

  const allowed = new Set([HTTP_INSTRUMENTATION, EXPRESS_INSTRUMENTATION]);
  return instrumentations.filter((instrumentation) => allowed.has(instrumentation.instrumentationName));
}

export function initTracing(): void {
  if (tracingInitialized) {
    return;
  }
  tracingInitialized = true;

  if (!isTracingEnabled) {
    return;
  }

  const { resourceFromAttributes } = require('@opentelemetry/resources') as typeof import('@opentelemetry/resources');
  const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions') as typeof import('@opentelemetry/semantic-conventions');
  const { ParentBasedSampler, TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base') as typeof import('@opentelemetry/sdk-trace-base');
  const { NodeSDK } = require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
  const { AsyncLocalStorageContextManager } = require('@opentelemetry/context-async-hooks') as typeof import('@opentelemetry/context-async-hooks');

  testSpanExporter = undefined;
  const serviceVersion = resolveServiceVersion();
  const resourceAttributes: Attributes = {
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
  };
  if (serviceVersion) {
    resourceAttributes[SemanticResourceAttributes.SERVICE_VERSION] = serviceVersion;
  }

  const sdk = new NodeSDK({
    autoDetectResources: false,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(resolveSampleRate()),
    }),
    resource: resourceFromAttributes(resourceAttributes),
    traceExporter: resolveTraceExporter(),
    instrumentations: (() => {
      const instrumentations = buildInstrumentations();
      activeInstrumentationNames = instrumentations.map((instrumentation) => instrumentation.instrumentationName);
      return instrumentations;
    })(),
    contextManager: new AsyncLocalStorageContextManager(),
  });

  sdk.start();
  nodeSdk = sdk;
}

export async function shutdownTracing(): Promise<void> {
  if (!isTracingEnabled || !nodeSdk) {
    return;
  }

  await nodeSdk.shutdown();
  nodeSdk = undefined;
  activeInstrumentationNames = undefined;
}

export function getTestSpanExporter(): InMemorySpanExporter | undefined {
  return testSpanExporter;
}

export function getActiveInstrumentationNames(): string[] | undefined {
  return activeInstrumentationNames ? [...activeInstrumentationNames] : undefined;
}

export const __internal = {
  sanitizeUrlForSpan,
  applyUrlRedaction,
};

export async function withSpan<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span | undefined) => Promise<T> | T
): Promise<T> {
  if (!isTracingEnabled) {
    return await fn(undefined);
  }

  return tracer.startActiveSpan(name, options, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function startSpan(name: string, options?: SpanOptions): Span | undefined {
  if (!isTracingEnabled) {
    return undefined;
  }
  return tracer.startSpan(name, options);
}

export function runWithSpan<T>(span: Span | undefined, fn: () => T): T {
  if (!isTracingEnabled || !span) {
    return fn();
  }

  return context.with(trace.setSpan(context.active(), span), fn);
}

export { SpanKind, SpanStatusCode };
