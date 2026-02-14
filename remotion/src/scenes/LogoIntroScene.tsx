import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SceneText } from "../types";
import { theme } from "../theme";
import { GradientOrb } from "../components/GradientOrb";
import { LogoReveal } from "../components/LogoReveal";
import { ParticleField } from "../components/ParticleField";

const LogoEntry: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const translateY = interpolate(
    spring({ frame, fps, config: { damping: 8 } }),
    [0, 1],
    [200, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div style={{ transform: `translateY(${translateY}px)` }}>
      <LogoReveal />
    </div>
  );
};

const BrandName: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 20], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          fontFamily: theme.fonts.manrope,
          color: theme.colors.stone900,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 60px",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const FadeOut: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.warmBg, opacity }} />
  );
};

export const LogoIntroScene: React.FC<{ sceneText: SceneText }> = ({
  sceneText,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.warmBg }}>
      <Sequence from={0}>
        <GradientOrb size={600} delay={0} />
      </Sequence>

      <Sequence from={30} premountFor={15}>
        <LogoEntry />
      </Sequence>

      <Sequence from={60} premountFor={15}>
        <ParticleField
          count={50}
          triggerFrame={0}
          centerX={540}
          centerY={800}
          maxRadius={300}
          duration={50}
        />
      </Sequence>

      <Sequence from={100} premountFor={15}>
        <BrandName text={sceneText.brandName} />
      </Sequence>

      <Sequence from={220}>
        <FadeOut />
      </Sequence>
    </AbsoluteFill>
  );
};
