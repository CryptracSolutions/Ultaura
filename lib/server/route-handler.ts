import { NextRequest } from 'next/server';
import { headers } from 'next/headers';

import { StreamingTextResponse } from 'ai';
import { z } from 'zod';

import generateReplyFromChain from './langchain';
import configuration from '~/configuration';

const CHATBOT_TURNSTILE_SECRET_KEY = process.env.CHATBOT_TURNSTILE_SECRET_KEY;

// Set this to true to use a fake data streamer for testing purposes.
let USE_FAKE_DATA_STREAMER = false;

if (process.env.NODE_ENV === 'production') {
  // make sure to set this to false in production
  USE_FAKE_DATA_STREAMER = false;
}

/**
 * Handles a chat bot request. This function should be exported from a
 * Next.js App Router route handler as a POST request.
 *
 * @example
 * file: app/api/chat/route.ts
 *
 * export const POST = handleChatBotRequest;
 *
 * @param {NextApiRequest} req - The request object received from Next.js.
 * @returns {StreamingTextResponse} - The streaming text response containing the chat bot's reply.
 */
export async function handleChatBotRequest(req: NextRequest) {
  // we validate the captcha token if the secret key is present
  if (CHATBOT_TURNSTILE_SECRET_KEY) {
    const captchaToken = headers().get('x-captcha-token');

    // we check if the captcha token is present
    if (!captchaToken) {
      return new Response('Missing captcha token', { status: 400 });
    }

    // we validate the captcha token
    await validateCaptchaToken(captchaToken);
  } else {
    // user is not using CAPTCHA - we warn them
    if (!configuration.production) {
      console.warn(
        `It is recommended to set the CHATBOT_TURNSTILE_SECRET_KEY environment variable in production to prevent abuse.`,
      );
    }
  }

  // we parse the request body to get the messages sent by the user
  const zodSchema = z.object({
    messages: z.array(
      z.object({
        content: z.string(),
        role: z.enum(['user', 'assistant'] as const),
      }),
    ),
  });

  const { messages } = zodSchema.parse(await req.json());

  // if the user is using the fake data streamer, we return a fake response
  if (USE_FAKE_DATA_STREAMER) {
    return fakeDataStreamer();
  }

  const stream = await generateReplyFromChain({ messages });

  return new StreamingTextResponse(stream);
}

export default handleChatBotRequest;

async function validateCaptchaToken(token: string) {
  let formData = new FormData();

  if (!CHATBOT_TURNSTILE_SECRET_KEY) {
    throw new Error('Missing CHATBOT_TURNSTILE_SECRET_KEY');
  }

  formData.append('secret', CHATBOT_TURNSTILE_SECRET_KEY);
  formData.append('response', token);

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  const result = await fetch(url, {
    body: formData,
    method: 'POST',
  });

  const outcome = await result.json();

  if (outcome.success) {
    return true;
  }

  throw new Error('Invalid captcha token');
}

/**
 * @returns {Response} - A fake data streamer response.
 */
function fakeDataStreamer() {
  let timerId: number | undefined;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // @ts-ignore
      timerId = setInterval(() => {
        if (closed) return;

        controller.enqueue(encoder.encode('TEXT'));
      }, 200);

      setTimeout(() => {
        controller.close();
        closed = true;
      }, 5_000);
    },
    cancel() {
      if (typeof timerId === 'number') {
        clearInterval(timerId);
      }
    },
  });

  return new Response(stream);
}
