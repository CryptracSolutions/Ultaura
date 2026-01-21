import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

interface WatermarkProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export const Watermark: React.FC<WatermarkProps> = ({
  position = "top-right",
}) => {
  const frame = useCurrentFrame();

  // Subtle pulse animation
  const pulseOpacity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.4, 0.6]
  );

  // Fade in
  const fadeIn = interpolate(frame, [0, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const positionStyles: Record<string, React.CSSProperties> = {
    "top-left": { top: 60, left: 40 },
    "top-right": { top: 60, right: 40 },
    "bottom-left": { bottom: 80, left: 40 },
    "bottom-right": { bottom: 80, right: 40 },
  };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: fadeIn * pulseOpacity,
        zIndex: 100,
      }}
    >
      {/* Small logo icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="white"
        >
          {/* Waveform icon */}
          <rect x="4" y="10" width="2" height="4" rx="1" />
          <rect x="8" y="7" width="2" height="10" rx="1" />
          <rect x="12" y="5" width="2" height="14" rx="1" />
          <rect x="16" y="7" width="2" height="10" rx="1" />
          <rect x="20" y="10" width="2" height="4" rx="1" />
        </svg>
      </div>

      {/* Text */}
      <span
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 14,
          fontWeight: 600,
          color: theme.colors.textSecondary,
          letterSpacing: 1,
        }}
      >
        ULTAURA
      </span>
    </div>
  );
};
