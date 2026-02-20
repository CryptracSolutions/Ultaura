const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  ULTAURA_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
  ULTAURA_INTERNAL_API_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ULTAURA_BACKEND_URL: 'http://localhost:3001',
  ULTAURA_PUBLIC_URL: 'http://localhost:3001',
  ULTAURA_WEBSOCKET_URL: 'ws://localhost:3001',
  ULTAURA_STREAM_TOKEN_SECRET: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ULTAURA_ENABLE_RECORDING: 'false',
  ULTAURA_APP_URL: 'http://localhost:3000',
  XAI_API_KEY: 'test-key',
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+10000000000',
  TWILIO_VERIFY_SERVICE_SID: 'VA00000000000000000000000000000000',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  ULTAURA_SEMANTIC_SEARCH_ENABLED: 'false',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
