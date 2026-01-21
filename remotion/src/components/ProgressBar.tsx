import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";

interface ProgressBarProps {
  height?: number;
  showAtBottom?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  height = 4,
  showAtBottom = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = (frame / durationInFrames) * 100;

  // Fade in at start, fade out at end
  const opacity = interpolate(
    frame,
    [0, 30, durationInFrames - 30, durationInFrames],
    [0, 0.8, 0.8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        [showAtBottom ? "bottom" : "top"]: 50,
        height,
        backgroundColor: `${theme.colors.textMuted}30`,
        borderRadius: height / 2,
        overflow: "hidden",
        opacity,
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primaryLight})`,
          borderRadius: height / 2,
          boxShadow: `0 0 10px ${theme.colors.primary}60`,
        }}
      />
    </div>
  );
};
