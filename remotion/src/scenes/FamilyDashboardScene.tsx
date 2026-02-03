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

const StatCard: React.FC<{
  title: string;
  value: string;
  note: string;
  delay: number;
}> = ({ title, value, note, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame: Math.max(0, frame - delay), fps, config: springs.snappy });

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: theme.colors.backgroundCard,
        borderRadius: 18,
        padding: 18,
        border: `1px solid ${theme.colors.primary}15`,
        boxShadow: "0 12px 26px rgba(15, 23, 42, 0.08)",
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [14, 0])}px)`,
      }}
    >
      <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: theme.fonts.heading,
          fontSize: 24,
          fontWeight: 700,
          color: theme.colors.textPrimary,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted }}>
        {note}
      </div>
    </div>
  );
};

export const FamilyDashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const header = spring({ frame, fps, config: springs.smooth });
  const list = spring({ frame: Math.max(0, frame - 20), fps, config: springs.smooth });

  return (
    <SceneLayout background={<GradientBackground variant="default" showParticles={false} /> }>
      <ContentArea centered={false}>
        <div style={{ width: "100%" }}>
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 36,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              opacity: header,
              transform: `translateY(${interpolate(header, [0, 1], [-10, 0])}px)`,
              marginBottom: 24,
            }}
          >
            Family dashboard
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <StatCard title="Next check-in" value="6:00 PM" note="Today" delay={15} />
            <StatCard title="This week" value="4 calls" note="92% answered" delay={25} />
          </div>

          <div
            style={{
              background: theme.colors.backgroundCard,
              borderRadius: 20,
              padding: 18,
              border: `1px solid ${theme.colors.primary}12`,
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
              opacity: list,
              transform: `translateY(${interpolate(list, [0, 1], [16, 0])}px)`,
            }}
          >
            <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12 }}>
              Recent activity
            </div>
            {[
              "Call completed · 9 min",
              "Reminder sent · meds",
              "Call scheduled · tomorrow",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: `1px solid ${theme.colors.primary}10`,
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  color: theme.colors.textPrimary,
                }}
              >
                <span>{item}</span>
                <span style={{ color: theme.colors.textMuted, fontSize: 12 }}>Just now</span>
              </div>
            ))}
          </div>
        </div>
      </ContentArea>

      <TextArea>
        <AnimatedText
          text="For families, clarity at a glance."
          style={{ fontSize: 34, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.3 }}
          animationType="wordReveal"
        />
      </TextArea>
    </SceneLayout>
  );
};
