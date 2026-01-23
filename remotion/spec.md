# Ultaura Promo Video Upgrade Specification

## Overview

This specification details the complete upgrade of the Ultaura promotional video, transforming it from an 8-scene structure to a streamlined 7-scene "How it Works" flow. The video maintains its 9:16 vertical format (1080x1920) at 30 FPS with a target duration of **~52 seconds (1560 frames)**.

**Key Changes Summary:**
- Reduce from 8 scenes to 7 scenes
- Replace all transitions with soft crossfades (no overshoot)
- Remove ProgressBar component from UltauraPromo.tsx
- Increase phone mockup scale per-scene (keep component defaults unchanged)
- Create new VoiceSelectionScene and ScheduleScene
- Merge Dashboard and Safety into InsightsSafetyScene
- Simplify CTA trust badges
- Reduce motion intensity throughout

---

## Critical Build Notes

**IMPORTANT: Source of Truth**

- **Do NOT edit files in `dist/`** - always edit source files in `src/`
- Always render from `src/index.ts` via the package.json scripts
- The `dist/` directory contains compiled artifacts and is NOT the source of truth
- Rendering uses `src/` directly; `pnpm build` is only needed if your tooling requires it
- The Watermark component exists in `src/components/Watermark.tsx` but is **not currently rendered** in `src/UltauraPromo.tsx` - no removal needed
- Render command: `cd remotion && pnpm render` (uses `src/index.ts`)

---

## Duration & Timing Calculations

### Target Output
- **Final video duration:** 1560 frames (52 seconds at 30 FPS)

### Transition Configuration
- **Number of transitions:** 6 (between 7 scenes)
- **Transition duration:** 18 frames each (0.6 seconds)
- **Total overlap:** 6 × 18 = 108 frames

### Scene Duration Math
Since TransitionSeries overlaps scenes during transitions, the raw scene durations must sum to:
```
Raw scene total = Final duration + Total overlap
Raw scene total = 1560 + 108 = 1668 frames
```

### New Scene Durations

| # | Scene | Raw Duration | Time | Notes |
|---|-------|--------------|------|-------|
| 1 | HookScene | 180 frames | 6s | Refined emotional hook |
| 2 | VoiceSelectionScene | 210 frames | 7s | Step 1: Choose a voice |
| 3 | RemindersScene | 210 frames | 7s | Step 2: Set reminders (card-based, NO phone) |
| 4 | ScheduleScene | 210 frames | 7s | Step 3: Schedule calls |
| 5 | InsightsSafetyScene | 360 frames | 12s | Step 4: Tabbed phone UI (Insights → Safety) |
| 6 | CallsScene | 270 frames | 9s | Step 5: Live calls + weather |
| 7 | CTAScene | 228 frames | 7.6s | Final CTA, hold until end |

**Sum: 180 + 210 + 210 + 210 + 360 + 270 + 228 = 1668 frames** ✓

---

## Project Structure

```
/Users/josephsilvagnoli/Ultaura/remotion/
├── src/
│   ├── index.ts                    # Entry point (RENDER FROM HERE)
│   ├── Root.tsx                    # Composition registration
│   ├── UltauraPromo.tsx           # Main composition
│   ├── theme.ts                    # Colors, springs, typography, timing
│   ├── components/
│   │   ├── index.ts               # Component exports
│   │   ├── AnimatedText.tsx       # Text animations
│   │   ├── GradientBackground.tsx # Background variants
│   │   ├── PhoneFrame.tsx         # Phone mockup (KEEP DEFAULTS UNCHANGED)
│   │   ├── ProgressBar.tsx        # TO BE REMOVED FROM MAIN COMPOSITION
│   │   ├── SceneLayout.tsx        # Layout primitives
│   │   ├── UltauraLogo.tsx        # Logo component
│   │   ├── Watermark.tsx          # Not currently used
│   │   └── Waveform.tsx           # Audio visualization
│   └── scenes/
│       ├── index.ts               # Scene exports
│       ├── HookScene.tsx          # Scene 1
│       ├── SolutionScene.tsx      # → RENAME to VoiceSelectionScene.tsx
│       ├── ProblemScene.tsx       # → RENAME to ScheduleScene.tsx
│       ├── RemindersScene.tsx     # Scene 3 (card-based, no phone)
│       ├── DashboardScene.tsx     # → MERGE into InsightsSafetyScene.tsx
│       ├── SafetyScene.tsx        # → MERGE into InsightsSafetyScene.tsx
│       ├── AICallsScene.tsx       # → RENAME to CallsScene.tsx
│       └── CTAScene.tsx           # Scene 7
├── dist/                           # COMPILED OUTPUT - NOT SOURCE OF TRUTH
├── public/
│   ├── ultaura-logo.svg
│   ├── ultaura-logo.png
│   ├── background-music.mp3
│   └── voices/
│       ├── ara.svg
│       ├── eve.svg
│       ├── leo.svg
│       ├── rex.svg
│       └── sal.svg
└── package.json
```

---

## Theme Updates

### File: `src/theme.ts`

**Add transition constants and update section timings:**

