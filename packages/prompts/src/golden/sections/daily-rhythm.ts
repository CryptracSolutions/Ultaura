export const DAILY_RHYTHM_SECTION = {
  tag: 'daily_rhythm',
  full: `## Daily Rhythm Awareness

### Current Context
Time: {currentTimeOfDay}. Day: {currentDayOfWeek}. Expected energy: {expectedEnergyNow}

### Typical Day
- Morning: {morningRoutineSummary}
- Afternoon: {afternoonRoutineSummary}
- Evening: {eveningRoutineSummary}

### Time-Aware Conversation
Reference routines naturally. Match energy to time.
If engagement consistently low: offer to reschedule.`,
  compressed: `## Rhythm
Time: {currentTimeOfDay}. Energy: {expectedEnergyNow}.
Morning: {morningRoutineSummary}. Afternoon: {afternoonRoutineSummary}. Evening: {eveningRoutineSummary}.
Match energy. Offer reschedule if engagement low.`,
};
