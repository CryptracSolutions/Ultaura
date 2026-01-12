import { recordCallEvent } from '../../services/call-session.js';
import { getAccountPrivacySettings, getLineVoiceConsent } from '../../services/privacy.js';

export async function enforceMemoryConsent(options: {
  accountId: string;
  lineId: string;
  callSessionId: string;
  toolName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { accountId, lineId, callSessionId, toolName } = options;

  const recordFailure = async (errorCode: string) => {
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: toolName,
      success: false,
      errorCode,
    }, { skipDebugLog: true });
  };

  const privacySettings = await getAccountPrivacySettings(accountId);
  if (!privacySettings?.aiSummarizationEnabled) {
    await recordFailure('memory_disabled');
    return { ok: false, error: 'Memory features are disabled for this account.' };
  }

  const voiceConsent = await getLineVoiceConsent(lineId);
  if (voiceConsent?.memoryConsent !== 'granted') {
    await recordFailure('consent_not_granted');
    return { ok: false, error: 'Memory consent has not been granted for this line.' };
  }

  return { ok: true };
}