```typescript
// Add transition constants at module level
export const TRANSITION_DURATION_FRAMES = 18; // 0.6 seconds at 30fps
export const TRANSITION_COUNT = 6;

// Add to springs object - highly damped for no overshoot on fades
export const springs = {
  // ... existing springs ...

  // Premium crossfade - NO overshoot, silky smooth
  // Use linearTiming instead for crossfades, but if spring needed:
  premiumFade: { damping: 200, stiffness: 100 }, // Very high damping = no bounce
} as const;

// Update sections object with new scene structure:
sections: {
  hook: { start: 0, duration: 180 },              // 6s
  voiceSelection: { start: 180, duration: 210 },  // 7s
  reminders: { start: 390, duration: 210 },       // 7s
  schedule: { start: 600, duration: 210 },        // 7s
  insightsSafety: { start: 810, duration: 360 },  // 12s
  calls: { start: 1170, duration: 270 },          // 9s
  cta: { start: 1440, duration: 228 },            // 7.6s
},

// Total raw scene duration (before overlap subtraction)
totalRawDuration: 1668,

// Final output duration
totalDuration: 1560, // 52 seconds
```

---

## File-by-File Implementation

### 1. UltauraPromo.tsx

**Path:** `src/UltauraPromo.tsx`

**Changes Required:**

1. **Remove imports:**
   ```typescript
   // REMOVE these imports:
   import { ProgressBar } from "./components";
   import { slide } from "@remotion/transitions/slide";
   import { wipe } from "@remotion/transitions/wipe";
   ```

2. **Add new imports:**
   ```typescript
   import { linearTiming } from "@remotion/transitions";
   import { TRANSITION_DURATION_FRAMES } from "./theme";
   ```

3. **Update scene imports:**
   ```typescript
   import {
     HookScene,
     VoiceSelectionScene,
     RemindersScene,
     ScheduleScene,
     InsightsSafetyScene,
     CallsScene,
     CTAScene,
   } from "./scenes";
   ```

4. **Define crossfade transition (use linearTiming, NOT springTiming for fades):**
   ```typescript
   // Soft crossfade - linear timing prevents overshoot/springy artifacts
   const crossfadeTransition = TRANSITION_DURATION_FRAMES;
   ```

5. **Replace all transitions with soft crossfade:**
   ```typescript
   <TransitionSeries.Transition
     presentation={fade()}
     timing={linearTiming({
       durationInFrames: crossfadeTransition,
       easing: easings.smooth, // Bezier curve for premium feel
     })}
   />
   ```

6. **Remove ProgressBar:**
   ```typescript
   // REMOVE: <ProgressBar /> (currently at line 170)
   ```

7. **Update scene order in TransitionSeries:**
   ```typescript
   <TransitionSeries>
     {/* Scene 1: Hook */}
     <TransitionSeries.Sequence durationInFrames={sections.hook.duration}>
       <HookScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 2: Voice Selection */}
     <TransitionSeries.Sequence durationInFrames={sections.voiceSelection.duration}>
       <VoiceSelectionScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 3: Reminders (card-based, no phone) */}
     <TransitionSeries.Sequence durationInFrames={sections.reminders.duration}>
       <RemindersScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 4: Schedule */}
     <TransitionSeries.Sequence durationInFrames={sections.schedule.duration}>
       <ScheduleScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 5: Insights + Safety (12 seconds for tab switch) */}
     <TransitionSeries.Sequence durationInFrames={sections.insightsSafety.duration}>
       <InsightsSafetyScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 6: Calls */}
     <TransitionSeries.Sequence durationInFrames={sections.calls.duration}>
       <CallsScene />
     </TransitionSeries.Sequence>

     <TransitionSeries.Transition
       presentation={fade()}
       timing={linearTiming({ durationInFrames: crossfadeTransition, easing: easings.smooth })}
     />

     {/* Scene 7: CTA - hold until end */}
     <TransitionSeries.Sequence durationInFrames={sections.cta.duration}>
       <CTAScene />
     </TransitionSeries.Sequence>
   </TransitionSeries>
   ```

---

### 2. Root.tsx Updates

**Path:** `src/Root.tsx`

Update duration calculation:

```typescript
import { TRANSITION_DURATION_FRAMES, TRANSITION_COUNT } from "./theme";

// Calculate total duration accounting for transition overlaps
const transitionDuration = TRANSITION_DURATION_FRAMES;
const numberOfTransitions = TRANSITION_COUNT;
const totalSceneDuration = Object.values(theme.sections).reduce(
  (acc, section) => acc + section.duration,
  0
);
const calculatedDuration = totalSceneDuration - (numberOfTransitions * transitionDuration);
// Should equal 1668 - 108 = 1560 frames
```

---

### 3. PhoneFrame.tsx - NO CHANGES TO DEFAULTS

**Path:** `src/components/PhoneFrame.tsx`

**IMPORTANT: Keep default props unchanged.** Specify scale and tilt per-scene instead.

Current defaults (keep as-is):
```typescript
scale = 1,           // KEEP
tiltIntensity = 1,   // KEEP (scenes will override with 0.3-0.4)
```

---

### 4. HookScene.tsx Updates

**Path:** `src/scenes/HookScene.tsx`

**Duration:** 180 frames (6 seconds)

**Changes Required:**

1. **Reduce wobble intensity:**
   ```typescript
   // BEFORE:
   const wobble = interpolate(Math.sin(frame * 0.5), [-1, 1], [-4, 4]);

   // AFTER:
   const wobble = interpolate(Math.sin(frame * 0.4), [-1, 1], [-2, 2]);
   ```

