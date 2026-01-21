# Telephony Deployment Notes

## Multi-instance requirements

Ultaura telephony maintains per-call state in memory (the active Grok bridge). For horizontal scaling:

1. **Twilio Media Streams must use sticky sessions** so reconnects land on the same pod.
2. **Tool calls must avoid cross-pod routing** so in-memory bridge lookups work reliably.

See `k8s/*.example.yaml` for complete Kubernetes manifests.

## Sticky sessions (Twilio Media Streams)

Twilio connects to the WebSocket endpoint at:

- `WS /twilio/media?callSessionId=<uuid>&token=<hmac>`

For multi-pod deployments, configure session affinity by hashing on the `callSessionId` query param.

### Kubernetes (NGINX Ingress)

```yaml
metadata:
  annotations:
    # REQUIRED: Hash by callSessionId for sticky WebSocket sessions
    nginx.ingress.kubernetes.io/upstream-hash-by: "$arg_callSessionId"

    # WebSocket timeouts (calls can last up to 1 hour)
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

See `k8s/ingress.example.yaml` for a complete example.

### Other load balancers

| Load Balancer | Configuration |
|---------------|---------------|
| AWS ALB | Use `stickiness.enabled=true` with query string routing |
| GCP HTTPS LB | Use `sessionAffinity: CLIENT_IP` or header-based affinity |
| HAProxy | `balance url_param callSessionId` |
| Traefik | `sticky.cookie` with query param extraction |

## Pod-local tool calls

The Grok bridge makes HTTP tool calls back into the telephony service. In multi-pod deployments, set:

```bash
ULTAURA_INTERNAL_BACKEND_URL=http://127.0.0.1:3001
```

This is **set by default in the Dockerfile** so tool calls stay on the same pod even if `ULTAURA_BACKEND_URL` points at a load balancer.

## Operational alerts

Telephony emits anomaly alerts to `/api/telephony/alerts` when routing issues are detected:

| Alert Type | Severity | Cause |
|------------|----------|-------|
| `routing_bridge_missing_on_reconnect` | High | Twilio reconnected to wrong pod (sticky sessions misconfigured) |
| `routing_bridge_missing_for_tool` | High | Tool call routed to wrong pod (ULTAURA_INTERNAL_BACKEND_URL not set) |

Monitor `ultaura_voice_routing_issues_total` Prometheus counter for these events.

## Graceful shutdown

The server drains active WebSocket connections on SIGTERM/SIGINT (30s max). Configure:

```yaml
spec:
  terminationGracePeriodSeconds: 35  # 30s drain + 5s buffer
  containers:
    - lifecycle:
        preStop:
          exec:
            command: ["sleep", "5"]  # Allow LB to stop routing
```

