# Ultaura Telephony Observability

This document describes logging, correlation IDs, metrics, and tracing for the telephony service.

## Logging

- Production defaults to structured JSON logs (no pretty formatting).
- Pretty logs are enabled only when `NODE_ENV` is not `production`, or when `ULTAURA_LOG_PRETTY=true`.
- When tracing is enabled and an active span exists, logs include `traceId` and `spanId`.

### Correlation schema

Use these keys consistently:

- `callSessionId`: internal UUID for a call session.
- `twilioCallSid`: Twilio CallSid (from webhooks and media stream start event).
- `twilioStreamSid`: Twilio Media Stream streamSid (from media stream start event).

Source of values:

- `twilioCallSid`: `CallSid` in Twilio webhooks and `start.callSid` in media streams.
- `twilioStreamSid`: `start.streamSid` in media streams.
- `callSessionId`: internal session ID from `ultaura_call_sessions`.

## Metrics

Metrics are exposed at `/internal/metrics` (requires `X-Webhook-Secret`).

### Voice product SLO/SLI metrics

- `ultaura_voice_time_to_first_audio_ms` (Histogram)
  - Start: Twilio media stream `start` event received.
  - End: first Grok `response.audio.delta` forwarded to Twilio.
  - Labels: `direction` (inbound|outbound), `isReminderCall` (true|false).
- `ultaura_voice_barge_in_total` (Counter)
  - Incremented on Grok `input_audio_buffer.speech_started` that triggers barge-in handling.
- `ultaura_voice_disconnect_total` (Counter)
  - Counted once per call session, first terminal signal wins.
  - Reasons: `ws_close`, `twilio_completed`, `twilio_failed`, `grok_error`, `grok_close`, `pod_failure`, `other`.
  - `ws_close` is treated as a fallback (recorded after a short delay) so Twilio status callbacks can attribute `twilio_completed`/`twilio_failed` when they arrive.
  - Double counting is prevented by a short-lived per-session registry.
- `ultaura_voice_tool_calls_total` (Counter)
  - Incremented per Grok tool invocation; label `toolName`.
- `ultaura_voice_tool_errors_total` (Counter)
  - Incremented on tool failures (HTTP non-2xx, explicit failure response, or thrown error); label `toolName`.

### Scheduler outcome metrics

- `ultaura_scheduler_schedule_outcomes_total` (Counter)
  - Outcomes: `success`, `missed`, `skipped`, `failed`, `suppressed_quiet_hours`, `suppressed_vacation`.
- `ultaura_scheduler_reminder_outcomes_total` (Counter)
  - Outcomes: `success`, `missed`, `suppressed_vacation`, `failed`.

## Tracing (OpenTelemetry)

Tracing is off by default. Enable with:

```
ULTAURA_OTEL_ENABLED=true
```

Configure OTLP gRPC exporter endpoint:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
# or
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://collector:4317
# or
ULTAURA_OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
```

Sampling:

- `ULTAURA_OTEL_SAMPLE_RATE` (float 0-1).
- Default: 1.0 in non-production, 0.05 in production.
- `ULTAURA_OTEL_SHUTDOWN_TIMEOUT_MS` bounds shutdown flush time (default 5000ms).

### Spans

HTTP/Express auto-instrumentation emits SERVER spans for inbound requests, including Twilio webhooks:

- `POST /twilio/voice/inbound`
- `POST /twilio/voice/outbound`
- `POST /twilio/status`
- `POST /twilio/recording-status`

Attributes include `callSessionId` (when known), `twilioCallSid`, `twilioStreamSid`, `http.method`, `http.route`, `http.status_code`.

Twilio Media Streams:

- `twilio.media_stream.session` spans the full WebSocket lifetime.
- Attributes: `callSessionId`, `twilioCallSid`, `twilioStreamSid`.
- Emits `voice.first_audio` event with latency attributes.
- Records `voice.first_audio.latency_ms` on the session span for tail-sampling.

Grok bridge:

- `grok.realtime.connect` covers the connection handshake.
- `grok.realtime.session` spans the Grok WebSocket lifetime.
- Disconnects/errors are recorded as span events.

Tool calls:

- `grok.tool.<toolName>` spans each tool invocation.
- Attributes: `toolName`, `callSessionId`, `twilioCallSid`, `twilioStreamSid`, `http.status_code`.
- Span status is set to ERROR on failures.

### Collector tail sampling

Use `telephony/otel-collector.tail-sampling.example.yaml` as a starting point for tail-sampling in the collector.
It keeps 100% of error traces, samples slow first-audio traces, and applies a baseline probabilistic sample.

Example:

```
otelcol --config telephony/otel-collector.tail-sampling.example.yaml
```

Recommended production approach:

- Keep head sampling low in the app (e.g., `ULTAURA_OTEL_SAMPLE_RATE=0.01`).
- Use tail sampling in the collector to retain errors and latency outliers.

## Correlating logs and traces

When tracing is enabled, logs include `traceId`/`spanId`. You can:

- Filter logs by `callSessionId` to isolate a call path.
- Use `traceId` from logs to jump into traces.

## Dashboards and alerts

This section provides example PromQL panels and alert queries for the core voice SLOs/SLIs.
Adjust lookback windows and thresholds to match your traffic patterns.

### Panels

#### Time to first audio (p50/p90/p99)

```
histogram_quantile(0.50, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
histogram_quantile(0.90, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
histogram_quantile(0.99, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
```

#### Disconnect rate by reason

```
sum(rate(ultaura_voice_disconnect_total[5m])) by (reason)
```

#### Disconnect reason % breakdown

```
100 * sum(rate(ultaura_voice_disconnect_total[5m])) by (reason)
  / sum(rate(ultaura_voice_disconnect_total[5m]))
```

#### Tool error rate by toolName

```
(sum(rate(ultaura_voice_tool_errors_total[5m])) by (toolName))
  / (sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName))
```

#### Tool error rate (top tools by volume)

```
(
  sum(rate(ultaura_voice_tool_errors_total[5m])) by (toolName)
  / sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName)
)
* on (toolName) group_left
  topk(5, sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName))
```

#### Barge-in rate

```
sum(rate(ultaura_voice_barge_in_total[5m]))
```

### Alerts (examples)

#### Sustained p95 time-to-first-audio regression

```
histogram_quantile(0.95, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[10m])) by (le)) > 2000
```

#### Spike in Twilio/Grok disconnects

```
sum(rate(ultaura_voice_disconnect_total{reason=~"twilio_failed|grok_error"}[5m])) > 0.2
```

#### Tool error rate > 5% (guarded by call volume)

```
(
  sum(rate(ultaura_voice_tool_errors_total[10m])) by (toolName)
  / sum(rate(ultaura_voice_tool_calls_total[10m])) by (toolName)
) > 0.05
and
sum(rate(ultaura_voice_tool_calls_total[10m])) by (toolName) > 0.1
```