2. **Reduce ripple intensity:**
   ```typescript
   // BEFORE:
   const ripple1Progress = (frame % 60) / 60;

   // AFTER:
   const ripple1Progress = (frame % 90) / 90;  // Slower cycle
   const ripple2Progress = ((frame + 30) % 90) / 90;

   const getRippleStyle = (progress: number) => ({
     scale: interpolate(progress, [0, 1], [0.9, 1.8]),
     opacity: interpolate(progress, [0, 0.35, 1], [0, 0.25, 0]),
   });
   ```

3. **Update text (keep sizes, adjust timing for 180f duration):**
   - "What if your loved one" at frame 45 (fontSize: 46, fontWeight: 600)
   - "never felt alone?" at frame 75 (fontSize: 46, fontWeight: 700, primary color)

---

### 5. VoiceSelectionScene.tsx (NEW - Replace SolutionScene)

**Path:** `src/scenes/VoiceSelectionScene.tsx`

**Duration:** 210 frames (7 seconds)

**Visual:** Grid of 5 voice avatar tiles, then Ara gets selected

**Voice data:**
```typescript
const voices = [
  { id: "ara", name: "Ara", trait: "Warm", file: "voices/ara.svg" },
  { id: "eve", name: "Eve", trait: "Calm", file: "voices/eve.svg" },
  { id: "leo", name: "Leo", trait: "Friendly", file: "voices/leo.svg" },
  { id: "rex", name: "Rex", trait: "Confident", file: "voices/rex.svg" },
  { id: "sal", name: "Sal", trait: "Bright", file: "voices/sal.svg" },
];
```

**Animation flow:**
1. Header "Choose a voice." fades in (frame 0-20)
2. 5 tiles appear staggered (frame 15-55, delay: 15 + i*8)
3. "Ara" gets selected (frame 70) - glow + scale 1.05 + checkmark
4. "Selected: Ara" fades in (frame 90)

**Text copy (adjust timing for 210f):**
- "Find the perfect" at frame 120 (wordReveal)
- "companion." at frame 145 (glowReveal, primary color)

**Tile design:**
- Size: 140x180px
- Avatar: 80x80px rounded
- Name: fontSize 18, fontWeight 600
- Trait: fontSize 14, textSecondary

**Complete implementation:** See Appendix A

---

### 6. RemindersScene.tsx Updates

**Path:** `src/scenes/RemindersScene.tsx`

**Duration:** 210 frames (7 seconds)

**IMPORTANT: This is a CARD-BASED scene, NOT a phone scene. No PhoneFrame.**

**Changes Required:**

1. **Reduce to 2 reminder cards + "+3 more" hint:**
   ```typescript
   const reminders = [
     {
       icon: /* medication icon */,
       title: "Take Medication",
       time: "8:00 AM Daily",
       color: theme.colors.error,
     },
     {
       icon: /* calendar icon */,
       title: "Doctor Appointment",
       time: "Tomorrow 2:30 PM",
       color: theme.colors.info,
     },
   ];
   ```

2. **Increase card sizes for mobile readability:**
   ```typescript
   // ReminderCard styles:
   {
     borderRadius: 22,      // was 20
     padding: 26,           // was 24
     gap: 20,               // was 18
   }

   // Icon container:
   {
     width: 64,             // was 60
     height: 64,            // was 60
     borderRadius: 18,      // was 16
   }

   // SVG icons: width/height 34 (was 30)

   // Title: fontSize 20 (was 19)
   // Time: fontSize 16 (was 15)
   ```

3. **Add "+3 more" hint:**
   ```typescript
   <Sequence from={100} layout="none">
     <div style={{
       textAlign: "center",
       fontFamily: theme.fonts.body,
       fontSize: 15,
       color: theme.colors.textMuted,
       opacity: interpolate(frame - 100, [0, 20], [0, 0.7], { extrapolateRight: "clamp" }),
     }}>
       +3 more reminders
     </div>
   </Sequence>
   ```

4. **Reduce bell wobble:**
   ```typescript
   // BEFORE:
   const bellWobble = interpolate(Math.sin(frame * 0.3), [-1, 1], [-8, 8]);

   // AFTER:
   const bellWobble = interpolate(Math.sin(frame * 0.2), [-1, 1], [-5, 5]);
   ```

5. **Update text copy (timing for 210f):**
   - "Set reminders." at frame 130 (wordReveal)
   - "Never miss a thing." at frame 160 (glowReveal, primary color)

---

### 7. ScheduleScene.tsx (NEW - Replace ProblemScene)

**Path:** `src/scenes/ScheduleScene.tsx`

**Duration:** 210 frames (7 seconds)

**Visual:** Phone with week-view calendar showing scheduled calls

**PhoneFrame props (specify per-scene):**
```typescript
<PhoneFrame delay={0} scale={1.3} tiltIntensity={0.35}>
```

**UI Elements:**
- Header: "Call Schedule" (fontSize 24)
- Week columns: M T W T F S S
- Time slot row: "9:00 AM" with checkmarks on each day
- "Daily" badge + "Quiet hours respected" note

**Animation flow:**
1. Phone entrance (frame 0-20)
2. Header fade in (frame 10-25)
3. Calendar card entrance (frame 20-40)
4. Day labels staggered (frame 30-55)
5. Time slot highlight (frame 50-70)
6. Checkmarks appear staggered (frame 60-90)
7. Daily badge + note (frame 80-100)

**Text copy (timing for 210f):**
- "Schedule daily check-ins." at frame 130 (wordReveal)
- "Peace of mind for families." at frame 160 (glowReveal, primary color)

