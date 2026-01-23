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

const MoodChart: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const moodData = [
    { value: 0.7, emoji: "😊" },
    { value: 0.85, emoji: "😊" },
    { value: 0.6, emoji: "😐" },
    { value: 0.9, emoji: "😊" },
    { value: 0.75, emoji: "😊" },
    { value: 0.8, emoji: "😊" },
    { value: 0.95, emoji: "😄" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90 }}>
      {moodData.map((item, i) => {
        const barEntrance = spring({
          frame: Math.max(0, frame - 30 - i * 5),
          fps,
          config: springs.snappy,
        });

        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, opacity: barEntrance }}>{item.emoji}</span>
            <div
              style={{
                width: "100%",
                height: item.value * 55 * barEntrance,
                background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 100%)`,
                borderRadius: 5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const SafetyCard: React.FC<{
  type: "warning" | "success";
  title: string;
  message: string;
  frame: number;
  fps: number;
  delay: number;
}> = ({ type, title, message, frame, fps, delay }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  const entrance = spring({ frame: adjustedFrame, fps, config: springs.smooth });

  const color = type === "warning" ? theme.colors.warning : theme.colors.success;
  const icon = type === "warning"
    ? "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
    : "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z";

  return (
    <div
      style={{
        background: theme.colors.backgroundCard,
        borderRadius: 18,
        padding: 20,
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: entrance,
        transform: `translateX(${interpolate(entrance, [0, 1], [type === "warning" ? -30 : 30, 0])}px)`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        width: "100%",
        maxWidth: 300,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: theme.fonts.heading, fontSize: 17, fontWeight: 600, color: theme.colors.textPrimary }}>
          {title}
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.textSecondary, marginTop: 3 }}>
          {message}
        </div>
      </div>
    </div>
  );
};

export const InsightsSafetyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tab transition at frame 150 (5 seconds)
  const tabTransitionFrame = 150;
  const showSafetyTab = frame >= tabTransitionFrame;

  const insightsOpacity = interpolate(
    frame,
    [tabTransitionFrame - 15, tabTransitionFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const safetyOpacity = interpolate(
    frame,
    [tabTransitionFrame, tabTransitionFrame + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.4} tiltIntensity={0.3}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: theme.colors.background,
              padding: 18,
              paddingTop: 48,
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 22,
                background: theme.colors.backgroundCard,
                borderRadius: 14,
                padding: 5,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 11,
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  color: !showSafetyTab ? theme.colors.primary : theme.colors.textSecondary,
                  background: !showSafetyTab ? `${theme.colors.primary}20` : "transparent",
                }}
              >
                Insights
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 11,
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  color: showSafetyTab ? theme.colors.primary : theme.colors.textSecondary,
                  background: showSafetyTab ? `${theme.colors.primary}20` : "transparent",
                }}
              >
                Safety
              </div>
            </div>

            {/* Insights content */}
            <div style={{ position: "absolute", left: 18, right: 18, top: 115, opacity: insightsOpacity }}>
              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 16,
                  border: `1px solid ${theme.colors.primary}15`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>📊</span> Weekly Mood
                </div>
                <MoodChart frame={frame} fps={fps} />
              </div>

              <div
                style={{
                  background: theme.colors.backgroundCard,
                  borderRadius: 18,
                  padding: 20,
                  border: `1px solid ${theme.colors.success}20`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.colors.success,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>😊</span> Mostly happy this week
                </div>
              </div>
            </div>

            {/* Safety content */}
            <div
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                top: 115,
                opacity: safetyOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <SafetyCard
                type="warning"
                title="Wellness Check"
                message="Mom mentioned feeling tired"
                frame={frame}
                fps={fps}
                delay={tabTransitionFrame + 10}
              />
              <SafetyCard
                type="success"
                title="All Clear"
                message="Today's call went great"
                frame={frame}
                fps={fps}
                delay={tabTransitionFrame + 30}
              />
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        {/* Insights tab caption */}
        <Sequence from={80} durationInFrames={tabTransitionFrame - 80} layout="none">
          <AnimatedText
            text="See how they're feeling."
            style={{ fontSize: 34, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>

        {/* Safety tab caption */}
        <Sequence from={tabTransitionFrame + 60} layout="none">
          <AnimatedText
            text="Instant alerts when needed."
            style={{ fontSize: 34, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
