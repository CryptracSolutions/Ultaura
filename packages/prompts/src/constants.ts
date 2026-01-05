export const DTMF_PROMPTS = {
  REPEAT: "I'll repeat what I just said.",
  SLOWER: "I'll speak more slowly and simply.",
  CHANGE_TOPIC: "Sure, let's talk about something else. What's on your mind?",
  OPT_OUT_CONFIRM: "I understand. Are you sure you don't want to speak with me anymore? Just say yes to confirm, or no if you'd like to continue.",
  OPT_OUT_CONFIRMED: "Okay, I've stopped the scheduled calls. You can always call this number if you change your mind. Take care of yourself.",
  OPT_OUT_CANCELED: "Alright, I'll keep calling as scheduled. I'm glad you want to stay in touch.",
  HELP: 'If you need help with your account or have questions, please contact our support team. Is there anything else I can help you with today?',
} as const;

export const CALL_MESSAGES = {
  UNRECOGNIZED_CALLER: "Hello, this is Ultaura. I don't recognize this phone number. If you'd like to set up phone companionship for yourself or a loved one, please visit our website at ultaura.com. Goodbye.",
  LINE_DISABLED: 'Hello, this phone line is currently disabled. Please contact your family member or caregiver to re-enable it. Goodbye.',
  MINUTES_EXHAUSTED_PAID: 'Hello, your included minutes for this month have been used. Additional calls will be charged as overage. Would you like to continue anyway?',
  OUTBOUND_GREETING: (name: string) => `Hello ${name}, this is Ultaura calling. How are you doing today?`,
  OUTBOUND_NO_ANSWER: "This is Ultaura calling. I'm sorry I missed you. I'll try again later. Take care.",
  GOODBYE: (name: string) => `It was lovely talking with you, ${name}. Take care of yourself, and I'll talk to you again soon. Goodbye.`,
  ERROR_GENERIC: "I'm sorry, I'm having some technical difficulties. Let me try to reconnect.",
  ERROR_DISCONNECT: "I apologize, but I'm experiencing some issues and need to end the call. Please try calling back in a few minutes. Take care.",
} as const;

export const SAFETY_PROMPTS = {
  LOW: "I hear that you're going through a difficult time. Would you like to talk about it?",
  MEDIUM: "I'm concerned about what you're sharing. Have you been able to talk to someone you trust about this?",
  HIGH: "I'm really worried about you right now. The 988 Suicide and Crisis Lifeline is free, confidential, and available 24/7. You can call or text 988 anytime. Would you like me to stay on the line with you?",
  EMERGENCY: 'This sounds like an emergency. Please call 911 right away. Your safety is the most important thing right now.',
} as const;

export const TOOL_PROMPTS = {
  REMINDER_SET: (message: string, time: string) =>
    `I've set a reminder for you: "${message}" at ${time}. I'll call you to remind you.`,
  REMINDER_FAILED: "I'm sorry, I wasn't able to set that reminder. Could you try telling me again?",
  SCHEDULE_UPDATED: (days: string, time: string) =>
    `I've updated your call schedule. I'll call you on ${days} at ${time}.`,
  SCHEDULE_FAILED: "I'm sorry, I wasn't able to update the schedule. Could you try again?",
} as const;

export const TWIML_MESSAGES = {
  CONNECTING: 'Please wait while I connect you.',
  HOLD: 'Please hold for just a moment.',
} as const;
