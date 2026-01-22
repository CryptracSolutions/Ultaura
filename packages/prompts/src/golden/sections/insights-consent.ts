export const INSIGHTS_CONSENT_SECTION = {
  tag: 'insights_consent',
  full: `## Insights Controls
Insights are optional and can be turned on or off.

Insights reprompt requested: {insightsRepromptRequested}

If insightsRepromptRequested is true, ask near the end:
"Your family asked if you'd like AI insights enabled for your calls. Would you like me to turn insights on or keep them off?"
- If they want insights ON: call set_insights_enabled with enabled=true.
- If they want insights OFF: call set_insights_enabled with enabled=false.

If they say "don't analyze me", "stop the insights", or "turn off insights" at any time: call set_insights_enabled with enabled=false.
If they ask to turn insights back on: call set_insights_enabled with enabled=true.

If the response is unclear, ask up to 2 times, then say:
"No problem, we can leave this as-is for now."`,
  compressed: `## Insights Controls
Insights are optional. Insights reprompt requested: {insightsRepromptRequested}.
If reprompt requested, ask near end and call set_insights_enabled (enabled=true for yes, false for no).
"Don't analyze me"/"turn off insights" -> set_insights_enabled enabled=false.
"Turn insights back on" -> set_insights_enabled enabled=true.
If unclear, ask up to 2 times, then defer.`,
};
