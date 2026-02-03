import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const SeniorViewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerEntrance = spring({ frame, fps, config: springs.smooth });
  const cardEntrance = spring({ frame: Math.max(0, frame - 15), fps, config: springs.snappy });
  const listEntrance = spring({ frame: Math.max(0, frame - 35), fps, config: springs.smooth });

  return (
    <SceneLayout background={<GradientBackground variant="radial" showParticles={false} /> }>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.32} tiltIntensity={0.3}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 22,
              paddingTop: 52,
            }}
          >
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: theme.colors.textPrimary,
                marginBottom: 18,
                opacity: interpolate(headerEntrance, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(headerEntrance, [0, 1], [-10, 0])}px)`,
              }}
            >
              Today
            </div>

            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 20,
                padding: 18,
                border: `1px solid ${theme.colors.primary}25`,
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [16, 0])}px)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: theme.colors.success,
                    boxShadow: `0 0 0 4px ${theme.colors.success}22`,
                  }}
                />
                Scheduled check-in
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 28,
                  fontWeight: 700,
                  color: theme.colors.textPrimary,
                }}
              >
                6:00 PM
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  color: theme.colors.textSecondary,
                }}
              >
                Friendly conversation
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                background: theme.colors.surface,
                borderRadius: 16,
                padding: 14,
                border: `1px solid ${theme.colors.primary}12`,
                opacity: listEntrance,
                transform: `translateY(${interpolate(listEntrance, [0, 1], [12, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                  }}
                >
                  This week
                </span>
                <span
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.colors.textMuted,
                  }}
                >
                  5 check-ins
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {"MTWTF".split("").map((day, index) => (
                  <div
                    key={day}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "8px 0",
                      borderRadius: 12,
                      background: index === 2 ? `${theme.colors.primary}15` : "transparent",
                      color: index === 2 ? theme.colors.primary : theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <AnimatedText
          text="Friendly check-ins. On schedule."
          style={{ fontSize: 34, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.3 }}
          animationType="wordReveal"
        />
      </TextArea>
    </SceneLayout>
  );
};
