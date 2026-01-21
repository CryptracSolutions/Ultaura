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

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone ring animation
  const ringScale = spring({
    frame: frame % 30,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  // Ripple effect
  const ripple1Scale = interpolate(frame % 60, [0, 60], [0.8, 2]);
  const ripple1Opacity = interpolate(frame % 60, [0, 60], [0.6, 0]);
  const ripple2Scale = interpolate((frame + 20) % 60, [0, 60], [0.8, 2]);
  const ripple2Opacity = interpolate((frame + 20) % 60, [0, 60], [0.6, 0]);

  const phoneOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <SceneLayout background={<GradientBackground variant="mesh" />}>
      <ContentArea>
        {/* Ringing phone icon */}
        <div
          style={{
            position: "relative",
            width: 200,
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: phoneOpacity,
          }}
        >
          {/* Ripples */}
          <div
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              borderRadius: "50%",
              border: `3px solid ${theme.colors.primary}`,
              transform: `scale(${ripple1Scale})`,
              opacity: ripple1Opacity,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              borderRadius: "50%",
              border: `3px solid ${theme.colors.primary}`,
              transform: `scale(${ripple2Scale})`,
              opacity: ripple2Opacity,
            }}
          />

          {/* Phone icon */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${ringScale}) rotate(${Math.sin(frame * 0.5) * 5}deg)`,
              boxShadow: `0 0 60px ${theme.colors.primary}50`,
            }}
          >
            <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </div>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={45} layout="none">
          <AnimatedText
            text="What if your loved one"
            style={{
              fontSize: 48,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={65} layout="none">
          <AnimatedText
            text="never felt alone?"
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: theme.colors.primary,
              lineHeight: 1.3,
              marginTop: 10,
            }}
            animationType="fadeUp"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
