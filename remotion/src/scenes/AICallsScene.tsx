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
  Waveform,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const AICallsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation for active indicator - more pronounced
  const pulseOpacity = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.4, 0.8]);
  const pulseScale = interpolate(Math.sin(frame * 0.2), [-1, 1], [0.9, 1.08]);
  const pulseGlow = interpolate(Math.sin(frame * 0.2), [-1, 1], [0, 8]);

  // Avatar glow animation
  const avatarGlow = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [22, 45]
  );

  // Speaking indicator - voice bars inside avatar
  const voiceBars = [0, 1, 2, 3, 4].map((i) => {
    const phase = (i / 5) * Math.PI * 2;
    return interpolate(
      Math.sin((frame * 0.2) + phase),
      [-1, 1],
      [10, 20]
    );
  });

  // UI element entrances
  const activeIndicatorEntrance = spring({
    frame,
    fps,
    config: springs.snappy,
  });

  const avatarEntrance = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: springs.bouncy,
  });

  const waveformEntrance = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: springs.smooth,
  });

  const timerEntrance = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: springs.snappy,
  });

  const buttonEntrance = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: springs.smooth,
  });

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        {/* Phone with active call UI */}
        <PhoneFrame delay={0} scale={1.1} tiltIntensity={0.5}>
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
            {/* Active call indicator with enhanced animation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 25,
                opacity: activeIndicatorEntrance,
                transform: `translateY(${interpolate(activeIndicatorEntrance, [0, 1], [-10, 0])}px)`,
              }}
            >
              {/* Pulsing dot with glow */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: -4,
                    borderRadius: "50%",
                    background: theme.colors.success,
                    opacity: pulseOpacity * 0.3,
                    filter: `blur(${pulseGlow}px)`,
                    transform: `scale(${pulseScale})`,
                  }}
                />
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: theme.colors.success,
                    boxShadow: `0 0 ${pulseGlow}px ${theme.colors.success}`,
                    transform: `scale(${interpolate(pulseScale, [0.7, 1.3], [0.9, 1.1])})`,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  color: theme.colors.success,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                Active Call
              </span>
            </div>

            {/* Caller avatar with voice visualization */}
            <div
              style={{
                position: "relative",
                width: 100,
                height: 100,
                marginBottom: 18,
                transform: `scale(${avatarEntrance})`,
                opacity: interpolate(avatarEntrance, [0, 1], [0, 1]),
              }}
            >
              {/* Outer glow ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${theme.colors.primary}40 0%, transparent 70%)`,
                  filter: "blur(10px)",
                  opacity: interpolate(Math.sin(frame * 0.1), [-1, 1], [0.5, 1]),
                }}
              />

              {/* Avatar circle */}
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 ${avatarGlow}px ${theme.colors.primary}50`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Voice bars inside avatar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    height: 30,
                  }}
                >
                  {voiceBars.map((height, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height,
                        borderRadius: 2,
                        background: "rgba(255, 255, 255, 0.9)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Voice name with entrance */}
            <Sequence from={20} layout="none">
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 26,
                  fontWeight: 700,
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                  opacity: interpolate(frame - 20, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(frame - 20, [0, 15], [10, 0], { extrapolateRight: "clamp" })}px)`,
                }}
              >
                Ara
              </div>
            </Sequence>
            <Sequence from={25} layout="none">
              <div
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13,
                  color: theme.colors.textSecondary,
                  marginBottom: 25,
                  opacity: interpolate(frame - 25, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                Warm & Nurturing Voice
              </div>
            </Sequence>

            {/* Waveform with entrance */}
            <div
              style={{
                transform: `scale(${waveformEntrance})`,
                opacity: waveformEntrance,
              }}
            >
              <Waveform
                width={220}
                height={50}
                bars={14}
                variant="glow"
                entranceDelay={30}
              />
            </div>

            {/* Call duration counter */}
            <div
              style={{
                marginTop: 22,
                fontFamily: theme.fonts.body,
                fontSize: 32,
                fontWeight: 300,
                color: theme.colors.textMuted,
                transform: `scale(${timerEntrance})`,
                opacity: timerEntrance,
                letterSpacing: 1,
              }}
            >
              {Math.floor((Math.max(0, frame - 60)) / fps / 60)}:
              {String(Math.floor((Math.max(0, frame - 60) / fps) % 60)).padStart(2, "0")}
            </div>

            {/* End call button with entrance */}
            <div
              style={{
                marginTop: 25,
                transform: `scale(${buttonEntrance})`,
                opacity: buttonEntrance,
              }}
            >
              <div
                style={{
                  width: 65,
                  height: 65,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${theme.colors.error} 0%, #c92a2a 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 5px 20px ${theme.colors.error}50`,
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </div>
            </div>
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
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={145} layout="none">
          <AnimatedText
            text="Natural conversations."
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={170} layout="none">
          <AnimatedText
            text="Every single day."
            style={{
              fontSize: 36,
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
