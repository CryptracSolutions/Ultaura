import { useVideoConfig, interpolate, AbsoluteFill, Sequence } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { theme } from "./theme";
import { ProgressBar, Watermark } from "./components";
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

// Royalty-free ambient/corporate music from Pixabay
const BACKGROUND_MUSIC_URL =
  "https://cdn.pixabay.com/audio/2024/11/29/audio_5abe58a705.mp3";

// Royalty-free whoosh sound effect for transitions
const WHOOSH_SOUND_URL =
  "https://cdn.pixabay.com/audio/2022/03/24/audio_1ca2a0c5e2.mp3";

export const UltauraPromo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const { sections } = theme;

  // Transition duration in frames (0.5 seconds)
  const transitionDuration = Math.round(fps * 0.5);

  // Fade in/out duration for music
  const musicFadeFrames = fps * 2; // 2 seconds

  // Calculate transition start frames (accounting for TransitionSeries overlaps)
  const getTransitionFrame = (sceneIndex: number) => {
    const sceneDurations = [
      sections.hook.duration,
      sections.problem.duration,
      sections.solution.duration,
      sections.aiCalls.duration,
      sections.dashboard.duration,
      sections.safety.duration,
      sections.reminders.duration,
    ];
    let frame = 0;
    for (let i = 0; i < sceneIndex; i++) {
      frame += sceneDurations[i] - transitionDuration;
    }
    return frame;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.background,
        overflow: "hidden",
      }}
    >
      {/* Background Music with fade in/out */}
      <Audio
        src={BACKGROUND_MUSIC_URL}
        volume={(f: number) => {
          // Fade in at start
          if (f < musicFadeFrames) {
            return interpolate(f, [0, musicFadeFrames], [0, 0.35]);
          }
          // Fade out at end
          if (f > durationInFrames - musicFadeFrames) {
            return interpolate(
              f,
              [durationInFrames - musicFadeFrames, durationInFrames],
              [0.35, 0]
            );
          }
          // Normal volume
          return 0.35;
        }}
        loop
      />

      {/* Whoosh sound effects on slide transitions */}
      {[2, 3, 4, 5].map((sceneIndex) => (
        <Sequence key={sceneIndex} from={getTransitionFrame(sceneIndex)} layout="none">
          <Audio src={WHOOSH_SOUND_URL} volume={0.15} />
        </Sequence>
      ))}

      <TransitionSeries>
        {/* Scene 1: Hook (0-5s) */}
        <TransitionSeries.Sequence durationInFrames={sections.hook.duration}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 2: Problem (5-12s) */}
        <TransitionSeries.Sequence durationInFrames={sections.problem.duration}>
          <ProblemScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 3: Solution (12-18s) */}
        <TransitionSeries.Sequence durationInFrames={sections.solution.duration}>
          <SolutionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 4: AI Calls Feature (18-26s) */}
        <TransitionSeries.Sequence durationInFrames={sections.aiCalls.duration}>
          <AICallsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 5: Dashboard Feature (26-34s) */}
        <TransitionSeries.Sequence durationInFrames={sections.dashboard.duration}>
          <DashboardScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 6: Safety Feature (34-40s) */}
        <TransitionSeries.Sequence durationInFrames={sections.safety.duration}>
          <SafetyScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 7: Reminders Feature (40-46s) */}
        <TransitionSeries.Sequence durationInFrames={sections.reminders.duration}>
          <RemindersScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 8: CTA (46-52s) */}
        <TransitionSeries.Sequence durationInFrames={sections.cta.duration}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Progress bar at bottom */}
      <ProgressBar />

      {/* Watermark in top-right */}
      <Watermark position="top-right" />
    </AbsoluteFill>
  );
};
