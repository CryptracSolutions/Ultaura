import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { VideoProps } from "./types";
import { LogoIntroScene } from "./scenes/LogoIntroScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { InteractiveDemoScene } from "./scenes/InteractiveDemoScene";
import { UserBenefitsScene } from "./scenes/UserBenefitsScene";
import { CTAScene } from "./scenes/CTAScene";

export const UltauraAd: React.FC<VideoProps> = ({
  sceneText,
  voiceCharacter,
}) => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={316}>
          <LogoIntroScene sceneText={sceneText} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={316}>
          <DashboardScene sceneText={sceneText} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={316}>
          <InteractiveDemoScene
            sceneText={sceneText}
            voiceCharacter={voiceCharacter}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={316}>
          <UserBenefitsScene sceneText={sceneText} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={316}>
          <CTAScene sceneText={sceneText} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
