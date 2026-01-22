import React from "react";
import {
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { theme, springs } from "./theme";
import { ProgressBar } from "./components";
import {
  HookScene,
  ProblemScene,
  SolutionScene,
  AICallsScene,
  DashboardScene,
  SafetyScene,
  RemindersScene,
  CTAScene,
} from "./scenes";

export const UltauraPromo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const { sections } = theme;

  // Transition durations
  const fadeTransition = Math.round(fps * 0.5);
  const slideTransition = Math.round(fps * 0.6);
  const wipeTransition = Math.round(fps * 0.5);

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
        {/* Scene 1: Hook (0-5s) */}
        <TransitionSeries.Sequence durationInFrames={sections.hook.duration}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: fadeTransition,
          })}
        />

        {/* Scene 2: Problem (5-12s) */}
        <TransitionSeries.Sequence durationInFrames={sections.problem.duration}>
          <ProblemScene />
        </TransitionSeries.Sequence>

        {/* Wipe transition - more dramatic reveal for solution */}
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom-left" })}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: wipeTransition,
          })}
        />

        {/* Scene 3: Solution (12-18s) */}
        <TransitionSeries.Sequence durationInFrames={sections.solution.duration}>
          <SolutionScene />
        </TransitionSeries.Sequence>

        {/* Slide with spring timing for more organic motion */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: slideTransition,
          })}
        />

        {/* Scene 4: AI Calls Feature (18-26s) */}
        <TransitionSeries.Sequence durationInFrames={sections.aiCalls.duration}>
          <AICallsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: slideTransition,
          })}
        />

        {/* Scene 5: Dashboard Feature (26-34s) */}
        <TransitionSeries.Sequence durationInFrames={sections.dashboard.duration}>
          <DashboardScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: slideTransition,
          })}
        />

        {/* Scene 6: Safety Feature (34-40s) */}
        <TransitionSeries.Sequence durationInFrames={sections.safety.duration}>
          <SafetyScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: slideTransition,
          })}
        />

        {/* Scene 7: Reminders Feature (40-46s) */}
        <TransitionSeries.Sequence durationInFrames={sections.reminders.duration}>
          <RemindersScene />
        </TransitionSeries.Sequence>

        {/* Fade for final CTA - elegant finish */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({
            config: springs.smooth,
            durationInFrames: fadeTransition,
          })}
        />

        {/* Scene 8: CTA (46-52s) */}
        <TransitionSeries.Sequence durationInFrames={sections.cta.duration}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Progress bar at bottom */}
      <ProgressBar />

    </AbsoluteFill>
  );
};
