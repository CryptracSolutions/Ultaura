import handleChatBotRequest from '~/plugins/chatbot/lib/server/route-handler';

export const runtime = 'edge';

export const POST = handleChatBotRequest;
