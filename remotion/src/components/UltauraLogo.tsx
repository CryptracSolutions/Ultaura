import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";

interface UltauraLogoProps {
  delay?: number;
  size?: number;
  showWordmark?: boolean;
  animated?: boolean;
}

export const UltauraLogo: React.FC<UltauraLogoProps> = ({
  delay = 0,
  size = 120,
  showWordmark = true,
  animated = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = animated
    ? spring({
        frame: adjustedFrame,
        fps,
        config: { damping: 12, stiffness: 100 },
      })
    : 1;

  const opacity = animated
    ? interpolate(adjustedFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  const wordmarkOpacity = animated
    ? interpolate(adjustedFrame, [15, 30], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity,
      }}
    >
      {/* Logo Icon - Stylized waveform/companion symbol */}
      <div
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer glow circle */}
          <circle
            cx="60"
            cy="60"
            r="55"
            fill={`${theme.colors.primary}15`}
          />
          {/* Main circle */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill={theme.colors.primary}
          />
          {/* Inner accent */}
          <circle
            cx="60"
            cy="60"
            r="35"
            fill={theme.colors.primaryLight}
            opacity={0.3}
          />
          {/* Waveform bars representing voice */}
          <g fill="white">
            <rect x="35" y="50" width="6" height="20" rx="3" />
            <rect x="47" y="40" width="6" height="40" rx="3" />
            <rect x="57" y="35" width="6" height="50" rx="3" />
            <rect x="67" y="40" width="6" height="40" rx="3" />
            <rect x="79" y="50" width="6" height="20" rx="3" />
          </g>
        </svg>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: size * 0.5,
            fontWeight: 700,
            color: theme.colors.textPrimary,
            letterSpacing: 2,
            opacity: wordmarkOpacity,
          }}
        >
          ULTAURA
        </div>
      )}
    </div>
  );
};
