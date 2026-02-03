import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

const AlertCard: React.FC<{
  tone: "neutral" | "positive";
  title: string;
  message: string;
  delay: number;
}> = ({ tone, title, message, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame: Math.max(0, frame - delay), fps, config: springs.smooth });
  const color = tone === "positive" ? theme.colors.success : theme.colors.warning;

  return (
    <div
      style={{
        background: theme.colors.backgroundCard,
        borderRadius: 20,
        padding: 18,
        border: `1px solid ${color}30`,
        display: "flex",
        gap: 16,
        alignItems: "center",
        boxShadow: "0 14px 26px rgba(15, 23, 42, 0.1)",
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [14, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontWeight: 700,
          fontFamily: theme.fonts.heading,
        }}
      >
        {tone === "positive" ? "✓" : "!"}
      </div>
      <div>
        <div style={{ fontFamily: theme.fonts.heading, fontSize: 18, fontWeight: 600, color: theme.colors.textPrimary }}>
          {title}
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 }}>
          {message}
        </div>
      </div>
    </div>
  );
};

export const PeaceOfMindScene: React.FC = () => {
  return (
    <SceneLayout background={<GradientBackground variant="aurora" showParticles={false} /> }>
      <ContentArea>
        <div style={{ display: "grid", gap: 18, width: "100%", maxWidth: 720 }}>
          <AlertCard
            tone="neutral"
            title="Wellness note"
            message="Feeling a little tired today"
            delay={10}
          />
          <AlertCard
            tone="positive"
            title="All clear"
            message="Call went great"
            delay={30}
          />
        </div>
      </ContentArea>

      <TextArea>
        <AnimatedText
          text="Peace of mind, without being intrusive."
          style={{ fontSize: 32, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.35 }}
          animationType="wordReveal"
        />
      </TextArea>
    </SceneLayout>
  );
};
