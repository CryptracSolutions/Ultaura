import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

const MoodBars: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const data = [0.6, 0.72, 0.55, 0.82, 0.78, 0.9, 0.7];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
      {data.map((value, i) => {
        const bar = spring({ frame: Math.max(0, frame - 20 - i * 4), fps, config: springs.snappy });
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                width: "100%",
                height: value * 70 * bar,
                borderRadius: 6,
                background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 100%)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export const InsightsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const header = spring({ frame, fps, config: springs.smooth });
  const cardA = spring({ frame: Math.max(0, frame - 15), fps, config: springs.smooth });
  const cardB = spring({ frame: Math.max(0, frame - 35), fps, config: springs.smooth });

  return (
    <SceneLayout background={<GradientBackground variant="mesh" showParticles={false} /> }>
      <ContentArea>
        <PhoneFrame delay={0} scale={1.32} tiltIntensity={0.28}>
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
                fontSize: 22,
                fontWeight: 700,
                color: theme.colors.textPrimary,
                marginBottom: 18,
                opacity: header,
                transform: `translateY(${interpolate(header, [0, 1], [-10, 0])}px)`,
              }}
            >
              Insights
            </div>

            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 18,
                padding: 18,
                border: `1px solid ${theme.colors.primary}18`,
                marginBottom: 14,
                opacity: cardA,
                transform: `translateY(${interpolate(cardA, [0, 1], [16, 0])}px)`,
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
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
                <span>Weekly mood</span>
              </div>
              <MoodBars frame={frame} fps={fps} />
            </div>

            <div
              style={{
                background: theme.colors.backgroundCard,
                borderRadius: 18,
                padding: 16,
                border: `1px solid ${theme.colors.success}20`,
                display: "grid",
                gap: 8,
                opacity: cardB,
                transform: `translateY(${interpolate(cardB, [0, 1], [16, 0])}px)`,
              }}
            >
              <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary }}>
                Summary
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                }}
              >
                Mostly upbeat this week
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary }}>
                4 calls • 92% answered
              </div>
            </div>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <AnimatedText
          text="Insights, trends, weekly summaries."
          style={{ fontSize: 34, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.3 }}
          animationType="wordReveal"
        />
      </TextArea>
    </SceneLayout>
  );
};
