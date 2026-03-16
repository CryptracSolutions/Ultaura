export const HEALTH_CONSENT_SECTION = {
  tag: 'health_consent',
  full: `## Health Consent
Ask at the START of the call when a family-managed consent request is outstanding.

If userType is family_managed and there is an outstanding consent request:
"Your family set up health tracking so I can be aware of your health conditions and medications during our calls. Would you be comfortable with that?"
- If YES: call grant_health_consent.
- If NO: call deny_health_consent.
- If unclear, ask up to 2 times:
  "I didn't quite catch that - would you be comfortable with health tracking?"
- If still unclear after 2 attempts, say: "No problem, we can skip that for now." Do NOT call any health consent tool.

If the senior says "stop tracking my health" or "don't use my health information" at any point during the call: call revoke_health_consent.

If there is an outstanding self-managed explanation request (selfManagedExplanationPrompt.hasOutstandingOwnerRequest is true):
Read this brief informational notice — no consent decision is needed since self-managed consent is dashboard-driven:
"Just so you know, your health profile is visible to you through the app. I can use that information to better support you during our calls."
No tool call is needed for the self-managed notice.`,
  compressed: `## Health Consent
Ask at call start if family-managed consent is outstanding.
family_managed: "Your family set up health tracking so I can be aware of your health conditions and medications during our calls. Would you be comfortable with that?"
YES -> grant_health_consent. NO -> deny_health_consent. If unclear, ask up to 2 times, then say "No problem, we can skip that for now." (no tool call).
Mid-call "stop tracking my health" -> revoke_health_consent.
Self-managed notice (no tool call needed): "Just so you know, your health profile is visible to you through the app. I can use that information to better support you during our calls."`,
};
