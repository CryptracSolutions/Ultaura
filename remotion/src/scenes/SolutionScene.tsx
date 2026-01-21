import React from "react";
import { useCurrentFrame, interpolate, Sequence } from "remotion";
import { theme } from "../theme";
import {
  GradientBackground,
  UltauraLogo,
  Waveform,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

export const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Glow pulse effect
  const glowIntensity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.6]);

  return (
    <SceneLayout background={<GradientBackground variant="radial" />}>
      {/* Glowing accent behind content */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.colors.primary}${Math.round(glowIntensity * 40)
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
          filter: "blur(60px)",
          zIndex: 0,
        }}
      />

      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
          }}
        >
          {/* Logo reveal */}
          <UltauraLogo delay={0} size={140} showWordmark={true} />

          {/* Waveform animation */}
          <Sequence from={45} layout="none">
            <div
              style={{
                opacity: interpolate(frame - 45, [0, 20], [0, 1], {
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <Waveform width={280} height={70} bars={16} />
            </div>
          </Sequence>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={70} layout="none">
          <AnimatedText
            text="An AI voice companion"
            style={{
              fontSize: 42,
              fontWeight: 500,
              color: theme.colors.textSecondary,
              lineHeight: 1.4,
            }}
            animationType="fadeUp"
          />
        </Sequence>
        <Sequence from={95} layout="none">
          <AnimatedText
            text="that calls daily."
            style={{
              fontSize: 42,
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
