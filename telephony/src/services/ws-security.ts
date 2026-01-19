import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { validateStreamToken } from './stream-token.js';
import { sendSecurityAlert } from './ws-security-alerts.js';

const DEFAULT_TWILIO_IP_RANGES = [
  '168.86.128.0/18',
  '34.203.254.0/24',
  '3.235.111.128/25',
];

interface IpCheckResult {
  allowed: boolean;
  reason: 'twilio' | 'override' | 'development' | 'unknown';
  ip: string;
}

interface SecurityValidationResult {
  allowed: boolean;
  ipCheck: IpCheckResult;
  tokenCheck: {
    valid: boolean;
    reason: string;
  };
  connectionCapCheck: {
    allowed: boolean;
    reason: 'first' | 'duplicate';
  };
  mode: 'audit' | 'enforce';
}

const activeConnections = new Map<string, WebSocket>();
const CONNECTION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  for (const [callSessionId, ws] of activeConnections.entries()) {
    if (ws.readyState !== WebSocket.OPEN) {
      activeConnections.delete(callSessionId);
    }
  }
}, CONNECTION_CLEANUP_INTERVAL_MS);

cleanupTimer.unref?.();

function getSecurityMode(): 'audit' | 'enforce' {
  const mode = process.env.ULTAURA_WS_SECURITY_MODE?.toLowerCase();
  return mode === 'enforce' ? 'enforce' : 'audit';
}

function ipToBigInt(ip: string): bigint | null {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return (BigInt(parts[0]) << 24n) |
    (BigInt(parts[1]) << 16n) |
    (BigInt(parts[2]) << 8n) |
    BigInt(parts[3]);
}

function parseCIDR(cidr: string): { network: bigint; mask: bigint } | null {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number.parseInt(prefixStr, 10);

  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }

  const ipNum = ipToBigInt(ip);
  if (ipNum === null) {
    return null;
  }

  const mask = prefix === 0
    ? 0n
    : (0xffffffffn << BigInt(32 - prefix)) & 0xffffffffn;

  return { network: ipNum & mask, mask };
}

function isIpInCIDR(ip: string, cidr: string): boolean {
  const ipNum = ipToBigInt(ip);
  const range = parseCIDR(cidr);

  if (ipNum === null || range === null) {
    return false;
  }

  return (ipNum & range.mask) === range.network;
}

function getTwilioIpRanges(): string[] {
  const override = process.env.TWILIO_MEDIA_IP_ALLOWLIST;
  if (override) {
    return override.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return DEFAULT_TWILIO_IP_RANGES;
}

function checkIpAllowlist(ip: string): IpCheckResult {
  if (process.env.TWILIO_MEDIA_IP_ALLOW_UNKNOWN?.toLowerCase() === 'true') {
    return { allowed: true, reason: 'development', ip };
  }

  const ranges = getTwilioIpRanges();
  const isOverride = Boolean(process.env.TWILIO_MEDIA_IP_ALLOWLIST);

  for (const range of ranges) {
    if (isIpInCIDR(ip, range)) {
      return {
        allowed: true,
        reason: isOverride ? 'override' : 'twilio',
        ip,
      };
    }
  }

  return { allowed: false, reason: 'unknown', ip };
}

function extractClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(',')[0];
    return first.trim().replace(/^::ffff:/, '');
  }

  const remoteAddr = req.socket.remoteAddress || 'unknown';
  return remoteAddr.replace(/^::ffff:/, '');
}

export function registerConnection(callSessionId: string, ws: WebSocket): boolean {
  const existing = activeConnections.get(callSessionId);
  if (existing) {
    if (existing.readyState === WebSocket.OPEN) {
      return false;
    }
    activeConnections.delete(callSessionId);
  }

  activeConnections.set(callSessionId, ws);
  return true;
}

export function unregisterConnection(callSessionId: string, ws: WebSocket): void {
  const existing = activeConnections.get(callSessionId);
  if (!existing || existing !== ws) {
    return;
  }

  activeConnections.delete(callSessionId);
}

function hasActiveConnection(callSessionId: string): boolean {
  const existing = activeConnections.get(callSessionId);
  if (!existing) {
    return false;
  }

  if (existing.readyState === WebSocket.OPEN) {
    return true;
  }

  activeConnections.delete(callSessionId);
  return false;
}

function logSecurityEvent(callSessionId: string, result: SecurityValidationResult): void {
  const allChecksPass =
    result.ipCheck.allowed &&
    result.tokenCheck.valid &&
    result.connectionCapCheck.allowed;
  const eventType = allChecksPass ? 'ws_security_pass' : 'ws_security_fail';
  const level = allChecksPass ? 'info' : 'warn';

  logger[level]({
    event: eventType,
    callSessionId,
    mode: result.mode,
    ip: {
      address: result.ipCheck.ip,
      allowed: result.ipCheck.allowed,
      reason: result.ipCheck.reason,
    },
    token: {
      valid: result.tokenCheck.valid,
      reason: result.tokenCheck.reason,
    },
    connectionCap: {
      allowed: result.connectionCapCheck.allowed,
      reason: result.connectionCapCheck.reason,
    },
  }, `WebSocket security ${eventType}`);
}

export async function validateWebSocketConnection(
  req: IncomingMessage,
  callSessionId: string,
  token: string | null,
  ws: WebSocket
): Promise<SecurityValidationResult> {
  const mode = getSecurityMode();
  const clientIp = extractClientIp(req);

  const ipCheck = checkIpAllowlist(clientIp);
  const tokenCheck = validateStreamToken(token, callSessionId);

  const hasExisting = hasActiveConnection(callSessionId);
  const connectionCapCheck: SecurityValidationResult['connectionCapCheck'] = {
    allowed: !hasExisting,
    reason: hasExisting ? 'duplicate' : 'first',
  };

  const allChecksPass =
    ipCheck.allowed &&
    tokenCheck.valid &&
    connectionCapCheck.allowed;

  const result: SecurityValidationResult = {
    allowed: mode === 'audit' ? true : allChecksPass,
    ipCheck,
    tokenCheck: {
      valid: tokenCheck.valid,
      reason: tokenCheck.reason,
    },
    connectionCapCheck,
    mode,
  };

  if (result.allowed) {
    if (mode === 'audit') {
      if (!hasExisting) {
        registerConnection(callSessionId, ws);
      }
    } else if (connectionCapCheck.allowed) {
      registerConnection(callSessionId, ws);
    }
  }

  logSecurityEvent(callSessionId, result);

  const shouldAlert =
    !ipCheck.allowed ||
    connectionCapCheck.reason === 'duplicate' ||
    (ipCheck.allowed && tokenCheck.reason === 'invalid_signature') ||
    (ipCheck.allowed && tokenCheck.reason === 'malformed');

  if (shouldAlert) {
    await sendSecurityAlert(callSessionId, result);
  }

  return result;
}

export type { SecurityValidationResult };
