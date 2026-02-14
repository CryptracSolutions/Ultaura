import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type ParticleFieldProps = {
  count: number;
  triggerFrame: number;
  centerX: number;
  centerY: number;
  color?: string;
  maxRadius?: number;
  duration?: number;
  particleSize?: number;
};

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count,
  triggerFrame,
  centerX,
  centerY,
  color = theme.colors.primary,
  maxRadius = 300,
  duration = 50,
  particleSize = 8,
}) => {
  const frame = useCurrentFrame();

  if (frame < triggerFrame) {
    return null;
  }

  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i * 137.508 * Math.PI) / 180;

    const distance = interpolate(
      frame,
      [triggerFrame, triggerFrame + duration],
      [0, maxRadius],
      {
        easing: Easing.out(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );

    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    const opacity = interpolate(
      frame,
      [triggerFrame, triggerFrame + duration],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    const size = interpolate(
      frame,
      [triggerFrame, triggerFrame + duration],
      [particleSize, particleSize * 0.2],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          opacity,
        }}
      />
    );
  });

  return <>{particles}</>;
};
