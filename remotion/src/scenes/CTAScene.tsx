import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme } from "../theme";
import { GradientBackground, UltauraLogo, SceneLayout } from "../components";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Button pulse animation
  const pulseScale = interpolate(Math.sin(frame * 0.15), [-1, 1], [1, 1.03]);

  const buttonSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <SceneLayout background={<GradientBackground variant="radial" />}>
      {/* Animated background particles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = ((i * 137.5) % 100);
        const y = ((i * 73.3) % 100);
        const size = 3 + (i % 4) * 2;
        const delay = i * 8;
        const adjustedFrame = Math.max(0, frame - delay);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: theme.colors.primary,
              opacity: interpolate(adjustedFrame % 120, [0, 60, 120], [0, 0.3, 0]),
              transform: `translateY(${interpolate(adjustedFrame % 120, [0, 120], [0, -40])}px)`,
              zIndex: 0,
            }}
          />
        );
      })}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <UltauraLogo delay={0} size={120} showWordmark={true} />

        {/* Tagline */}
        <Sequence from={30} layout="none">
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 32,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              textAlign: "center",
              padding: "0 40px",
              opacity: interpolate(frame - 30, [0, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame - 30, [0, 20], [20, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            AI Voice Companion
            <br />
            for Seniors
          </div>
        </Sequence>

        {/* CTA Button */}
        <Sequence from={60} layout="none">
          <div
            style={{
              transform: `scale(${buttonSpring * pulseScale})`,
              opacity: interpolate(frame - 60, [0, 15], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                padding: "20px 50px",
                borderRadius: 40,
                boxShadow: `
                  0 0 40px ${theme.colors.primary}40,
                  0 10px 30px rgba(0, 0, 0, 0.3)
                `,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: 1,
                }}
              >
                Start Free Trial
              </div>
            </div>
          </div>
        </Sequence>

        {/* Trial info */}
        <Sequence from={90} layout="none">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              opacity: interpolate(frame - 90, [0, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 16,
                color: theme.colors.textSecondary,
              }}
            >
              3-day free trial • No credit card
            </div>

            {/* Trust badges */}
            <div
              style={{
                display: "flex",
                gap: 20,
                marginTop: 8,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {["Secure", "Private", "24/7"].map((badge, i) => (
                <div
                  key={badge}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: interpolate(frame - 100 - i * 8, [0, 15], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={theme.colors.success}
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <span
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      color: theme.colors.textMuted,
                    }}
                  >
                    {badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Sequence>
      </div>
    </SceneLayout>
  );
};
