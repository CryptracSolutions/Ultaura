import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import { generateStreamToken } from '../../services/stream-token.js';

export function createValidToken(callSessionId: string): string {
  return generateStreamToken(callSessionId);
}

export function createExpiredToken(callSessionId: string): string {
  const exp = Math.floor(Date.now() / 1000) - 60;
  const payload = `${callSessionId}.${exp}`;
  const secret = process.env.ULTAURA_STREAM_TOKEN_SECRET;

  if (!secret) {
    throw new Error('ULTAURA_STREAM_TOKEN_SECRET is required for test helpers');
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

export function createInvalidToken(callSessionId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 300;
  return `${callSessionId}.${exp}.invalidSignature123`;
}

export function createTwilioIpRequest(): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '168.86.128.1' } as any,
    headers: {},
  };
}

export function createNonTwilioIpRequest(): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '203.0.113.50' } as any,
    headers: {},
  };
}

export function createProxiedRequest(ip: string): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '127.0.0.1' } as any,
    headers: { 'x-forwarded-for': ip },
  };
}

export function withFrozenTime<T>(timestamp: number, fn: () => T): T {
  const realDateNow = Date.now;
  Date.now = () => timestamp;
  try {
    return fn();
  } finally {
    Date.now = realDateNow;
  }
}
