import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type ConfettiBurstProps = {
  triggerFrame: number;
  centerX: number;
  centerY: number;
  count?: number;
  duration?: number;
  colors?: string[];
};

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  triggerFrame,
  centerX,
  centerY,
  count = 30,
  duration = 60,
  colors = [
    theme.colors.primary,
    theme.colors.cyan400,
    "#fbbf24",
    "#ef4444",
    theme.colors.white,
  ],
}) => {
  const frame = useCurrentFrame();

  if (frame < triggerFrame) {
    return null;
  }

  const t = frame - triggerFrame;

  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = (i * 137.508 * Math.PI) / 180;
    const speed = 3 + ((i * 7) % 5);
    const x = centerX + Math.cos(angle) * speed * t;
    const y = centerY + Math.sin(angle) * speed * t + 0.5 * 0.15 * t * t;
    const rotation = i * 45 + frame * (3 + (i % 5));
    const color = colors[i % colors.length];

    const opacity = interpolate(t, [0, duration], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - 4,
          top: y - 6,
          width: 8,
          height: 12,
          backgroundColor: color,
          opacity,
          transform: `rotate(${rotation}deg)`,
        }}
      />
    );
  });

  return <>{pieces}</>;
};
