import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type StatCardProps = {
  title: string;
  children: React.ReactNode;
  delay?: number;
  width?: number;
  height?: string;
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  children,
  delay = 0,
  width = 900,
  height = "auto",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springProgress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 10, stiffness: 200 },
  });

  const translateX = interpolate(springProgress, [0, 1], [-300, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        padding: 24,
        width,
        height,
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div
        style={{
          fontSize: 16,
          color: "#A8A29E",
          textTransform: "uppercase",
          letterSpacing: 2,
          marginBottom: 16,
          fontFamily: theme.fonts.manrope,
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
};