**Complete implementation:** See Appendix B

---

### 8. InsightsSafetyScene.tsx (NEW - Merge Dashboard + Safety)

**Path:** `src/scenes/InsightsSafetyScene.tsx`

**Duration:** 360 frames (12 seconds)

**Visual:** Single phone with tabbed UI - Insights tab first, then Safety tab

**PhoneFrame props (EMPHASIS - larger scale for readability):**
```typescript
<PhoneFrame delay={0} scale={1.4} tiltIntensity={0.3}>
```

**Tab transition timing:**
- Insights tab: frames 0-150 (5 seconds)
- Tab switch animation: frames 150-170 (0.67 seconds)
- Safety tab: frames 170-320 (5 seconds)
- Fade out: frames 320-360 (1.33 seconds)

**Insights tab content (frames 0-150):**
- Tab bar with "Insights" highlighted
- Mood chart (simplified, 7 bars for week)
- Summary card: "Mostly happy this week"
- **Caption:** "See how they're feeling." at frame 80 (wordReveal)

**Safety tab content (frames 170-320):**
- Tab bar with "Safety" highlighted
- Wellness alert card (warning): "Mom mentioned feeling tired"
- All-clear card (success): "Today's call went great"
- **Caption:** "Instant alerts when needed." at frame 230 (glowReveal, primary color)

**SafetyCard sizing (INCREASED for readability):**
```typescript
{
  width: "100%",          // Full width within phone padding
  maxWidth: 300,          // Constrained but larger than before
  borderRadius: 18,
  padding: 20,
  borderLeft: "4px solid",
}

// Icon container:
{
  width: 52,              // was 48
  height: 52,             // was 48
  borderRadius: 14,       // was 12
}

// SVG icon: width/height 26 (was 24)

// Title: fontSize 17, fontWeight 600 (was 16)
// Message: fontSize 15 (was 14)
```

**Complete implementation:** See Appendix C

---

### 9. CallsScene.tsx (Rename from AICallsScene)

**Path:** `src/scenes/CallsScene.tsx`

**Duration:** 270 frames (9 seconds)

**PhoneFrame props (specify per-scene):**
```typescript
<PhoneFrame delay={0} scale={1.3} tiltIntensity={0.35}>
```

**Key updates from AICallsScene:**

1. **Keep existing call UI** (avatar, waveform, timer, end button)

2. **Add live headline card (insert after waveform, around frame 100):**
   ```typescript
   <Sequence from={100} layout="none">
     <div style={{
       marginTop: 18,
       padding: 16,
       background: theme.colors.backgroundCard,
       borderRadius: 16,
       border: `1px solid ${theme.colors.info}30`,
       width: 220,
       opacity: interpolate(frame - 100, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
       transform: `translateY(${interpolate(frame - 100, [0, 20], [15, 0], { extrapolateRight: "clamp" })}px)`,
     }}>
       {/* Live pill */}
       <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
         <div style={{
           width: 8, height: 8, borderRadius: "50%",
           background: theme.colors.error,
           boxShadow: `0 0 8px ${theme.colors.error}`,
         }} />
         <span style={{
           fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600,
           color: theme.colors.error, textTransform: "uppercase", letterSpacing: 0.5,
         }}>
           Live
         </span>
       </div>
       <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 }}>
         Today's Weather
       </div>
       <div style={{ fontFamily: theme.fonts.heading, fontSize: 18, fontWeight: 600, color: theme.colors.textPrimary }}>
         Sunny and 72°
       </div>
     </div>
   </Sequence>
   ```

3. **Add speech bubble (frame 140):**
   ```typescript
   <Sequence from={140} layout="none">
     <div style={{
       marginTop: 14,
       padding: 14,
       background: `${theme.colors.primary}15`,
       borderRadius: 18,
       borderTopLeftRadius: 4,
       maxWidth: 240,
       opacity: interpolate(frame - 140, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
       transform: `scale(${interpolate(frame - 140, [0, 15], [0.9, 1], { extrapolateRight: "clamp" })})`,
     }}>
       <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textPrimary, fontStyle: "italic" }}>
         "Did you hear? It's beautiful outside today!"
       </div>
     </div>
   </Sequence>
   ```

4. **Update text copy (timing for 270f):**
   - "Chat about anything." at frame 180 (wordReveal)
   - "From weather to memories." at frame 210 (glowReveal, primary color)

---

### 10. CTAScene.tsx Updates

**Path:** `src/scenes/CTAScene.tsx`

**Duration:** 228 frames (7.6 seconds) - **Hold until final frame**

**Changes Required:**

1. **Reduce/remove FloatingParticle instances** (keep 0-4 for subtle background)

2. **Replace trust badges with single line:**
   ```typescript
   {/* Trust line - SIMPLIFIED */}
   <Sequence from={70} layout="none">
     <div style={{
       display: "flex",
       flexDirection: "column",
       alignItems: "center",
       gap: 16,
       opacity: interpolate(frame - 70, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
     }}>
       {/* Single trust line */}
       <div style={{
         fontFamily: theme.fonts.body,
         fontSize: 16,
         color: theme.colors.textMuted,
         display: "flex",
         alignItems: "center",
         gap: 12,
       }}>
         <span>Secure</span>
         <span style={{ opacity: 0.4 }}>•</span>
         <span>Private</span>
         <span style={{ opacity: 0.4 }}>•</span>
         <span>24/7</span>
       </div>

       {/* Trial info */}
       <div style={{
         fontFamily: theme.fonts.body,
         fontSize: 17,
         color: theme.colors.textSecondary,
         display: "flex",
         alignItems: "center",
         gap: 10,
       }}>
         <span>3-day free trial</span>
         <span style={{ opacity: 0.5 }}>•</span>
         <span>No credit card</span>
       </div>
     </div>
   </Sequence>
   ```

