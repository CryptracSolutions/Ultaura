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
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

interface ReminderCardProps {
  icon: React.ReactNode;
  title: string;
  time: string;
  color: string;
  delay: number;
  index: number;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  icon,
  title,
  time,
  color,
  delay,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delay);

  const springValue = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  const translateX = interpolate(springValue, [0, 1], [index % 2 === 0 ? -100 : 100, 0]);
  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pending dot animation
  const checkFill = spring({
    frame: Math.max(0, adjustedFrame - 15),
    fps,
    config: springs.bouncy,
  });

  // Subtle glow
  const glowIntensity = interpolate(
    Math.sin(frame * 0.06 + index),
    [-1, 1],
    [0.1, 0.3]
  );

  return (
      <div
        style={{
          background: theme.colors.backgroundCard,
          borderRadius: 22,
          padding: 26,
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity,
          transform: `translateX(${translateX}px)`,
          border: `1px solid ${color}25`,
          boxShadow: `0 6px 24px rgba(0, 0, 0, 0.18), 0 0 ${30 * glowIntensity}px ${color}20`,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${color}25`,
          }}
        >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 20,
            fontWeight: 600,
            color: theme.colors.textPrimary,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 16,
            color: theme.colors.textSecondary,
          }}
        >
          {time}
        </div>
      </div>
      {/* Pending indicator */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle pending dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            position: "relative",
            zIndex: 1,
            transform: `scale(${interpolate(checkFill, [0, 1], [0.6, 1])})`,
            opacity: interpolate(checkFill, [0, 1], [0.4, 1]),
          }}
        />
      </div>
    </div>
  );
};

export const RemindersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reminders = [
    {
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill={theme.colors.error}>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      ),
      title: "Take Medication",
      time: "8:00 AM Daily",
      color: theme.colors.error,
    },
    {
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill={theme.colors.info}>
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
        </svg>
      ),
      title: "Doctor Appointment",
      time: "Tomorrow 2:30 PM",
      color: theme.colors.info,
    },
  ];

  // Header entrance
  const headerEntrance = spring({
    frame,
    fps,
    config: springs.smooth,
  });

  // Bell icon animation
  const bellWobble = interpolate(
    Math.sin(frame * 0.2),
    [-1, 1],
    [-5, 5]
  );

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
          width: "100%",
          maxWidth: 560,
        }}
      >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: headerEntrance,
              transform: `translateY(${interpolate(headerEntrance, [0, 1], [-20, 0])}px)`,
            }}
          >
            <div
              style={{
                transform: `rotate(${bellWobble}deg)`,
                transformOrigin: "top center",
              }}
            >
              <svg
              width="52"
              height="52"
                viewBox="0 0 24 24"
                fill={theme.colors.primary}
              >
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            </div>
            <div
              style={{
                fontFamily: theme.fonts.heading,
              fontSize: 34,
                fontWeight: 700,
                color: theme.colors.textPrimary,
              }}
            >
              Reminders
            </div>
          </div>

          {/* Reminder cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              width: "100%",
            }}
          >
            {reminders.map((reminder, i) => (
              <ReminderCard
                key={i}
                {...reminder}
                delay={30 + i * 25}
                index={i}
              />
            ))}
          </div>

          <Sequence from={100} layout="none">
            <div
              style={{
                textAlign: "center",
                fontFamily: theme.fonts.body,
                fontSize: 15,
                color: theme.colors.textMuted,
                opacity: interpolate(frame - 100, [0, 20], [0, 0.7], {
                  extrapolateRight: "clamp",
                }),
              }}
            >
              +3 more reminders
            </div>
          </Sequence>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={130} layout="none">
          <AnimatedText
            text="Set reminders."
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={160} layout="none">
          <AnimatedText
            text="Never miss a thing."
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
