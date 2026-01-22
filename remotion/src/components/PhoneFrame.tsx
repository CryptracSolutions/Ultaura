import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, springs, easings } from "../theme";

interface PhoneFrameProps {
  children: React.ReactNode;
  delay?: number;
  animateIn?: boolean;
  scale?: number;
  tilt3D?: boolean;
  tiltIntensity?: number;
  glowPulse?: boolean;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  delay = 0,
  animateIn = true,
  scale = 1,
  tilt3D = true,
  tiltIntensity = 1,
  glowPulse = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const phoneWidth = 340 * scale;
  const phoneHeight = 720 * scale;
  const borderRadius = 45 * scale;

  // Entrance animation with spring physics
  const entranceSpring = animateIn
    ? spring({
        frame: adjustedFrame,
        fps,
        config: springs.heavy,
      })
    : 1;

  const translateY = interpolate(entranceSpring, [0, 1], [120, 0]);
  const entranceScale = interpolate(entranceSpring, [0, 1], [0.85, 1]);

  // 3D tilt effect - subtle continuous motion
  const tiltX = tilt3D
    ? interpolate(
        Math.sin(adjustedFrame * 0.03),
        [-1, 1],
        [-3 * tiltIntensity, 3 * tiltIntensity]
      )
    : 0;
  const tiltY = tilt3D
    ? interpolate(
        Math.cos(adjustedFrame * 0.025),
        [-1, 1],
        [-2 * tiltIntensity, 2 * tiltIntensity]
      )
    : 0;

  // Glow pulse animation
  const glowIntensity = glowPulse
    ? interpolate(Math.sin(adjustedFrame * 0.08), [-1, 1], [0.3, 0.7])
    : 0.5;

  const opacity = animateIn
    ? interpolate(adjustedFrame, [0, 20], [0, 1], {
        extrapolateRight: "clamp",
        easing: easings.easeOut,
      })
    : 1;

  // Screen reflection animation
  const reflectionX = interpolate(
    adjustedFrame % 180,
    [0, 90, 180],
    [-100, 200, -100],
    { easing: easings.smooth }
  );

  return (
    <div
      style={{
        perspective: 1200,
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          width: phoneWidth,
          height: phoneHeight,
          borderRadius,
          background: `linear-gradient(145deg, ${theme.colors.backgroundCard} 0%, ${theme.colors.backgroundLight} 100%)`,
          border: `3px solid ${theme.colors.primary}50`,
          boxShadow: `
            0 0 ${60 * glowIntensity}px ${theme.colors.primary}30,
            0 25px 60px rgba(0, 0, 0, 0.6),
            0 10px 20px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3)
          `,
          overflow: "hidden",
          position: "relative",
          transform: `
            translateY(${translateY}px)
            scale(${entranceScale})
            rotateX(${tiltX}deg)
            rotateY(${tiltY}deg)
          `,
          transformStyle: "preserve-3d",
          opacity,
        }}
      >
        {/* Notch with depth */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120 * scale,
            height: 30 * scale,
            background: `linear-gradient(180deg, ${theme.colors.background} 0%, ${theme.colors.backgroundLight} 100%)`,
            borderBottomLeftRadius: 20 * scale,
            borderBottomRightRadius: 20 * scale,
            zIndex: 10,
            boxShadow: `0 2px 8px rgba(0, 0, 0, 0.3)`,
          }}
        >
          {/* Camera dot */}
          <div
            style={{
              position: "absolute",
              top: 10 * scale,
              left: "50%",
              transform: "translateX(-50%)",
              width: 8 * scale,
              height: 8 * scale,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.colors.backgroundCard} 0%, ${theme.colors.background} 100%)`,
              border: `1px solid ${theme.colors.textMuted}30`,
            }}
          />
        </div>

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

          {/* Screen reflection/glare effect */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: reflectionX,
              width: 80,
              height: "200%",
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)`,
              transform: "rotate(25deg)",
              pointerEvents: "none",
              zIndex: 100,
            }}
          />
        </div>

        {/* Bottom bar / home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 8 * scale,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100 * scale,
            height: 4 * scale,
            borderRadius: 2 * scale,
            background: theme.colors.textMuted,
            opacity: 0.3,
            zIndex: 10,
          }}
        />

        {/* Edge highlight */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)`,
            borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
          }}
        />
      </div>
    </div>
  );
};
