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
    config: { damping: 12, stiffness: 100 },
  });

  const translateX = interpolate(springValue, [0, 1], [index % 2 === 0 ? -80 : 80, 0]);
  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: theme.colors.backgroundCard,
        borderRadius: 16,
        padding: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        transform: `translateX(${translateX}px)`,
        border: `1px solid ${color}30`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 16,
            fontWeight: 600,
            color: theme.colors.textPrimary,
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 12,
            color: theme.colors.textSecondary,
          }}
        >
          {time}
        </div>
      </div>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
          }}
        />
      </div>
    </div>
  );
};

export const RemindersScene: React.FC = () => {
  const frame = useCurrentFrame();

  const reminders = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={theme.colors.error}>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      ),
      title: "Take Medication",
      time: "8:00 AM Daily",
      color: theme.colors.error,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={theme.colors.info}>
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
        </svg>
      ),
      title: "Doctor Appointment",
      time: "Tomorrow 2:30 PM",
      color: theme.colors.info,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={theme.colors.success}>
          <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
        </svg>
      ),
      title: "Call Sarah",
      time: "This Saturday",
      color: theme.colors.success,
    },
  ];

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 25,
            width: "100%",
            maxWidth: 380,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: interpolate(frame, [0, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill={theme.colors.primary}
            >
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 28,
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
              gap: 12,
              width: "100%",
            }}
          >
            {reminders.map((reminder, i) => (
              <ReminderCard
                key={i}
                {...reminder}
                delay={30 + i * 20}
                index={i}
              />
            ))}
          </div>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={110} layout="none">
          <AnimatedText
            text="Medication. Appointments."
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={130} layout="none">
          <AnimatedText
            text="Never miss a thing."
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
