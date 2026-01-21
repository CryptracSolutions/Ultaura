import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme } from "../theme";
import {
  GradientBackground,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const SafetyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shield pulse animation
  const shieldScale = spring({
    frame: frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const pulseScale = interpolate(Math.sin(frame * 0.1), [-1, 1], [1, 1.05]);

  return (
    <SceneLayout background={<GradientBackground variant="radial" />}>
      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
          }}
        >
          {/* Shield icon with glow */}
          <div
            style={{
              position: "relative",
              transform: `scale(${shieldScale * pulseScale})`,
            }}
          >
            {/* Glow effect */}
            <div
              style={{
                position: "absolute",
                top: -20,
                left: -20,
                right: -20,
                bottom: -20,
                background: `radial-gradient(circle, ${theme.colors.primary}30 0%, transparent 70%)`,
                filter: "blur(15px)",
              }}
            />

            {/* Shield */}
            <svg
              width="120"
              height="140"
              viewBox="0 0 24 24"
              fill="none"
              style={{ position: "relative", zIndex: 1 }}
            >
              <defs>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={theme.colors.primaryLight} />
                  <stop offset="100%" stopColor={theme.colors.primaryDark} />
                </linearGradient>
              </defs>
              <path
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                fill="url(#shieldGradient)"
              />
              <path
                d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"
                fill="white"
              />
            </svg>
          </div>

          {/* Alert notification cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: 320,
            }}
          >
            {/* Alert card 1 */}
            <Sequence from={40} layout="none">
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 14,
                  padding: 16,
                  borderLeft: `4px solid ${theme.colors.warning}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: interpolate(frame - 40, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateX(${interpolate(frame - 40, [0, 15], [-30, 0], {
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${theme.colors.warning}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={theme.colors.warning}>
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: theme.fonts.heading,
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                    }}
                  >
                    Wellness Check
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Mom mentioned feeling tired
                  </div>
                </div>
              </div>
            </Sequence>

            {/* Alert card 2 */}
            <Sequence from={60} layout="none">
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 14,
                  padding: 16,
                  borderLeft: `4px solid ${theme.colors.success}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: interpolate(frame - 60, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateX(${interpolate(frame - 60, [0, 15], [30, 0], {
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${theme.colors.success}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={theme.colors.success}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: theme.fonts.heading,
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                    }}
                  >
                    All Clear
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Today's call went great
                  </div>
                </div>
              </div>
            </Sequence>
          </div>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={100} layout="none">
          <AnimatedText
            text="Instant wellness alerts"
            style={{
              fontSize: 38,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={120} layout="none">
          <AnimatedText
            text="when something seems off."
            style={{
              fontSize: 38,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
