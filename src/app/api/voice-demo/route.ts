import { NextRequest, NextResponse } from 'next/server';

// Valid voices from Grok Voice API
const VALID_VOICES = ['Ara', 'Eve', 'Leo', 'Rex', 'Sal'] as const;
type Voice = (typeof VALID_VOICES)[number];

// Rate limiting (in-memory for now - replace with Redis for production)
const requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_TEXT_LENGTH = 200;

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  requestCounts.forEach((record, ip) => {
    if (now > record.resetAt) {
      requestCounts.delete(ip);
    }
  });
}, 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text, voice } = body as { text?: string; voice?: string };

    // Validate voice
    if (!voice || !VALID_VOICES.includes(voice as Voice)) {
      return NextResponse.json(
        { error: `Invalid voice. Must be one of: ${VALID_VOICES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate text
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be ${MAX_TEXT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Sanitize text (basic XSS prevention)
    const sanitizedText = text.trim().slice(0, MAX_TEXT_LENGTH);

    // TODO: Replace with actual xAI TTS API call when available
    // Expected endpoint: https://api.x.ai/v1/audio/speech
    // Expected format:
    // const response = await fetch('https://api.x.ai/v1/audio/speech', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'grok-tts',
    //     voice: voice,
    //     input: sanitizedText,
    //   }),
    // });
    // return new NextResponse(response.body, {
    //   headers: { 'Content-Type': 'audio/mpeg' },
    // });

    // For now, return a placeholder response indicating the API is not yet available
    return NextResponse.json(
      {
        status: 'pending',
        message: 'Voice demo coming soon! The xAI TTS API is not yet available.',
        requestedVoice: voice,
        requestedText: sanitizedText,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error('Voice demo API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  return NextResponse.json({
    status: 'pending',
    message: 'Voice demo API is ready. Waiting for xAI TTS API release.',
    availableVoices: VALID_VOICES,
    maxTextLength: MAX_TEXT_LENGTH,
    rateLimit: `${MAX_REQUESTS_PER_MINUTE} requests per minute`,
  });
}
