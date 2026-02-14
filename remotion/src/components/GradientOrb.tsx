import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type GradientOrbProps = {
  size?: number;
  delay?: number;
};

export const GradientOrb: React.FC<GradientOrbProps> = ({
  size = 400,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 12 },
  });

  const floatY = Math.sin(delayedFrame * 0.03) * 20;
  const breatheOpacity = interpolate(
    Math.sin(delayedFrame * 0.02),
    [-1, 1],
    [0.4, 0.7]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(10, 186, 181, 0.5) 0%, transparent 70%)",
        filter: "blur(60px)",
        opacity: breatheOpacity,
        transform: `scale(${scale}) translateY(${floatY}px)`,
      }}
    />
  );
};
