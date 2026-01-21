import React from "react";
import { useCurrentFrame, interpolate, Sequence } from "remotion";
import { theme } from "../theme";
import {
  GradientBackground,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Floating phone icons
  const phones = [
    { x: -200, y: -100, delay: 0 },
    { x: 200, y: -50, delay: 15 },
    { x: -150, y: 100, delay: 30 },
    { x: 180, y: 80, delay: 45 },
  ];

  return (
    <SceneLayout background={<GradientBackground variant="default" />}>
      <ContentArea>
        <div
          style={{
            position: "relative",
            width: 300,
            height: 250,
          }}
        >
          {/* Empty calendar visual */}
          <div
            style={{
              width: 300,
              height: 200,
              background: theme.colors.backgroundCard,
              borderRadius: 20,
              border: `1px solid ${theme.colors.textMuted}30`,
              opacity: interpolate(frame, [0, 20, 160, 180], [0, 0.8, 0.8, 0], {
                extrapolateRight: "clamp",
              }),
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Calendar header */}
            <div
              style={{
                padding: 20,
                background: theme.colors.backgroundLight,
                borderBottom: `1px solid ${theme.colors.textMuted}20`,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 18,
                  color: theme.colors.textMuted,
                }}
              >
                This Week
              </div>
            </div>
            {/* Empty days */}
            <div
              style={{
                flex: 1,
                padding: 20,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      color: theme.colors.textMuted,
                    }}
                  >
                    {day}
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: `1px dashed ${theme.colors.textMuted}40`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Floating disconnected phone icons */}
          {phones.map((phone, i) => {
            const adjustedFrame = Math.max(0, frame - phone.delay);
            const opacity = interpolate(
              adjustedFrame,
              [0, 20, 140, 170],
              [0, 0.4, 0.4, 0],
              { extrapolateRight: "clamp" }
            );
            const y = interpolate(adjustedFrame, [0, 170], [0, -30]);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${phone.x}px)`,
                  top: `calc(50% + ${phone.y}px + ${y}px)`,
                  opacity,
                  transform: `rotate(${i * 20 - 40}deg)`,
                }}
              >
                <svg
                  width="50"
                  height="50"
                  viewBox="0 0 24 24"
                  fill={theme.colors.textMuted}
                  opacity={0.6}
                >
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </div>
            );
          })}
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={30} layout="none">
          <AnimatedText
            text="Millions of seniors"
            style={{
              fontSize: 44,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={55} layout="none">
          <AnimatedText
            text="spend days without"
            style={{
              fontSize: 44,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={80} layout="none">
          <AnimatedText
            text="meaningful conversation."
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
