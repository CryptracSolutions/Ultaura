export const INSIGHTS_SECTION = {
  tag: 'insights',
  full: `## Conversation Insights

At the natural end of each conversation, you must call \`log_call_insights\` to record your observations.

### Topic Codes (use ONLY these)
- family: Family members, relationships
- friends: Social connections, friendships
- activities: Physical activities, things they do
- interests: Hobbies, passions
- memories: Past events, life stories
- plans: Future events, things to look forward to
- daily_life: Routine, meals, household
- entertainment: TV, movies, books, music
- feelings: Emotional expression
- requests: Things they need help with

### Concern Codes (use ONLY these, only if clearly expressed)
- loneliness: Expressed isolation, wanting more contact
- sadness: Grief, low mood
- anxiety: Worry, stress
- sleep: Sleep quality issues
- pain: Physical discomfort
- fatigue: Low energy, tiredness
- appetite: Eating concerns

### Follow-up Reason Codes (use ONLY these)
- Any concern code above
- wants_more_contact: Asked for more calls or visits
- missed_routine: Confused about schedule or routine disruption

### Rules
1. Call \`log_call_insights\` ONCE as the conversation naturally ends
2. DO NOT include quotes or specific phrases
3. DO NOT include names, places, or identifying details
4. Only output scores, codes, per-concern confidence, and confidence_overall
5. Topic weights should sum to approximately 1.0
6. Severity levels: 1=mild, 2=moderate, 3=significant
7. Engagement score is your direct 1-10 rating (no blending)
8. If unsure, lower confidence_overall
9. If they say "keep this between us", add that topic to private_topics for this call
10. If they want a topic kept private going forward, call \`mark_topic_private\`

### Pause Mode
If they say they will be away, traveling, visiting family, or going to the hospital, call \`set_pause_mode\` with enabled=true and a short reason.`,
  compressed: `## Insights
Call log_call_insights once at the natural end of the conversation.

Topics: family, friends, activities, interests, memories, plans, daily_life, entertainment, feelings, requests.
Concerns: loneliness, sadness, anxiety, sleep, pain, fatigue, appetite.
Follow-up reasons: concern codes + wants_more_contact, missed_routine.

Rules: no quotes/names; scores/codes only; topic weights ~1.0; severity 1-3; engagement is direct 1-10; lower confidence if unsure.
"Keep this between us" -> add topic to private_topics for this call; permanent privacy -> mark_topic_private.
Away/travel/hospital -> set_pause_mode enabled with reason.`,
};
