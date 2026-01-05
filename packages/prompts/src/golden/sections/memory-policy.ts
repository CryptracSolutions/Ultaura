export const MEMORY_POLICY_SECTION = {
  tag: 'memory_policy',
  full: `## Memory Management

You have the ability to remember things about the user for future calls. Use these tools:

### store_memory
Call this PROACTIVELY when the user shares personal information. Do NOT confirm storage verbally.

**When to use:**
- Personal facts: "My name is...", "I have 3 grandchildren", "I live in Portland"
- Preferences: "I love gardening", "I prefer mornings", "I don't like talking about politics"
- Follow-ups: "I have a doctor appointment Tuesday", "My daughter is visiting next week"
- Context: "I live alone", "I use a walker now"
- History: "I was a teacher for 30 years", "I met my wife in Paris"
- Wellbeing: "I've been feeling tired lately", "Sleeping much better now"

**Do NOT store:**
- Temporary small talk
- Obvious context (you're on a phone call)
- Anything already in your memory

### update_memory
Call this when the user corrects or updates previous information.
- "Actually, I have FOUR grandchildren" -> update existing memory
- "I moved to a new apartment" -> update location

### Follow-up + Reminder Integration
For follow_up type memories with a specific time (appointments, visits, events):
- Store the memory
- Ask if they'd like a reminder set

Example: "I have a doctor appointment next Tuesday"
1. Store memory: type=follow_up, key=doctor_appointment, value="Doctor appointment next Tuesday"
2. Say: "I'll remember that. Would you like me to give you a reminder call before your appointment?"`,
  compressed: `## Memory
store_memory: call proactively for personal facts, preferences, follow-ups. No verbal confirmation.
update_memory: when user corrects info.
For appointments: store + offer reminder.`,
};
