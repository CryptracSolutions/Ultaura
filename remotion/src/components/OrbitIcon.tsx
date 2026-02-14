import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type OrbitIconProps = {
  icon: React.ReactNode;
  orbitRadius?: number;
  startAngle: number;
  finalX: number;
  finalY: number;
  orbitDuration?: number;
  settleDuration?: number;
  delay?: number;
  size?: number;
};

export const OrbitIcon: React.FC<OrbitIconProps> = ({
  icon,
  orbitRadius = 200,
  startAngle,
  finalX,
  finalY,
  orbitDuration = 60,
  settleDuration = 30,
  delay = 0,
  size = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const centerX = 540;
  const centerY = 960;

  // Phase 1: Orbital path
  const angle = interpolate(
    localFrame,
    [0, orbitDuration],
    [startAngle, startAngle + Math.PI * 2],
    {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const orbitX = centerX + Math.cos(angle) * orbitRadius;
  const orbitY = centerY + Math.sin(angle) * orbitRadius;

  // Last orbit position (end of phase 1)
  const lastOrbitX =
    centerX + Math.cos(startAngle + Math.PI * 2) * orbitRadius;
  const lastOrbitY =
    centerY + Math.sin(startAngle + Math.PI * 2) * orbitRadius;

  // Phase 2: Spring settle to final position
  const settleFrame = Math.max(0, localFrame - orbitDuration);
  const settleProgress = spring({
    frame: settleFrame,
    fps,
    config: { damping: 12 },
  });

  const isSettling = localFrame >= orbitDuration;
  const isSettled = localFrame >= orbitDuration + settleDuration;

  let x: number;
  let y: number;
  let scalePulse = 1;

  if (!isSettling) {
    x = orbitX;
    y = orbitY;
  } else {
    x = interpolate(settleProgress, [0, 1], [lastOrbitX, finalX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    y = interpolate(settleProgress, [0, 1], [lastOrbitY, finalY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scalePulse = interpolate(settleProgress, [0, 0.5, 1], [1, 1.2, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Subtle float after settling
  if (isSettled) {
    y += Math.sin(frame * 0.05) * 5;
  }

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${scalePulse})`,
      }}
    >
      {icon}
    </div>
  );
};