3. **NO fade to black** - CTA holds until final frame

---

### 11. Scene Index Updates

**Path:** `src/scenes/index.ts`

```typescript
export { HookScene } from "./HookScene";
export { VoiceSelectionScene } from "./VoiceSelectionScene";
export { RemindersScene } from "./RemindersScene";
export { ScheduleScene } from "./ScheduleScene";
export { InsightsSafetyScene } from "./InsightsSafetyScene";
export { CallsScene } from "./CallsScene";
export { CTAScene } from "./CTAScene";
```

---

## Files to Delete After Implementation

Once new scenes are created:
- `src/scenes/ProblemScene.tsx` (replaced by ScheduleScene)
- `src/scenes/SolutionScene.tsx` (replaced by VoiceSelectionScene)
- `src/scenes/AICallsScene.tsx` (replaced by CallsScene)
- `src/scenes/DashboardScene.tsx` (merged into InsightsSafetyScene)
- `src/scenes/SafetyScene.tsx` (merged into InsightsSafetyScene)

---

## PhoneFrame Scale/Tilt Reference (Per-Scene)

| Scene | scale | tiltIntensity | Notes |
|-------|-------|---------------|-------|
| VoiceSelectionScene | N/A | N/A | No phone frame |
| RemindersScene | N/A | N/A | Card-based, no phone |
| ScheduleScene | 1.3 | 0.35 | Standard |
| InsightsSafetyScene | 1.4 | 0.3 | EMPHASIS - larger for readability |
| CallsScene | 1.3 | 0.35 | Standard |

---

## Accessibility & Motion Guidelines

### Contrast Requirements
- Small UI text: fontWeight 600 (bumped from 500)
- Add subtle dark scrims behind text on gradients if needed

### Motion Sensitivity
- Wobble/tilt: Reduced to 0.3-0.4 intensity
- Ripple effects: Slower cycles (90 frames vs 60)
- Particle count: Reduced
- No fast flashing or glow pulses
- Favor short, single-purpose fades over looping motion

### Layout Safety
- Generous margins (40-50px from edges)
- Avoid text near bottom edge (phone UI overlay zone)

---

## Background Music Recommendations

**Current track:** `public/background-music.mp3` (keep as default)

### Specific Track Recommendations (Commercial License)

