import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";

interface PhoneFrameProps {
  children: React.ReactNode;
  delay?: number;
  animateIn?: boolean;
  scale?: number;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  delay = 0,
  animateIn = true,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const phoneWidth = 340 * scale;
  const phoneHeight = 720 * scale;
  const borderRadius = 45 * scale;

  const getTransform = () => {
    if (!animateIn) return "translateY(0) scale(1)";

    const springValue = spring({
      frame: adjustedFrame,
      fps,
      config: { damping: 15, stiffness: 80 },
    });

    const translateY = interpolate(springValue, [0, 1], [100, 0]);
    const scaleValue = interpolate(springValue, [0, 1], [0.8, 1]);

    return `translateY(${translateY}px) scale(${scaleValue})`;
  };

  const opacity = animateIn
    ? interpolate(adjustedFrame, [0, 15], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  return (
    <div
      style={{
        width: phoneWidth,
        height: phoneHeight,
        borderRadius,
        background: theme.colors.backgroundCard,
        border: `3px solid ${theme.colors.primary}40`,
        boxShadow: `
          0 0 60px ${theme.colors.primary}20,
          0 25px 50px rgba(0, 0, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
        overflow: "hidden",
        position: "relative",
        transform: getTransform(),
        opacity,
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120 * scale,
          height: 30 * scale,
          background: theme.colors.background,
          borderBottomLeftRadius: 20 * scale,
          borderBottomRightRadius: 20 * scale,
          zIndex: 10,
        }}
      />

      {/* Screen content */}
      <div
        style={{
          position: "absolute",
          inset: 8 * scale,
          borderRadius: borderRadius - 8,
          overflow: "hidden",
          background: theme.colors.background,
        }}
      >
        {children}
      </div>
    </div>
  );
};
