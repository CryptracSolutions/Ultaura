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
    config: springs.quick,
  });

  const translateX = interpolate(springValue, [0, 1], [index % 2 === 0 ? -120 : 120, 0]);
  const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Checkmark animation - faster
  const checkFill = spring({
    frame: Math.max(0, adjustedFrame - 12),
    fps,
    config: springs.bouncy,
  });

  // Subtle glow
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08 + index),
    [-1, 1],
    [0.15, 0.4]
  );

  return (
    <div
      style={{
        background: theme.colors.backgroundCard,
        borderRadius: 24,
        padding: 32,
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity,
        transform: `translateX(${translateX}px)`,
        border: `1px solid ${color}30`,
        boxShadow: `0 10px 24px rgba(15, 23, 42, 0.08), 0 0 ${32 * glowIntensity}px ${color}20`,
        maxWidth: 700,
        width: "100%",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 22,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: `1px solid ${color}30`,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 24,
            fontWeight: 600,
            color: theme.colors.textPrimary,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 18,
            color: theme.colors.textSecondary,
          }}
        >
          {time}
        </div>
      </div>
      {/* Checkmark indicator */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: `${color}20`,
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: color,
            transform: `scale(${checkFill})`,
            borderRadius: "50%",
          }}
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="white"
          style={{
            position: "relative",
            zIndex: 1,
            opacity: checkFill,
            transform: `scale(${checkFill})`,
          }}
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
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
        <svg width="42" height="42" viewBox="0 0 24 24" fill={theme.colors.error}>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      ),
      title: "Take Medication",
      time: "8:00 AM Daily",
      color: theme.colors.error,
    },
    {
      icon: (
        <svg width="42" height="42" viewBox="0 0 24 24" fill={theme.colors.info}>
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

  // Bell icon animation - stronger swing
  const bellWobble = interpolate(
    Math.sin(frame * 0.25),
    [-1, 1],
    [-12, 12]
  );


  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            width: "100%",
            maxWidth: 700,
            position: "relative",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
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
                width="58"
                height="58"
                viewBox="0 0 24 24"
                fill={theme.colors.primary}
              >
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            </div>
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 38,
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
              gap: 18,
              width: "100%",
            }}
          >
            {reminders.map((reminder, i) => (
              <ReminderCard
                key={i}
                {...reminder}
                delay={25 + i * 18}
                index={i}
              />
            ))}
          </div>

          <Sequence from={75} layout="none">
            <div
              style={{
                textAlign: "center",
                fontFamily: theme.fonts.body,
                fontSize: 16,
                color: theme.colors.textMuted,
                opacity: interpolate(frame - 75, [0, 15], [0, 0.7], {
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
        <Sequence from={90} layout="none">
          <AnimatedText
            text="Reminders that feel human."
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              lineHeight: 1.35,
            }}
            animationType="wordReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
