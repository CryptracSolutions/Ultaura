import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type PulsingButtonProps = {
  text: string;
  delay?: number;
  clickFrame?: number;
  width?: number;
  height?: number;
};

export const PulsingButton: React.FC<PulsingButtonProps> = ({
  text,
  delay = 0,
  clickFrame,
  width = 800,
  height = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry spring
  const entryScale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12 },
  });

  // Glow effect
  const spread = 10 + Math.sin(frame * 0.15) * 8;
  const glowOpacity = 0.3 + Math.sin(frame * 0.15) * 0.15;

  // Click effect
  let clickScale = 1;
  let ringScale = 0;
  let ringOpacity = 0;
  const hasClick = clickFrame !== undefined && frame >= clickFrame;

  if (hasClick) {
    const clickLocal = frame - clickFrame;
    if (clickLocal < 4) {
      clickScale = interpolate(frame, [clickFrame, clickFrame + 4], [1, 0.92], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    } else {
      const bounceBack = spring({
        frame: clickLocal - 4,
        fps,
        config: { damping: 10, stiffness: 200 },
      });
      clickScale = interpolate(bounceBack, [0, 1], [0.92, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    ringScale = interpolate(
      frame,
      [clickFrame, clickFrame + 20],
      [1, 3],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    ringOpacity = interpolate(
      frame,
      [clickFrame, clickFrame + 20],
      [0.6, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  const finalScale = entryScale * clickScale;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Expanding ring on click */}
      {hasClick && (
        <div
          style={{
            position: "absolute",
            width,
            height,
            borderRadius: height / 2,
            border: `2px solid ${theme.colors.primary}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
          }}
        />
      )}

      {/* Button */}
      <div
        style={{
          width,
          height,
          borderRadius: height / 2,
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.cyan400})`,
          boxShadow: `0 0 ${spread}px rgba(10, 186, 181, ${glowOpacity})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${finalScale})`,
        }}
      >
        <span
          style={{
            fontSize: 24,
            color: theme.colors.white,
            fontWeight: 700,
            fontFamily: theme.fonts.manrope,
            textAlign: "center",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
