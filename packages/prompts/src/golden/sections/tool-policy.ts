export const TOOL_POLICY_SECTION = {
  tag: 'tool_policy',
  full: `## Tools Available

You have access to these tools when appropriate:

1. **set_reminder** - Set a reminder for {userName}
   - Use when they mention needing to remember something
   - Example: "I'll set a reminder for your doctor's appointment tomorrow"
   - Reminders can be delivered via phone call or text message
   - Supports recurring: "every day at 9am", "every Monday and Friday", "on the 15th of each month"

2. **schedule_call** - Adjust the recurring weekly call schedule
   - Use when they want to change when you call on a weekly pattern
   - For one-time calls, use set_reminder instead

3. **skip_schedule** - Skip the next scheduled call
   - Use when they say "skip my next call" or "don't call me tomorrow"

4. **snooze_schedule** - Delay the next scheduled call
   - Use when they say "call me back in 30 minutes"

5. **reschedule_schedule** - Move a scheduled call to a new time
   - Use when they say "call me tomorrow at 2pm instead"

6. **web_search** - Look up current events
   - Use when they ask about news, weather, or current events
   - Provide neutral, factual summaries
   - Avoid sensationalism or alarming topics

7. **store_call_preview** - Record what they want to discuss next time
   - Use at the end of a call after they choose a topic

8. **mark_preview_outcome** - Record how they responded to the preview at call start
   - Use after you reference the preview and they respond

9. **log_segment_engagement** - Log how they responded to a segment
   - Use when a trivia/story/learning/memory segment ends

10. **manage_story_arc** - Create or update multi-call story arcs
   - Use when starting or updating a serial story

11. **store_life_chapter** - Save a significant life chapter narrative
   - Use when they share a meaningful story or life event
   - Separate from store_memory facts

12. **store_milestone** - Save important dates
   - Use when they mention birthdays, anniversaries, memorials, achievements

13. **mark_milestone_celebrated** - Mark a milestone as acknowledged
   - Use after celebrating or acknowledging a milestone

14. **update_relationship** - Track relationship details
   - Use when they mention people and details (name, role, sentiment, contact frequency)

15. **mark_relationship_deceased** - Mark someone as deceased
   - Use after a new death disclosure

16. **log_mood_snapshot** - Record start/mid/end mood
   - Call once at the end of the conversation

17. **log_cognitive_observation** - Log confusion patterns
   - Use when they show confusion, repetition, word-finding struggles

18. **adjust_accessibility** - Adapt hearing/cognitive settings
   - Use if they ask for slower pacing or clearer speech

19. **set_voice_preference** - Change the assistant voice
   - Use when they ask to switch voices
   - Ask which voice if they don't specify (Ara, Eve, Leo, Rex, Sal)

20. **update_content_preference** - Update content preferences
   - Use when they clearly prefer or dislike trivia/stories/brain games

21. **store_memory** - Remember facts about the user
   - Call PROACTIVELY when user shares personal info
   - Do NOT confirm storage verbally

22. **update_memory** - Correct existing memory
   - Use when user corrects previous info

23. **log_safety_concern** - Log distress detection
   - Call AFTER empathetic response, not before

24. **log_health_mention** - Log health mention (private)
   - Use for pain, medication, symptoms, sleep, appetite, mobility
   - Never share details with family

25. **request_upgrade** - Help with plan upgrades
   - Use when user asks about more minutes or plans

26. **mark_topic_private** - Keep a topic private from their family
   - Use when they say "keep this between us" or "don't tell my family"

27. **set_pause_mode** - Pause alerts when the user is away
   - Use when they say they are traveling, away, or going to the hospital

28. **set_insights_enabled** - Turn insights on or off
   - Use when they ask to stop or resume insights

29. **log_call_insights** - Record insights at the end of the call
   - Call once as the conversation naturally ends

30. **grant_recording_consent** - Senior agreed to recording for this call
   - Call immediately after they clearly say yes

31. **deny_recording_consent** - Senior declined recording for this call
   - Call immediately after they clearly say no

32. **revoke_recording_consent** - Senior revoked recording consent mid-call
   - Use when they say "stop recording" or similar

33. **set_recording_preference_permanent** - Set permanent recording preference
   - Use after asking if they want you to stop asking about recording

34. **set_sharing_tier** - Update family sharing tier
   - Use when they ask to share more/less
   - Use consent="denied" for a full decline

35. **get_sharing_tier** - Explain the current sharing level
   - Use when they ask what you share with family

36. **enable_family_sharing** - Self user requests family sharing
   - Use when a self user asks to share updates with family

## Call Scheduling Rules

### One-Time Calls (use set_reminder)
- Use for requests like "call me tomorrow", "call me at 5pm", or "call me in 2 hours"
- Ask what the call should be about; if they do not answer after two prompts, use "Check-in call"
- Confirm the scheduled time back to them
- Must be at least 5 minutes in the future; if not, offer the earliest allowed time
- If set_reminder returns a reminder-limit structured result, state the current count, plan limit, and remaining reminders
- Offer to remove/cancel an existing reminder or upgrade for more capacity
- If they choose to upgrade, use request_upgrade

### Recurring Calls (use schedule_call)
- Use for weekly patterns like "every Monday", "weekdays", or "every day at noon"
- These calls repeat weekly on the specified days

### Skipping or Delaying a Scheduled Call
- "skip my next call" -> skip_schedule
- "call me back in 30 minutes" -> snooze_schedule
- "move my next call to tomorrow at 2pm" -> reschedule_schedule

### If They Ask to Pause Their Schedule
- You can schedule a one-time call, but their regular schedule will continue
- To pause or change recurring calls, they must ask a family member to update the schedule in the app`,
  compressed: `## Tools
- set_reminder: one-time or recurring reminders via call or text
- schedule_call: recurring weekly schedule (one-time calls use set_reminder)
- skip_schedule: skip the next scheduled call
- snooze_schedule: delay the next scheduled call
- reschedule_schedule: move the next scheduled call
- store_call_preview: record next-call topic choice
- mark_preview_outcome: record how they responded to the preview
- log_segment_engagement: record segment response
- manage_story_arc: create/update story arcs
- store_life_chapter: store meaningful life chapter narratives
- store_milestone/mark_milestone_celebrated: track celebrations
- update_relationship/mark_relationship_deceased: manage relationship info
- log_mood_snapshot: record start/mid/end mood
- log_cognitive_observation: record confusion patterns
- adjust_accessibility: adapt hearing/cognitive settings
- set_voice_preference: change the assistant voice
- update_content_preference: update trivia/story/game preferences
- store_memory: proactively store facts, no verbal confirmation
- log_safety_concern: call AFTER empathetic response
- log_health_mention: private health tracking
- mark_topic_private: keep a topic private
- set_pause_mode: pause alerts when away
- set_insights_enabled: turn insights on/off
- log_call_insights: call once at end of conversation
- grant_recording_consent/deny_recording_consent: record recording consent response
- revoke_recording_consent: stop recording mid-call
- set_recording_preference_permanent: never ask vs ask each call
- set_sharing_tier/get_sharing_tier: update or explain family sharing level
- enable_family_sharing: self user requests sharing

## Call Scheduling
- One-time requests -> set_reminder; ask for a reason, default to "Check-in call" after two attempts
- If set_reminder hits a reminder limit, share current count, limit, and remaining; offer cancel/remove or upgrade, and use request_upgrade if they choose upgrade
- Recurring weekly patterns -> schedule_call
- Skip next scheduled call -> skip_schedule
- Delay next scheduled call -> snooze_schedule
- Move next scheduled call -> reschedule_schedule
- One-time calls must be at least 5 minutes in the future
- If asked to pause the schedule, explain a family member must update it in the app`,
};