| # | Track | Direct URL | License Verified |
|---|-------|-----------|------------------|
| 1 | Bensound - "Hopeful Ambient" | [Direct Link](https://www.bensound.com/royalty-free-music/track/hopeful-ambient) | ⬜ |
| 2 | Bensound - "Evolution" | [Direct Link](https://www.bensound.com/royalty-free-music/track/evolution-main) | ⬜ |
| 3 | Bensound - "A New Beginning" | [Direct Link](https://www.bensound.com/royalty-free-music/track/a-new-beginning) | ⬜ |
| 4 | Pond5 - "BALLAD (60s version)" | [Direct Link](https://www.pond5.com/royalty-free-music/item/231441886-ballad-full-length-emotional-epic-piano-and-strings) | ⬜ |
| 5 | Pond5 - "Cinematic Emotional Piano" | [Direct Link](https://www.pond5.com/royalty-free-music/item/47095057-cinematic-emotional-piano) | ⬜ |

**Option 1: Bensound - "Hopeful Ambient"** (Recommended)
- Artist: Matt Cole
- Style: Piano + synth layers
- Mood: Hopeful, warm, perfect for technology content
- Tempo: ~70-80 BPM
- License: Royalty-free with attribution (free) or no attribution (paid ~$50)
- **Usage notes:** Start at 0:00, natural fade. Fits 52s duration well.

**Option 2: Bensound - "Evolution"**
- Artists: Bensound
- Style: Soft electronic, inspiring, builds gradually
- Mood: Warm, modern, premium feel
- License: Royalty-free with attribution (free) or no attribution (paid ~$50)

**Option 3: Bensound - "A New Beginning"**
- Artist: Bensound
- Style: Soft piano, uplifting, hopeful
- Mood: Peaceful, approachable, emotional
- License: Royalty-free with attribution (free) or no attribution (paid ~$50)

**Option 4: Pond5 - "BALLAD (Emotional/Epic Piano and Strings)"**
- Style: Piano + strings, emotional/inspirational
- Mood: Hopeful, suitable for stories and commercials
- **Available in 60-second version** - perfect length match
- License: Standard Pond5 commercial license ($35-50 one-time)
- **Usage notes:** 60-sec version eliminates need for editing.

**Option 5: Pond5 - "Cinematic Emotional Piano"**
- Style: Piano with strings and contemporary pads
- Mood: Hopeful, yearning, builds to climax then hopeful ending
- License: Standard Pond5 commercial license ($35-50 one-time)

### License Verification Checklist

Before using any track, verify:
- [ ] Track URL loads correctly and plays expected audio
- [ ] License permits commercial/advertising use
- [ ] Attribution requirements documented (if any)
- [ ] License purchased (if required for no-attribution)
- [ ] Track downloaded and saved to `public/background-music.mp3`

### Licensing Notes

| Source | Commercial Ads | Attribution | Price |
|--------|---------------|-------------|-------|
| Bensound (free) | Yes | Required | Free |
| Bensound (paid) | Yes | Not required | ~$50/track |
| Pond5 | Yes | Not required | $35-50/track |
| Epidemic Sound | Yes | Not required | $9.99-39.99/mo subscription |
| Artlist | Yes | Not required | $9.99/mo+ subscription |

### Audio Integration Settings

Current settings in `UltauraPromo.tsx` (keep as-is):
- Volume: 20% (0.2)
- Fade in: 2 seconds at start
- Fade out: 2 seconds at end

---

## Render Commands

**Preview during development:**
```bash
cd /Users/josephsilvagnoli/Ultaura/remotion && pnpm studio
```

**Final render:**
```bash
cd /Users/josephsilvagnoli/Ultaura/remotion && pnpm render
```

**Output:** `out/ultaura-promo.mp4`

> **Note:** Rendering uses `src/` directly. Running `pnpm build` first is only necessary if your tooling specifically requires compiled `dist/` output.

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Update `src/theme.ts` with new sections, transition constants
- [ ] Update `src/Root.tsx` with correct duration calculation

### Phase 2: Main Composition
- [ ] Update `src/UltauraPromo.tsx`:
  - [ ] Remove ProgressBar
  - [ ] Replace all transitions with `linearTiming` crossfades
  - [ ] Update scene imports and order

### Phase 3: Scene Updates
- [ ] Update `src/scenes/HookScene.tsx` - reduce motion intensity
- [ ] Create `src/scenes/VoiceSelectionScene.tsx` (or rename SolutionScene)
- [ ] Update `src/scenes/RemindersScene.tsx` - 2 cards + hint, larger sizes
- [ ] Create `src/scenes/ScheduleScene.tsx` (or rename ProblemScene)
- [ ] Create `src/scenes/InsightsSafetyScene.tsx` (merge Dashboard + Safety)
- [ ] Create `src/scenes/CallsScene.tsx` (or rename AICallsScene) - add live headline
- [ ] Update `src/scenes/CTAScene.tsx` - simplify trust badges

### Phase 4: Cleanup
- [ ] Update `src/scenes/index.ts` with new exports
- [ ] Delete old scene files (ProblemScene, SolutionScene, AICallsScene, DashboardScene, SafetyScene)

### Phase 5: Verify
- [ ] Run `pnpm studio` to preview
- [ ] Verify total duration is ~52 seconds
- [ ] Check all transitions are smooth crossfades
- [ ] Verify text readability on mobile
- [ ] Final render with `pnpm render`

---

## Post-Change Verification Checklist

**Run after all implementation is complete:**

```bash
cd /Users/josephsilvagnoli/Ultaura/remotion && pnpm studio
```

### Visual Verification (in Remotion Studio)

- [ ] **No watermark visible** - Confirm Watermark component is not rendered
- [ ] **No progress bar visible** - Confirm ProgressBar component removed
- [ ] **Final duration ~52s** - Check timeline shows approximately 1560 frames / 52 seconds
- [ ] **Phone scales correct:**
  - [ ] ScheduleScene: Phone appears at ~1.3x scale with subtle tilt
  - [ ] InsightsSafetyScene: Phone appears LARGER (~1.4x) for emphasis
  - [ ] CallsScene: Phone appears at ~1.3x scale with subtle tilt
- [ ] **Safety/Reminders readability:**
  - [ ] RemindersScene cards are large and readable (no phone frame, card-based)
  - [ ] SafetyCard text is legible at 15-17px sizes
- [ ] **Transitions smooth:**
  - [ ] All scene transitions use soft crossfade (no slide/wipe)
  - [ ] No springy/bouncy overshoot on fades
- [ ] **Scene order correct:** Hook → Voice → Reminders → Schedule → Insights+Safety → Calls → CTA

### Mobile Readability Test

Preview the render on an actual phone (or phone-sized viewport):
- [ ] All text is readable without squinting
- [ ] Phone mockup content is clearly visible
- [ ] No text extends beyond safe margins

### Final Render

```bash
cd /Users/josephsilvagnoli/Ultaura/remotion && pnpm render
```

- [ ] Render completes without errors
- [ ] Output file exists at `out/ultaura-promo.mp4`
- [ ] File plays correctly in video player

---

## Summary of Changes

1. ✅ Remove ProgressBar component
2. ✅ Restructure to 7 scenes with correct duration math (1668f raw → 1560f output)
3. ✅ Replace all transitions with linear-timed crossfades (no overshoot)
4. ✅ Keep PhoneFrame defaults unchanged - specify scale/tilt per-scene
5. ✅ Specify CallsScene phone scale (1.3) and tilt (0.35) explicitly
6. ✅ Enlarge Safety cards for readability (width 100%, fontSize 15-17)
7. ✅ Clarify RemindersScene is card-based (no phone frame)
8. ✅ Add build notes about src vs dist
9. ✅ Add specific music track recommendations with licenses
10. ✅ Per-tab captions in InsightsSafetyScene
11. ✅ Create VoiceSelectionScene with avatar tiles
12. ✅ Create ScheduleScene with week calendar
13. ✅ Reduce motion intensity throughout

---

## Appendix A: VoiceSelectionScene Complete Implementation

```typescript
import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
  Img,
  staticFile,
} from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

const voices = [
  { id: "ara", name: "Ara", trait: "Warm", file: "voices/ara.svg" },
  { id: "eve", name: "Eve", trait: "Calm", file: "voices/eve.svg" },
  { id: "leo", name: "Leo", trait: "Friendly", file: "voices/leo.svg" },
  { id: "rex", name: "Rex", trait: "Confident", file: "voices/rex.svg" },
  { id: "sal", name: "Sal", trait: "Bright", file: "voices/sal.svg" },
];

interface VoiceTileProps {
  voice: typeof voices[0];
  index: number;
  frame: number;
  fps: number;
  isSelected: boolean;
  delay: number;
}

const VoiceTile: React.FC<VoiceTileProps> = ({
  voice,
  index,
  frame,
  fps,
  isSelected,
  delay,
}) => {
  const adjustedFrame = Math.max(0, frame - delay);

  const tileSpring = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const selectionProgress = isSelected
    ? spring({
        frame: Math.max(0, frame - 70),
        fps,
        config: springs.bouncy,
      })
    : 0;

  const selectedScale = interpolate(selectionProgress, [0, 1], [1, 1.05]);
  const glowOpacity = interpolate(selectionProgress, [0, 1], [0, 0.4]);

  return (
    <div
      style={{
        width: 140,
        height: 180,
        background: theme.colors.backgroundCard,
        borderRadius: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 16,
        opacity,
        transform: `scale(${tileSpring * selectedScale}) translateY(${interpolate(tileSpring, [0, 1], [20, 0])}px)`,
        border: isSelected
          ? `2px solid ${theme.colors.primary}`
          : `1px solid ${theme.colors.textMuted}25`,
        boxShadow: isSelected
          ? `0 0 30px ${theme.colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}, 0 8px 24px rgba(0,0,0,0.3)`
          : `0 6px 20px rgba(0, 0, 0, 0.2)`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${theme.colors.backgroundLight} 0%, ${theme.colors.background} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.textMuted}30`,
        }}
      >
        <Img
          src={staticFile(voice.file)}
          style={{ width: 60, height: 60, objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 18,
          fontWeight: 600,
          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
        }}
      >
        {voice.name}
      </div>

      <div
        style={{
          fontFamily: theme.fonts.body,
          fontSize: 14,
          color: theme.colors.textSecondary,
        }}
      >
        {voice.trait}
      </div>

      {isSelected && selectionProgress > 0.5 && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: theme.colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 8px ${theme.colors.primary}60`,
            transform: `scale(${selectionProgress})`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const VoiceSelectionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerEntrance = spring({
    frame,
    fps,
    config: springs.smooth,
  });

  const selectedVoice = "ara";

  return (
    <SceneLayout background={<GradientBackground variant="aurora" />}>
      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 38,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              opacity: headerEntrance,
              transform: `translateY(${interpolate(headerEntrance, [0, 1], [-20, 0])}px)`,
            }}
          >
            Choose a voice.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16 }}>
              {voices.slice(0, 3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={15 + i * 8}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {voices.slice(3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i + 3}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={15 + (i + 3) * 8}
                />
              ))}
            </div>
          </div>

          <Sequence from={90} layout="none">
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 18,
                color: theme.colors.textSecondary,
                opacity: interpolate(frame - 90, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Selected: <span style={{ color: theme.colors.primary, fontWeight: 600 }}>Ara</span>
            </div>
          </Sequence>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={120} layout="none">
          <AnimatedText
            text="Find the perfect"
            style={{ fontSize: 36, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={145} layout="none">
          <AnimatedText
            text="companion."
            style={{ fontSize: 36, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
```

---

## Appendix B: ScheduleScene Complete Implementation

```typescript
import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const ScheduleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const days = ["M", "T", "W", "T", "F", "S", "S"];

  const cardEntrance = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: springs.smooth,
  });

  const highlightEntrance = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: springs.snappy,
  });

  const badgeEntrance = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: springs.bouncy,
  });

  return (
    <SceneLayout background={<GradientBackground variant="default" showParticles={false} />}>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.3} tiltIntensity={0.35}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 20,
              paddingTop: 50,
            }}
          >
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 24,
                fontWeight: 700,
                color: theme.colors.textPrimary,
                marginBottom: 24,
                opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Call Schedule
            </div>

            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 20,
                padding: 20,
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [20, 0])}px)`,
                border: `1px solid ${theme.colors.primary}20`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${theme.colors.textMuted}15`,
                }}
              >
                {days.map((day, i) => {
                  const dayDelay = 30 + i * 4;
                  const dayEntrance = spring({
                    frame: Math.max(0, frame - dayDelay),
                    fps,
                    config: springs.snappy,
                  });

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: theme.fonts.body,
                        fontSize: 14,
                        fontWeight: 600,
                        color: theme.colors.textSecondary,
                        opacity: dayEntrance,
                        transform: `translateY(${interpolate(dayEntrance, [0, 1], [10, 0])}px)`,
                      }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 12,
                  background: `${theme.colors.primary}15`,
                  borderRadius: 12,
                  opacity: highlightEntrance,
                  transform: `scale(${interpolate(highlightEntrance, [0, 1], [0.95, 1])})`,
                  border: `1px solid ${theme.colors.primary}30`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.primary,
                    minWidth: 70,
                  }}
                >
                  9:00 AM
                </div>

                <div style={{ display: "flex", flex: 1, justifyContent: "space-around" }}>
                  {days.map((_, i) => {
                    const checkDelay = 60 + i * 4;
                    const checkEntrance = spring({
                      frame: Math.max(0, frame - checkDelay),
                      fps,
                      config: springs.bouncy,
                    });

                    return (
                      <div
                        key={i}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: theme.colors.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transform: `scale(${checkEntrance})`,
                          boxShadow: `0 2px 8px ${theme.colors.primary}40`,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 16,
                  opacity: badgeEntrance,
                  transform: `translateY(${interpolate(badgeEntrance, [0, 1], [10, 0])}px)`,
                }}
              >
                <div
                  style={{
                    padding: "6px 14px",
                    background: `${theme.colors.success}20`,
                    borderRadius: 20,
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.success,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={theme.colors.success}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  Daily
                </div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted }}>
                  Quiet hours respected
                </div>
              </div>
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <Sequence from={130} layout="none">
          <AnimatedText
            text="Schedule daily check-ins."
            style={{ fontSize: 34, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={160} layout="none">
          <AnimatedText
            text="Peace of mind for families."
            style={{ fontSize: 34, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
```

---

## Appendix C: InsightsSafetyScene Complete Implementation

```typescript
import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

const MoodChart: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const moodData = [
    { value: 0.7, emoji: "😊" },
    { value: 0.85, emoji: "😊" },
    { value: 0.6, emoji: "😐" },
    { value: 0.9, emoji: "😊" },
    { value: 0.75, emoji: "😊" },
    { value: 0.8, emoji: "😊" },
    { value: 0.95, emoji: "😄" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90 }}>
      {moodData.map((item, i) => {
        const barEntrance = spring({
          frame: Math.max(0, frame - 30 - i * 5),
          fps,
          config: springs.snappy,
        });

        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, opacity: barEntrance }}>{item.emoji}</span>
            <div
              style={{
                width: "100%",
                height: item.value * 55 * barEntrance,
                background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 100%)`,
                borderRadius: 5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const SafetyCard: React.FC<{
  type: "warning" | "success";
  title: string;
  message: string;
  frame: number;
  fps: number;
  delay: number;
}> = ({ type, title, message, frame, fps, delay }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  const entrance = spring({ frame: adjustedFrame, fps, config: springs.smooth });

  const color = type === "warning" ? theme.colors.warning : theme.colors.success;
  const icon = type === "warning"
    ? "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
    : "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z";

  return (
    <div
      style={{
        background: theme.colors.backgroundCard,
        borderRadius: 18,
        padding: 20,
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: entrance,
        transform: `translateX(${interpolate(entrance, [0, 1], [type === "warning" ? -30 : 30, 0])}px)`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        width: "100%",
        maxWidth: 300,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: theme.fonts.heading, fontSize: 17, fontWeight: 600, color: theme.colors.textPrimary }}>
          {title}
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.textSecondary, marginTop: 3 }}>
          {message}
        </div>
      </div>
    </div>
  );
};

export const InsightsSafetyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tab transition at frame 150 (5 seconds)
  const tabTransitionFrame = 150;
  const showSafetyTab = frame >= tabTransitionFrame;

  const insightsOpacity = interpolate(
    frame,
    [tabTransitionFrame - 15, tabTransitionFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const safetyOpacity = interpolate(
    frame,
    [tabTransitionFrame, tabTransitionFrame + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.4} tiltIntensity={0.3}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 18,
              paddingTop: 48,
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 22,
                background: theme.colors.backgroundCard,
                borderRadius: 14,
                padding: 5,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 11,
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  color: !showSafetyTab ? theme.colors.primary : theme.colors.textSecondary,
                  background: !showSafetyTab ? `${theme.colors.primary}20` : "transparent",
                }}
              >
                Insights
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 11,
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  color: showSafetyTab ? theme.colors.primary : theme.colors.textSecondary,
                  background: showSafetyTab ? `${theme.colors.primary}20` : "transparent",
                }}
              >
                Safety
              </div>
            </div>

            {/* Insights content */}
            <div style={{ position: "absolute", left: 18, right: 18, top: 115, opacity: insightsOpacity }}>
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 16,
                  border: `1px solid ${theme.colors.primary}15`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>📊</span> Weekly Mood
                </div>
                <MoodChart frame={frame} fps={fps} />
              </div>

              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 18,
                  padding: 20,
                  border: `1px solid ${theme.colors.success}20`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.success,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>😊</span> Mostly happy this week
                </div>
              </div>
            </div>

            {/* Safety content */}
            <div
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                top: 115,
                opacity: safetyOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <SafetyCard
                type="warning"
                title="Wellness Check"
                message="Mom mentioned feeling tired"
                frame={frame}
                fps={fps}
                delay={tabTransitionFrame + 10}
              />
              <SafetyCard
                type="success"
                title="All Clear"
                message="Today's call went great"
                frame={frame}
                fps={fps}
                delay={tabTransitionFrame + 30}
              />
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        {/* Insights tab caption */}
        <Sequence from={80} durationInFrames={tabTransitionFrame - 80} layout="none">
          <AnimatedText
            text="See how they're feeling."
            style={{ fontSize: 34, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>

        {/* Safety tab caption */}
        <Sequence from={tabTransitionFrame + 60} layout="none">
          <AnimatedText
            text="Instant alerts when needed."
            style={{ fontSize: 34, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
```
