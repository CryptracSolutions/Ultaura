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
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

// Animated chart bar component
const AnimatedBar: React.FC<{
  value: number;
  maxHeight: number;
  delay: number;
  frame: number;
  fps: number;
  emoji: string;
  day: string;
  index: number;
}> = ({ value, maxHeight, delay, frame, fps, emoji, day, index }) => {
  const adjustedFrame = Math.max(0, frame - delay);

  const barSpring = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  const barHeight = interpolate(barSpring, [0, 1], [0, value * maxHeight]);

  // Emoji bounce entrance
  const emojiSpring = spring({
    frame: Math.max(0, adjustedFrame - 10),
    fps,
    config: springs.bouncy,
  });

  // Slight continuous bar glow
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08 + index),
    [-1, 1],
    [0.3, 0.6]
  );

  return (
    <div
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
          fontSize: 16,
          transform: `scale(${emojiSpring})`,
          opacity: emojiSpring,
        }}
      >
        {emoji}
      </div>
      <div
        style={{
          width: "100%",
          height: barHeight,
          background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
          borderRadius: 5,
          boxShadow: `0 0 ${10 * glowIntensity}px ${theme.colors.primary}40`,
        }}
      />
      <div
        style={{
          fontFamily: theme.fonts.body,
          fontSize: 11,
          color: theme.colors.textMuted,
          opacity: interpolate(barSpring, [0, 0.5, 1], [0, 0, 1]),
        }}
      >
        {day}
      </div>
    </div>
  );
};

// Animated topic tag
const TopicTag: React.FC<{
  topic: string;
  delay: number;
  frame: number;
  fps: number;
  index: number;
}> = ({ topic, delay, frame, fps, index }) => {
  const adjustedFrame = Math.max(0, frame - delay);

  const tagSpring = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  return (
    <div
      style={{
        padding: "6px 12px",
        background: `${theme.colors.primary}20`,
        borderRadius: 16,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        fontWeight: 500,
        color: theme.colors.primary,
        transform: `scale(${tagSpring}) translateY(${interpolate(tagSpring, [0, 1], [10, 0])}px)`,
        opacity: tagSpring,
        border: `1px solid ${theme.colors.primary}30`,
      }}
    >
      {topic}
    </div>
  );
};

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mood data for chart
  const moodData = [
    { day: "M", value: 0.7, emoji: "😊" },
    { day: "Tu", value: 0.85, emoji: "😊" },
    { day: "W", value: 0.6, emoji: "😐" },
    { day: "Th", value: 0.9, emoji: "😊" },
    { day: "F", value: 0.75, emoji: "😊" },
    { day: "Sa", value: 0.8, emoji: "😊" },
    { day: "Su", value: 0.95, emoji: "😄" },
  ];

  const topics = ["Family", "Health", "Weather", "Hobbies"];

  // Card entrance animations
  const moodCardEntrance = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: springs.smooth,
  });

  const topicsCardEntrance = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: springs.smooth,
  });

  const statsEntrance = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: springs.snappy,
  });

  // Animated stat counter
  const callCount = Math.min(7, Math.floor(interpolate(frame, [130, 160], [0, 7], { extrapolateRight: "clamp" })));
  const avgDuration = Math.min(45, Math.floor(interpolate(frame, [130, 160], [0, 45], { extrapolateRight: "clamp" })));

  return (
    <SceneLayout background={<GradientBackground variant="default" showParticles={false} />}>
      <ContentArea>
        {/* Dashboard mockup */}
        <PhoneFrame delay={0} scale={1.1} tiltIntensity={0.4}>
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
                fontSize: 22,
                fontWeight: 700,
                color: theme.colors.textPrimary,
                marginBottom: 20,
                opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Weekly Insights
            </div>

            {/* Mood trend card */}
            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                opacity: moodCardEntrance,
                transform: `translateY(${interpolate(moodCardEntrance, [0, 1], [20, 0])}px)`,
                border: `1px solid ${theme.colors.primary}15`,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>📊</span> Mood Trend
              </div>

              {/* Animated chart bars */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  height: 85,
                  gap: 6,
                }}
              >
                {moodData.map((item, i) => (
                  <AnimatedBar
                    key={i}
                    value={item.value}
                    maxHeight={60}
                    delay={40 + i * 6}
                    frame={frame}
                    fps={fps}
                    emoji={item.emoji}
                    day={item.day}
                    index={i}
                  />
                ))}
              </div>
            </div>

            {/* Topics card */}
            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                opacity: topicsCardEntrance,
                transform: `translateY(${interpolate(topicsCardEntrance, [0, 1], [20, 0])}px)`,
                border: `1px solid ${theme.colors.primary}15`,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>💬</span> Topics Discussed
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {topics.map((topic, i) => (
                  <TopicTag
                    key={topic}
                    topic={topic}
                    delay={90 + i * 8}
                    frame={frame}
                    fps={fps}
                    index={i}
                  />
                ))}
              </div>
            </div>

            {/* Call stats */}
            <div
              style={{
                display: "flex",
                gap: 12,
                opacity: statsEntrance,
                transform: `translateY(${interpolate(statsEntrance, [0, 1], [20, 0])}px)`,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: theme.colors.backgroundCard,
                  borderRadius: 16,
                  padding: 16,
                  textAlign: "center",
                  border: `1px solid ${theme.colors.primary}20`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.colors.primary,
                    textShadow: `0 0 20px ${theme.colors.primary}30`,
                  }}
                >
                  {callCount}
                </div>
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 11,
                    color: theme.colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Calls
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: theme.colors.backgroundCard,
                  borderRadius: 16,
                  padding: 16,
                  textAlign: "center",
                  border: `1px solid ${theme.colors.success}20`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.colors.success,
                    textShadow: `0 0 20px ${theme.colors.success}30`,
                  }}
                >
                  {avgDuration}m
                </div>
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 11,
                    color: theme.colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Avg Duration
                </div>
              </div>
            </div>
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
        <Sequence from={185} layout="none">
          <AnimatedText
            text="mood, topics & connection."
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: theme.colors.primary,
              lineHeight: 1.4,
            }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
