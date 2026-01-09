// Ultaura Telephony Backend Server
// Main entry point for handling Twilio webhooks and xAI Grok bridge

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

import { twilioInboundRouter } from './routes/twilio-inbound.js';
import { twilioOutboundRouter } from './routes/twilio-outbound.js';
import { twilioStatusRouter } from './routes/twilio-status.js';
import { callsRouter } from './routes/calls.js';
import { toolsRouter } from './routes/tools/index.js';
import { handleMediaStreamConnection } from './websocket/media-stream.js';
import { startScheduler, stopScheduler } from './scheduler/call-scheduler.js';
import { startWeeklySummaryScheduler, stopWeeklySummaryScheduler } from './scheduler/weekly-summary-scheduler.js';
import { verifyRouter } from './routes/verify.js';
import { internalSmsRouter } from './routes/internal/sms.js';
import testRoutes from './routes/test.js';
import { getSupabaseClient } from './utils/supabase.js';
import { getTwilioClient } from './utils/twilio.js';
import { validateTimezoneSupport } from './utils/timezone.js';
import { logger } from './utils/logger.js';
import { validateEnvVariables } from './utils/env-validator.js';

// Re-export logger for use by other modules
export { logger };

// Validate environment before starting server
validateEnvVariables();

// Create Express app
const app = express();

app.set('trust proxy', 1);

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://ultaura.com',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Webhook-Secret', 'Authorization'],
};

app.use(cors(corsOptions));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  logger.info({ method: req.method, path: req.path }, 'Incoming request');

  res.on('finish', () => {
    logger.debug({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    }, 'Request completed');
  });

  next();
});

// Enhanced health check
app.get('/health', async (_req, res) => {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: Record<string, { status: string; latency?: number }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check Supabase
  try {
    const start = Date.now();
    const { error } = await getSupabaseClient().from('ultaura_plans').select('id').limit(1);
    health.checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency: Date.now() - start,
    };
  } catch {
    health.checks.database = { status: 'unhealthy' };
    health.status = 'degraded';
  }

  // Check Twilio credentials
  try {
    const client = getTwilioClient();
    health.checks.twilio = { status: client ? 'healthy' : 'unhealthy' };
  } catch {
    health.checks.twilio = { status: 'unhealthy' };
    health.status = 'degraded';
  }

  // Check xAI API key
  health.checks.xai = {
    status: process.env.XAI_API_KEY ? 'healthy' : 'unhealthy'
  };

  // Determine overall status
  const unhealthyChecks = Object.values(health.checks).filter(c => c.status === 'unhealthy');
  if (unhealthyChecks.length > 0) {
    health.status = unhealthyChecks.length >= 2 ? 'unhealthy' : 'degraded';
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});

// Twilio webhook routes
app.use('/twilio/voice', twilioInboundRouter);
app.use('/twilio/voice', twilioOutboundRouter);
app.use('/twilio', twilioStatusRouter);

// Internal API routes
app.use('/calls', callsRouter);
app.use('/tools', toolsRouter);
app.use('/verify', verifyRouter);
app.use('/internal', internalSmsRouter);
if (process.env.NODE_ENV !== 'production') {
  app.use('/test', testRoutes);
}

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({
  server,
  path: '/twilio/media',
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const callSessionId = url.searchParams.get('callSessionId');

  if (!callSessionId) {
    logger.error('WebSocket connection without callSessionId');
    ws.close(1008, 'Missing callSessionId');
    return;
  }

  logger.info({ callSessionId }, 'WebSocket connection established');
  handleMediaStreamConnection(ws, callSessionId);
});

wss.on('error', (error) => {
  logger.error({ error }, 'WebSocket server error');
});

// Start server
const PORT = process.env.PORT || 3001;

const REQUIRED_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

try {
  validateTimezoneSupport(REQUIRED_TIMEZONES);
  logger.info('Timezone support validated successfully');
} catch (error) {
  logger.fatal({ error }, 'Timezone support validation failed');
  process.exit(1);
}

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Ultaura Telephony Backend started');

  // Start the call scheduler
  startScheduler();
  startWeeklySummaryScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopScheduler();
  stopWeeklySummaryScheduler();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopScheduler();
  stopWeeklySummaryScheduler();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, server };
