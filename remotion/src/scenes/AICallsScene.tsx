import React from "react";
import {
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme } from "../theme";
import {
  GradientBackground,
  PhoneFrame,
  Waveform,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const AICallsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation for active indicator
  const pulseOpacity = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.4, 1]);
  const pulseScale = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.8, 1.2]);

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        {/* Phone with active call UI */}
        <PhoneFrame delay={0} scale={0.95}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(180deg, ${theme.colors.backgroundLight} 0%, ${theme.colors.background} 100%)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 30,
              paddingTop: 50,
            }}
          >
            {/* Active call indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 25,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: theme.colors.success,
                  opacity: pulseOpacity,
                  transform: `scale(${pulseScale})`,
                }}
              />
              <span
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  color: theme.colors.success,
                  fontWeight: 500,
                }}
              >
                Active Call
              </span>
            </div>

            {/* Caller avatar */}
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 15,
                boxShadow: `0 0 40px ${theme.colors.primary}40`,
              }}
            >
              <svg width="45" height="45" viewBox="0 0 24 24" fill="white">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            {/* Voice name */}
            <div
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: 24,
                fontWeight: 600,
                color: theme.colors.textPrimary,
                marginBottom: 5,
              }}
            >
              Ara
            </div>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 12,
                color: theme.colors.textSecondary,
                marginBottom: 25,
              }}
            >
              Warm & Nurturing Voice
            </div>

            {/* Waveform */}
            <Sequence from={30} layout="none">
              <Waveform width={200} height={45} bars={12} />
            </Sequence>

            {/* Call duration */}
            <Sequence from={60} layout="none">
              <div
                style={{
                  marginTop: 20,
                  fontFamily: theme.fonts.body,
                  fontSize: 28,
                  fontWeight: 300,
                  color: theme.colors.textMuted,
                  opacity: interpolate(frame - 60, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {Math.floor((frame - 60) / fps / 60)}:
                {String(Math.floor(((frame - 60) / fps) % 60)).padStart(2, "0")}
              </div>
            </Sequence>

            {/* End call button */}
            <Sequence from={90} layout="none">
              <div
                style={{
                  marginTop: 25,
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: theme.colors.error,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: interpolate(frame - 90, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </div>
            </Sequence>
          </div>
        </PhoneFrame>
      </ContentArea>

      <TextArea>
        <Sequence from={120} layout="none">
          <AnimatedText
            text="Friendly check-ins."
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={140} layout="none">
          <AnimatedText
            text="Natural conversations."
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={160} layout="none">
          <AnimatedText
            text="Every single day."
            style={{
              fontSize: 36,
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
