import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme, springs, easings } from "../theme";
import { GradientBackground, UltauraLogo, SceneLayout } from "../components";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoSpring = spring({
    frame,
    fps,
    config: springs.smooth,
  });

  // Button animations
  const buttonEntrance = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: springs.smooth,
  });

  // Subtle button breathing
  const pulseScale = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [0.995, 1.005]
  );

  const pulseGlow = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [16, 22]
  );

  // Shine effect across button
  const shineFrame = Math.min(Math.max(frame - 60, 0), 30);
  const shinePosition = interpolate(shineFrame, [0, 30], [-120, 220]);
  const shineOpacity = interpolate(
    shineFrame,
    [0, 5, 25, 30],
    [0, 0.35, 0.35, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <SceneLayout background={<GradientBackground variant="aurora" particleCount={8} />}>

      {/* Central glow burst */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.colors.primary}20 0%, ${theme.colors.primary}08 40%, transparent 70%)`,
          filter: "blur(40px)",
          opacity: interpolate(Math.sin(frame * 0.04), [-1, 1], [0.45, 0.7]),
          zIndex: 0,
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 35,
          zIndex: 1,
        }}
      >
        {/* Logo with enhanced animation */}
        <div
          style={{
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
            opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <UltauraLogo delay={0} size={130} showWordmark={true} />
        </div>

        {/* Tagline */}
        <Sequence from={25} layout="none">
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 34,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              textAlign: "center",
              padding: "0 40px",
              opacity: interpolate(frame - 25, [0, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame - 25, [0, 20], [25, 0], {
                extrapolateRight: "clamp",
                easing: easings.easeOut,
              })}px)`,
            }}
          >
            AI Voice Companion
            <br />
            <span style={{ color: theme.colors.primary }}>for Seniors</span>
          </div>
        </Sequence>

        {/* CTA Button with enhanced effects */}
        <Sequence from={50} layout="none">
          <div
            style={{
              position: "relative",
              transform: `scale(${buttonEntrance * pulseScale})`,
              opacity: interpolate(frame - 50, [0, 15], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {/* Button glow ring */}
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: 50,
                background: `${theme.colors.primary}30`,
                filter: "blur(15px)",
                opacity: interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.7]),
              }}
            />

            <div
              style={{
                position: "relative",
                background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                padding: "22px 55px",
                borderRadius: 45,
                boxShadow: `
                  0 0 ${pulseGlow}px ${theme.colors.primary}50,
                  0 12px 35px rgba(0, 0, 0, 0.35),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2)
                `,
                overflow: "hidden",
              }}
            >
              {/* Shine effect */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: shinePosition,
                  width: 60,
                  height: "100%",
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                  transform: "skewX(-20deg)",
                  opacity: shineOpacity,
                }}
              />

              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: 1.5,
                  textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Start Free Trial
              </div>
            </div>
          </div>
        </Sequence>

        {/* Trial info and trust line */}
        <Sequence from={70} layout="none">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              opacity: interpolate(frame - 70, [0, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {/* Single trust line */}
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 16,
                color: theme.colors.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>Secure</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>Private</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>24/7</span>
            </div>

            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 17,
                color: theme.colors.textSecondary,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span>3-day free trial</span>
              <span style={{ opacity: 0.5 }}>•</span>
              <span>No credit card</span>
            </div>
          </div>
        </Sequence>
      </div>
    </SceneLayout>
  );
};
