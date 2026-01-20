# Ultaura Telephony Dashboards and Alerts

This document defines PromQL queries for key voice SLOs/SLIs. Adjust lookback windows and thresholds to match your traffic patterns.

## Panels

### Time to first audio (p50/p90/p99)
```
histogram_quantile(0.50, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
histogram_quantile(0.90, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
histogram_quantile(0.99, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[5m])) by (le, direction, isReminderCall))
```

### Disconnect rate by reason
```
sum(rate(ultaura_voice_disconnect_total[5m])) by (reason)
```

### Disconnect reason % breakdown
```
100 * sum(rate(ultaura_voice_disconnect_total[5m])) by (reason)
  / sum(rate(ultaura_voice_disconnect_total[5m]))
```

### Tool error rate by toolName
```
(sum(rate(ultaura_voice_tool_errors_total[5m])) by (toolName))
  / (sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName))
```

### Tool error rate (top tools by volume)
```
(
  sum(rate(ultaura_voice_tool_errors_total[5m])) by (toolName)
  / sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName)
)
* on (toolName) group_left
  topk(5, sum(rate(ultaura_voice_tool_calls_total[5m])) by (toolName))
```

### Barge-in rate
```
sum(rate(ultaura_voice_barge_in_total[5m]))
```

## Alerts (examples)

### Sustained p95 time-to-first-audio regression
```
histogram_quantile(0.95, sum(rate(ultaura_voice_time_to_first_audio_ms_bucket[10m])) by (le)) > 2000
```

### Spike in Twilio/Grok disconnects
```
sum(rate(ultaura_voice_disconnect_total{reason=~"twilio_failed|grok_error"}[5m])) > 0.2
```

### Tool error rate > 5% (guarded by call volume)
```
(
  sum(rate(ultaura_voice_tool_errors_total[10m])) by (toolName)
  / sum(rate(ultaura_voice_tool_calls_total[10m])) by (toolName)
) > 0.05
and
sum(rate(ultaura_voice_tool_calls_total[10m])) by (toolName) > 0.1
```
