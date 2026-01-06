export type CallEventType = 'dtmf' | 'tool_call' | 'state_change' | 'error' | 'safety_tier';

const TOOL_NAME_ALIASES: Record<string, string> = {
  overage_action: 'choose_overage_action',
  opt_out: 'request_opt_out',
  safety_tier: 'log_safety_concern',
};

const TOOL_BASE_FIELDS = ['tool', 'success', 'errorCode'] as const;

const TOOL_ALLOWLISTS: Record<string, string[]> = {
  set_reminder: ['reminderId', 'messageDefaulted'],
  edit_reminder: ['reminderId'],
  pause_reminder: ['reminderId'],
  resume_reminder: ['reminderId'],
  snooze_reminder: ['reminderId', 'snoozeMinutes'],
  cancel_reminder: ['reminderId'],
  list_reminders: ['reminderCount'],
  schedule_call: ['scheduleId', 'mode'],
  store_memory: ['key'],
  update_memory: ['key', 'action'],
  forget_memory: ['result'],
  mark_private: [],
  choose_overage_action: ['action', 'planId'],
  request_upgrade: ['planId', 'sendLink'],
  request_opt_out: ['confirmed'],
  log_safety_concern: ['tier', 'actionTaken'],
  report_conversation_language: ['languageCode'],
};

const STATE_CHANGE_ALLOWLIST = ['event', 'action', 'planId', 'source', 'sendLink'];

function resolveToolName(toolName: string | undefined): string | undefined {
  if (!toolName) return toolName;
  return TOOL_NAME_ALIASES[toolName] || toolName;
}

export function sanitizePayload(
  eventType: CallEventType,
  payload: Record<string, unknown>
): { sanitized: Record<string, unknown>; stripped: Record<string, unknown> } {
  const sanitized: Record<string, unknown> = {};
  const stripped: Record<string, unknown> = {};

  let allowlist: string[] = [];
  let canonicalToolName: string | undefined;

  switch (eventType) {
    case 'dtmf':
      allowlist = ['digit'];
      break;

    case 'tool_call':
      canonicalToolName = resolveToolName(
        typeof payload.tool === 'string' ? payload.tool : undefined
      );
      allowlist = [
        ...TOOL_BASE_FIELDS,
        ...(canonicalToolName && TOOL_ALLOWLISTS[canonicalToolName]
          ? TOOL_ALLOWLISTS[canonicalToolName]
          : []),
      ];
      break;

    case 'state_change':
      allowlist = STATE_CHANGE_ALLOWLIST;
      break;

    case 'error':
      allowlist = ['errorType', 'errorCode'];
      break;

    case 'safety_tier':
      allowlist = ['tier', 'actionTaken'];
      break;

    default:
      allowlist = [];
  }

  for (const [key, value] of Object.entries(payload)) {
    if (allowlist.includes(key)) {
      if (eventType === 'tool_call' && key === 'tool' && canonicalToolName) {
        sanitized[key] = canonicalToolName;
        continue;
      }
      sanitized[key] = value;
    } else {
      stripped[key] = value;
    }
  }

  return { sanitized, stripped };
}

export function getStrippedFieldsInfo(
  stripped: Record<string, unknown>
): { hasStripped: boolean; fieldNames: string[] } {
  const fieldNames = Object.keys(stripped);
  return {
    hasStripped: fieldNames.length > 0,
    fieldNames,
  };
}
