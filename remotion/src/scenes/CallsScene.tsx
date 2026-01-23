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
  PhoneFrame,
  Waveform,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const CallsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calmer pulse animation for active indicator
  const pulseOpacity = interpolate(Math.sin(frame * 0.12), [-1, 1], [0.4, 0.65]);
  const pulseScale = interpolate(Math.sin(frame * 0.12), [-1, 1], [0.96, 1.03]);
  const pulseGlow = interpolate(Math.sin(frame * 0.12), [-1, 1], [0, 4]);

  // Avatar glow animation
  const avatarGlow = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [18, 32]
  );

  // Speaking indicator - voice bars inside avatar
  const voiceBars = [0, 1, 2, 3, 4].map((i) => {
    const phase = (i / 5) * Math.PI * 2;
    return interpolate(
      Math.sin((frame * 0.16) + phase),
      [-1, 1],
      [12, 18]
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
        <PhoneFrame delay={0} scale={1.3} tiltIntensity={0.35}>
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
                    transform: `scale(${interpolate(pulseScale, [0.96, 1.03], [0.97, 1.03])})`,
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
                  opacity: interpolate(Math.sin(frame * 0.08), [-1, 1], [0.4, 0.8]),
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

            {/* Live headline card */}
            <Sequence from={100} layout="none">
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  background: theme.colors.backgroundCard,
                  borderRadius: 16,
                  border: `1px solid ${theme.colors.info}30`,
                  width: 220,
                  opacity: interpolate(frame - 100, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(frame - 100, [0, 20], [15, 0], { extrapolateRight: "clamp" })}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: theme.colors.error,
                      boxShadow: `0 0 8px ${theme.colors.error}`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.colors.error,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Live
                  </span>
                </div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 }}>
                  Today's Weather
                </div>
                <div style={{ fontFamily: theme.fonts.heading, fontSize: 18, fontWeight: 600, color: theme.colors.textPrimary }}>
                  Sunny and 72°
                </div>
              </div>
            </Sequence>

            {/* Speech bubble */}
            <Sequence from={140} layout="none">
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  background: `${theme.colors.primary}15`,
                  borderRadius: 18,
                  borderTopLeftRadius: 4,
                  maxWidth: 240,
                  opacity: interpolate(frame - 140, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `scale(${interpolate(frame - 140, [0, 15], [0.9, 1], { extrapolateRight: "clamp" })})`,
                }}
              >
                <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textPrimary, fontStyle: "italic" }}>
                  "Did you hear? It's beautiful outside today!"
                </div>
              </div>
            </Sequence>

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
        <Sequence from={180} layout="none">
          <AnimatedText
            text="Chat about anything."
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              lineHeight: 1.4,
            }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={210} layout="none">
          <AnimatedText
            text="From weather to memories."
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
