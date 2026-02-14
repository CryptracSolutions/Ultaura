import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

type Waypoint = {
  x: number;
  y: number;
  frame: number;
  action?: "hover" | "click";
};

type FakeCursorProps = {
  waypoints: Waypoint[];
  delay?: number;
  size?: number;
};

export const FakeCursor: React.FC<FakeCursorProps> = ({
  waypoints,
  delay = 0,
  size = 24,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (waypoints.length === 0) return null;

  const adjustedFrame = frame - delay;
  if (adjustedFrame < waypoints[0].frame) return null;

  // Find current segment
  let segIndex = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (adjustedFrame >= waypoints[i].frame) {
      segIndex = i;
    }
  }

  const current = waypoints[segIndex];
  const next = waypoints[Math.min(segIndex + 1, waypoints.length - 1)];

  let x: number;
  let y: number;

  if (current === next || adjustedFrame >= next.frame) {
    x = next.x;
    y = next.y;
  } else {
    x = interpolate(
      adjustedFrame,
      [current.frame, next.frame],
      [current.x, next.x],
      {
        easing: Easing.inOut(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    y = interpolate(
      adjustedFrame,
      [current.frame, next.frame],
      [current.y, next.y],
      {
        easing: Easing.inOut(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
  }

  // Check if at a hover waypoint (within 10 frames)
  let isHovering = false;
  for (const wp of waypoints) {
    if (
      wp.action === "hover" &&
      Math.abs(adjustedFrame - wp.frame) <= 10
    ) {
      isHovering = true;
      break;
    }
  }

  // Check if at a click waypoint
  let clickScale = 1;
  for (const wp of waypoints) {
    if (wp.action === "click" && adjustedFrame >= wp.frame) {
      const clickFrame = adjustedFrame - wp.frame;
      if (clickFrame < 30) {
        const dipDown = interpolate(clickFrame, [0, 4], [1, 0.85], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const springBack = spring({
          frame: Math.max(0, clickFrame - 4),
          fps,
          config: { damping: 10, stiffness: 200 },
        });
        clickScale = clickFrame < 4 ? dipDown : 0.85 + springBack * 0.15;
      }
    }
  }

  const glowSize = isHovering ? 4 + Math.sin(frame * 0.3) * 3 : 0;
  const filter = isHovering
    ? `drop-shadow(0 0 ${glowSize}px ${theme.colors.primary})`
    : "none";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 1000,
        transform: `scale(${clickScale})`,
        transformOrigin: "top left",
        filter,
        pointerEvents: "none",
      }}
    >
      <svg
        width={size}
        height={size * 1.4}
        viewBox="0 0 24 34"
        fill="none"
      >
        <path
          d="M2 2L2 26L8.5 19.5L14 30L18 28L12.5 17.5L21 17.5L2 2Z"
          fill={theme.colors.white}
          stroke={theme.colors.stone950}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
