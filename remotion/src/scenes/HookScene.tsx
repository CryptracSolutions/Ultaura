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
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone ring animation with spring
  const ringSpring = spring({
    frame: frame % 30,
    fps,
    config: springs.snappy,
  });

  // Rotation wobble
  const wobble = interpolate(
    Math.sin(frame * 0.4),
    [-1, 1],
    [-2, 2]
  );

  // Ripple effects - staggered
  const ripple1Progress = (frame % 90) / 90;
  const ripple2Progress = ((frame + 30) % 90) / 90;

  const getRippleStyle = (progress: number) => ({
    scale: interpolate(progress, [0, 1], [0.9, 1.8]),
    opacity: interpolate(progress, [0, 0.35, 1], [0, 0.25, 0]),
  });

  const ripple1 = getRippleStyle(ripple1Progress);
  const ripple2 = getRippleStyle(ripple2Progress);

  // Phone entrance
  const phoneEntrance = spring({
    frame,
    fps,
    config: springs.heavy,
  });

  const phoneOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
    easing: easings.easeOut,
  });

  const phoneScale = interpolate(phoneEntrance, [0, 1], [0.5, 1]);

  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [20, 60]
  );

  return (
    <SceneLayout background={<GradientBackground variant="aurora" showParticles={false} />}>
      <ContentArea>
        {/* Ringing phone icon */}
        <div
          style={{
            position: "relative",
            width: 240,
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: phoneOpacity,
            transform: `scale(${phoneScale})`,
          }}
        >
          {/* Multiple ripples for depth */}
          {[ripple1, ripple2].map((ripple, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 200,
                height: 200,
                borderRadius: "50%",
                border: `${3 - i}px solid ${theme.colors.primary}`,
                transform: `scale(${ripple.scale})`,
                opacity: ripple.opacity,
              }}
            />
          ))}

          {/* Outer glow ring */}
          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.colors.primary}20 0%, transparent 70%)`,
              filter: `blur(20px)`,
              opacity: interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.7]),
            }}
          />

          {/* Phone icon circle */}
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${ringSpring}) rotate(${wobble}deg)`,
              boxShadow: `
                0 0 ${glowIntensity}px ${theme.colors.primary}60,
                0 10px 30px rgba(0, 0, 0, 0.3),
                inset 0 2px 0 rgba(255, 255, 255, 0.2)
              `,
            }}
          >
            <svg width="65" height="65" viewBox="0 0 24 24" fill="white">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </div>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={35} layout="none">
          <AnimatedText
            text="A daily voice companion for seniors."
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              lineHeight: 1.3,
            }}
            animationType="wordReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
