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

  // Transition duration
  const crossfadeTransition = TRANSITION_DURATION_FRAMES;

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

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
          })}
        />

        {/* Scene 2: Voice Selection */}
        <TransitionSeries.Sequence durationInFrames={sections.voiceSelection.duration}>
          <VoiceSelectionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
          })}
        />

        {/* Scene 3: Reminders */}
        <TransitionSeries.Sequence durationInFrames={sections.reminders.duration}>
          <RemindersScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
          })}
        />

        {/* Scene 4: Schedule */}
        <TransitionSeries.Sequence durationInFrames={sections.schedule.duration}>
          <ScheduleScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
          })}
        />

        {/* Scene 5: Insights + Safety */}
        <TransitionSeries.Sequence durationInFrames={sections.insightsSafety.duration}>
          <InsightsSafetyScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
          })}
        />

        {/* Scene 6: Calls */}
        <TransitionSeries.Sequence durationInFrames={sections.calls.duration}>
          <CallsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({
            durationInFrames: crossfadeTransition,
            easing: easings.smooth,
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
