// Ultaura Telephony Backend Server
// Main entry point for handling Twilio webhooks and xAI Grok bridge

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import pino from 'pino';

import { twilioInboundRouter } from './routes/twilio-inbound.js';
import { twilioOutboundRouter } from './routes/twilio-outbound.js';
import { twilioStatusRouter } from './routes/twilio-status.js';
import { callsRouter } from './routes/calls.js';
import { toolsRouter } from './routes/tools/index.js';
import { handleMediaStreamConnection } from './websocket/media-stream.js';
import { startScheduler } from './scheduler/call-scheduler.js';

// Load environment variables
dotenv.config();

// Initialize logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Create Express app
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Twilio webhook routes
app.use('/twilio/voice', twilioInboundRouter);
app.use('/twilio/voice', twilioOutboundRouter);
app.use('/twilio', twilioStatusRouter);

// Internal API routes
app.use('/calls', callsRouter);
app.use('/tools', toolsRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Ultaura Telephony Backend started');

  // Start the call scheduler
  startScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, server };
