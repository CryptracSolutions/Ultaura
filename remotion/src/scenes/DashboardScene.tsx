import React from "react";
import { useCurrentFrame, interpolate, Sequence } from "remotion";
import { theme } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Mood data for chart
  const moodData = [
    { day: "M", value: 0.7, emoji: "😊" },
    { day: "T", value: 0.85, emoji: "😊" },
    { day: "W", value: 0.6, emoji: "😐" },
    { day: "T", value: 0.9, emoji: "😊" },
    { day: "F", value: 0.75, emoji: "😊" },
    { day: "S", value: 0.8, emoji: "😊" },
    { day: "S", value: 0.95, emoji: "😊" },
  ];

  return (
    <SceneLayout background={<GradientBackground variant="default" />}>
      <ContentArea>
        {/* Dashboard mockup */}
        <PhoneFrame delay={0} scale={0.95}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 16,
              paddingTop: 45,
            }}
          >
            {/* Header */}
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 20,
                fontWeight: 600,
                color: theme.colors.textPrimary,
                marginBottom: 20,
              }}
            >
              Weekly Insights
            </div>

            {/* Mood trend card */}
            <Sequence from={20} layout="none">
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  opacity: interpolate(frame - 20, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(frame - 20, [0, 15], [20, 0], {
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.colors.textSecondary,
                    marginBottom: 12,
                  }}
                >
                  Mood Trend
                </div>

                {/* Chart bars */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    height: 80,
                    gap: 6,
                  }}
                >
                  {moodData.map((item, i) => {
                    const barDelay = 40 + i * 6;
                    const barHeight = interpolate(
                      frame - barDelay,
                      [0, 20],
                      [0, item.value * 60],
                      { extrapolateRight: "clamp" }
                    );

                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            opacity: interpolate(frame - barDelay - 10, [0, 10], [0, 1], {
                              extrapolateRight: "clamp",
                            }),
                          }}
                        >
                          {item.emoji}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: barHeight,
                            background: `linear-gradient(180deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                            borderRadius: 5,
                          }}
                        />
                        <div
                          style={{
                            fontFamily: theme.fonts.body,
                            fontSize: 10,
                            color: theme.colors.textMuted,
                          }}
                        >
                          {item.day}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Sequence>

            {/* Topics card */}
            <Sequence from={80} layout="none">
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  opacity: interpolate(frame - 80, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(frame - 80, [0, 15], [20, 0], {
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.colors.textSecondary,
                    marginBottom: 10,
                  }}
                >
                  Topics Discussed
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["Family", "Health", "Weather", "Hobbies"].map((topic, i) => (
                    <div
                      key={topic}
                      style={{
                        padding: "5px 10px",
                        background: `${theme.colors.primary}20`,
                        borderRadius: 16,
                        fontFamily: theme.fonts.body,
                        fontSize: 11,
                        color: theme.colors.primary,
                        opacity: interpolate(frame - 90 - i * 5, [0, 10], [0, 1], {
                          extrapolateRight: "clamp",
                        }),
                      }}
                    >
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
            </Sequence>

            {/* Call stats */}
            <Sequence from={120} layout="none">
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  opacity: interpolate(frame - 120, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: theme.colors.backgroundCard,
                    borderRadius: 14,
                    padding: 14,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.fonts.heading,
                      fontSize: 24,
                      fontWeight: 700,
                      color: theme.colors.primary,
                    }}
                  >
                    7
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 10,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Calls
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: theme.colors.backgroundCard,
                    borderRadius: 14,
                    padding: 14,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.fonts.heading,
                      fontSize: 24,
                      fontWeight: 700,
                      color: theme.colors.success,
                    }}
                  >
                    45m
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 10,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Avg Duration
                  </div>
                </div>
              </div>
            </Sequence>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <Sequence from={160} layout="none">
          <AnimatedText
            text="Family dashboard tracks"
            style={{
              fontSize: 34,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={180} layout="none">
          <AnimatedText
            text="mood, topics & connection."
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: theme.colors.primary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
