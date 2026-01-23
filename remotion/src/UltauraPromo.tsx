import React from "react";
import {
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Audio,
  staticFile,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { theme, easings, TRANSITION_DURATION_FRAMES } from "./theme";
import {
  HookScene,
  VoiceSelectionScene,
  RemindersScene,
  ScheduleScene,
  InsightsSafetyScene,
  CallsScene,
  CTAScene,
} from "./scenes";

export const UltauraPromo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const { sections } = theme;

  // Transition duration - faster for TikTok/Reels pacing
  const transitionDuration = TRANSITION_DURATION_FRAMES;

  // Fade in/out duration for music
  const musicFadeFrames = fps * 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.background,
        overflow: "hidden",
      }}
    >
      {/* Background Music with fade in/out */}
      <Audio
        src={staticFile("background-music.mp3")}
        trimAfter={durationInFrames}
        volume={(f: number) => {
          // Fade in at start
          if (f < musicFadeFrames) {
            return interpolate(f, [0, musicFadeFrames], [0, 0.2]);
          }
          // Fade out at end
          if (f > durationInFrames - musicFadeFrames) {
            return interpolate(
              f,
              [durationInFrames - musicFadeFrames, durationInFrames],
              [0.2, 0]
            );
          }
          // Normal volume
          return 0.2;
        }}
      />

      <TransitionSeries>
        {/* Scene 1: Hook */}
        <TransitionSeries.Sequence durationInFrames={sections.hook.duration}>
          <HookScene />
        </TransitionSeries.Sequence>

        {/* Transition: Hook -> VoiceSelection (slide from bottom) */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.smooth,
          })}
        />

        {/* Scene 2: Voice Selection */}
        <TransitionSeries.Sequence durationInFrames={sections.voiceSelection.duration}>
          <VoiceSelectionScene />
        </TransitionSeries.Sequence>

        {/* Transition: VoiceSelection -> Reminders (wipe from left) */}
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.smooth,
          })}
        />

        {/* Scene 3: Reminders */}
        <TransitionSeries.Sequence durationInFrames={sections.reminders.duration}>
          <RemindersScene />
        </TransitionSeries.Sequence>

        {/* Transition: Reminders -> Schedule (fade) */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.smooth,
          })}
        />

        {/* Scene 4: Schedule */}
        <TransitionSeries.Sequence durationInFrames={sections.schedule.duration}>
          <ScheduleScene />
        </TransitionSeries.Sequence>

        {/* Transition: Schedule -> InsightsSafety (slide from right) */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.smooth,
          })}
        />

        {/* Scene 5: Insights + Safety */}
        <TransitionSeries.Sequence durationInFrames={sections.insightsSafety.duration}>
          <InsightsSafetyScene />
        </TransitionSeries.Sequence>

        {/* Transition: InsightsSafety -> Calls (slide from top) */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-top" })}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.smooth,
          })}
        />

        {/* Scene 6: Calls */}
        <TransitionSeries.Sequence durationInFrames={sections.calls.duration}>
          <CallsScene />
        </TransitionSeries.Sequence>

        {/* Transition: Calls -> CTA (premium fade) */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: transitionDuration,
            easing: easings.gentle,
          })}
        />

        {/* Scene 7: CTA */}
        <TransitionSeries.Sequence durationInFrames={sections.cta.duration}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
