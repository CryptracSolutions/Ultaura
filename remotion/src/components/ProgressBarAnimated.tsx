import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type ProgressBarAnimatedProps = {
  targetPercent: number;
  delay?: number;
  duration?: number;
  width?: number;
  height?: number;
  color?: string;
  showParticleTrail?: boolean;
};

export const ProgressBarAnimated: React.FC<ProgressBarAnimatedProps> = ({
  targetPercent,
  delay = 0,
  duration = 60,
  width = 900,
  height = 16,
  color: _color = theme.colors.primary,
  showParticleTrail = true,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [delay, delay + duration],
    [0, targetPercent / 100],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const fillWidth = width * progress;

  const particles = showParticleTrail
    ? Array.from({ length: 6 }, (_, i) => {
        const yOffset = Math.sin(i * 0.8 + frame * 0.3) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: fillWidth - 2,
              top: height / 2 + yOffset - 2,
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: theme.colors.cyan400,
              opacity: 0.3 + (i % 5) * 0.08,
            }}
          />
        );
      })
    : null;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: height / 2,
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: fillWidth,
          height,
          borderRadius: height / 2,
          background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.cyan400})`,
        }}
      />
      {particles}
    </div>
  );
};
