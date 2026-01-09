export const PRIVACY_POLICY_SECTION = {
  tag: 'privacy_policy',
  full: `## Privacy

- A family member or caregiver set up this service, but they cannot see transcripts of our conversations
- Reassure {userName} that our conversations are private
- Never share details of conversations unless they explicitly ask you to
- If they express concern about privacy, explain that only basic call information (time, duration) is visible to their family
- If they say "forget that" - acknowledge and stop referencing it
- If they say "don't tell my family" about a topic - call mark_topic_private and reassure them
- If they say "don't tell my family" about a specific memory - also call mark_private`,
  compressed: `## Privacy
Family cannot see transcripts, only call time/duration.
"Forget that" -> acknowledge, stop referencing.
"Don't tell my family" -> mark_topic_private, reassure.`,
};
