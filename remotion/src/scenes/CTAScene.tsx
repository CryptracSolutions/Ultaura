import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme, springs, easings } from "../theme";
import {
  GradientBackground,
  UltauraLogo,
  SceneLayout,
} from "../components";

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
    frame: Math.max(0, frame - 40),
    fps,
    config: springs.energetic,
  });

  // Enhanced button breathing - more pronounced
  const pulseScale = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [0.99, 1.02]
  );

  const pulseGlow = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [18, 28]
  );

  // Shine effect across button
  const shineFrame = Math.min(Math.max(frame - 55, 0), 30);
  const shinePosition = interpolate(shineFrame, [0, 30], [-140, 260]);
  const shineOpacity = interpolate(
    shineFrame,
    [0, 5, 25, 30],
    [0, 0.4, 0.4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );


  return (
    <SceneLayout background={<GradientBackground variant="aurora" particleCount={10} />}>

      {/* Central glow burst */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.colors.primary}25 0%, ${theme.colors.primary}10 40%, transparent 70%)`,
          filter: "blur(45px)",
          opacity: interpolate(Math.sin(frame * 0.05), [-1, 1], [0.5, 0.8]),
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
          gap: 32,
          zIndex: 1,
        }}
      >
        {/* Logo with enhanced animation */}
        <div
          style={{
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
            opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <UltauraLogo delay={0} size={140} showWordmark={true} />
        </div>

        {/* Tagline */}
        <Sequence from={22} layout="none">
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 36,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              textAlign: "center",
              padding: "0 40px",
              opacity: interpolate(frame - 22, [0, 18], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame - 22, [0, 18], [25, 0], {
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

        {/* Trial highlight */}
        <Sequence from={35} layout="none">
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 18,
              fontWeight: 600,
              color: theme.colors.primary,
              opacity: interpolate(frame - 35, [0, 15], [0, 1], {
                extrapolateRight: "clamp",
              }),
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Free 14 day trial
          </div>
        </Sequence>

        {/* CTA Button with enhanced effects - bigger */}
        <Sequence from={40} layout="none">
          <div
            style={{
              position: "relative",
              transform: `scale(${buttonEntrance * pulseScale})`,
              opacity: interpolate(frame - 40, [0, 12], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {/* Button glow ring */}
            <div
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: 55,
                background: `${theme.colors.primary}35`,
                filter: "blur(18px)",
                opacity: interpolate(Math.sin(frame * 0.1), [-1, 1], [0.35, 0.8]),
              }}
            />

            <div
              style={{
                position: "relative",
                background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                padding: "28px 70px",
                borderRadius: 50,
                boxShadow: `
                  0 0 ${pulseGlow}px ${theme.colors.primary}55,
                  0 14px 40px rgba(0, 0, 0, 0.4),
                  inset 0 2px 0 rgba(255, 255, 255, 0.25)
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
                  width: 70,
                  height: "100%",
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                  transform: "skewX(-20deg)",
                  opacity: shineOpacity,
                }}
              />

              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 30,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: 1.5,
                  textShadow: "0 2px 4px rgba(0,0,0,0.25)",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Free 14 day trial
              </div>
            </div>

          </div>
        </Sequence>

        {/* Trial info and trust line */}
        <Sequence from={75} layout="none">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              opacity: interpolate(frame - 75, [0, 18], [0, 1], {
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
                gap: 14,
              }}
            >
              <span>🔒 Secure</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>🛡️ Private</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>📞 24/7</span>
            </div>

            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 17,
                color: theme.colors.textSecondary,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>Works on any phone</span>
              <span style={{ opacity: 0.5 }}>•</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </Sequence>
      </div>
    </SceneLayout>
  );
};
