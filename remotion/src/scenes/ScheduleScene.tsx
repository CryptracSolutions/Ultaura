import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
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

export const ScheduleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const days = ["M", "T", "W", "T", "F", "S", "S"];

  const cardEntrance = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: springs.smooth,
  });

  const highlightEntrance = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: springs.snappy,
  });

  const badgeEntrance = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: springs.bouncy,
  });

  return (
    <SceneLayout background={<GradientBackground variant="default" showParticles={false} />}>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.3} tiltIntensity={0.35}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 20,
              paddingTop: 50,
            }}
          >
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 24,
                fontWeight: 700,
                color: theme.colors.textPrimary,
                marginBottom: 24,
                opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Call Schedule
            </div>

            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 20,
                padding: 20,
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [20, 0])}px)`,
                border: `1px solid ${theme.colors.primary}20`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${theme.colors.textMuted}15`,
                }}
              >
                {days.map((day, i) => {
                  const dayDelay = 30 + i * 4;
                  const dayEntrance = spring({
                    frame: Math.max(0, frame - dayDelay),
                    fps,
                    config: springs.snappy,
                  });

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: theme.fonts.body,
                        fontSize: 14,
                        fontWeight: 600,
                        color: theme.colors.textSecondary,
                        opacity: dayEntrance,
                        transform: `translateY(${interpolate(dayEntrance, [0, 1], [10, 0])}px)`,
                      }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 12,
                  background: `${theme.colors.primary}15`,
                  borderRadius: 12,
                  opacity: highlightEntrance,
                  transform: `scale(${interpolate(highlightEntrance, [0, 1], [0.95, 1])})`,
                  border: `1px solid ${theme.colors.primary}30`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.primary,
                    minWidth: 70,
                  }}
                >
                  9:00 AM
                </div>

                <div style={{ display: "flex", flex: 1, justifyContent: "space-around" }}>
                  {days.map((_, i) => {
                    const checkDelay = 60 + i * 4;
                    const checkEntrance = spring({
                      frame: Math.max(0, frame - checkDelay),
                      fps,
                      config: springs.bouncy,
                    });

                    return (
                      <div
                        key={i}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: theme.colors.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transform: `scale(${checkEntrance})`,
                          boxShadow: `0 2px 8px ${theme.colors.primary}40`,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 16,
                  opacity: badgeEntrance,
                  transform: `translateY(${interpolate(badgeEntrance, [0, 1], [10, 0])}px)`,
                }}
              >
                <div
                  style={{
                    padding: "6px 14px",
                    background: `${theme.colors.success}20`,
                    borderRadius: 20,
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.success,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={theme.colors.success}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  Daily
                </div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted }}>
                  Quiet hours respected
                </div>
              </div>
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <Sequence from={130} layout="none">
          <AnimatedText
            text="Schedule daily check-ins."
            style={{ fontSize: 34, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={160} layout="none">
          <AnimatedText
            text="Peace of mind for families."
            style={{ fontSize: 34, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
