import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Sequence,
  Img,
  staticFile,
} from "remotion";
import { theme, springs } from "../theme";
import {
  GradientBackground,
  AnimatedText,
  SceneLayout,
  ContentArea,
  TextArea,
} from "../components";

const voices = [
  { id: "ara", name: "Ara", trait: "Warm", file: "voices/ara.svg" },
  { id: "eve", name: "Eve", trait: "Calm", file: "voices/eve.svg" },
  { id: "leo", name: "Leo", trait: "Friendly", file: "voices/leo.svg" },
  { id: "rex", name: "Rex", trait: "Confident", file: "voices/rex.svg" },
  { id: "sal", name: "Sal", trait: "Bright", file: "voices/sal.svg" },
];

interface VoiceTileProps {
  voice: typeof voices[0];
  index: number;
  frame: number;
  fps: number;
  isSelected: boolean;
  delay: number;
}

const VoiceTile: React.FC<VoiceTileProps> = ({
  voice,
  index,
  frame,
  fps,
  isSelected,
  delay,
}) => {
  const adjustedFrame = Math.max(0, frame - delay);

  const tileSpring = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const selectionProgress = isSelected
    ? spring({
        frame: Math.max(0, frame - 70),
        fps,
        config: springs.bouncy,
      })
    : 0;

  const selectedScale = interpolate(selectionProgress, [0, 1], [1, 1.05]);
  const glowOpacity = interpolate(selectionProgress, [0, 1], [0, 0.4]);

  return (
    <div
      style={{
        width: 140,
        height: 180,
        background: theme.colors.backgroundCard,
        borderRadius: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 16,
        opacity,
        transform: `scale(${tileSpring * selectedScale}) translateY(${interpolate(tileSpring, [0, 1], [20, 0])}px)`,
        border: isSelected
          ? `2px solid ${theme.colors.primary}`
          : `1px solid ${theme.colors.textMuted}25`,
        boxShadow: isSelected
          ? `0 0 30px ${theme.colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")}, 0 8px 24px rgba(0,0,0,0.3)`
          : "0 6px 20px rgba(0, 0, 0, 0.2)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${theme.colors.backgroundLight} 0%, ${theme.colors.background} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.textMuted}30`,
        }}
      >
        <Img
          src={staticFile(voice.file)}
          style={{ width: 60, height: 60, objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 18,
          fontWeight: 600,
          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
        }}
      >
        {voice.name}
      </div>

      <div
        style={{
          fontFamily: theme.fonts.body,
          fontSize: 14,
          color: theme.colors.textSecondary,
        }}
      >
        {voice.trait}
      </div>

      {isSelected && selectionProgress > 0.5 && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: theme.colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 8px ${theme.colors.primary}60`,
            transform: `scale(${selectionProgress})`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const VoiceSelectionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerEntrance = spring({
    frame,
    fps,
    config: springs.smooth,
  });

  const selectedVoice = "ara";

  return (
    <SceneLayout background={<GradientBackground variant="aurora" />}>
      <ContentArea>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 38,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              opacity: headerEntrance,
              transform: `translateY(${interpolate(headerEntrance, [0, 1], [-20, 0])}px)`,
            }}
          >
            Choose a voice.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16 }}>
              {voices.slice(0, 3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={15 + i * 8}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {voices.slice(3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i + 3}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={15 + (i + 3) * 8}
                />
              ))}
            </div>
          </div>

          <Sequence from={90} layout="none">
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 18,
                color: theme.colors.textSecondary,
                opacity: interpolate(frame - 90, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Selected: <span style={{ color: theme.colors.primary, fontWeight: 600 }}>Ara</span>
            </div>
          </Sequence>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={120} layout="none">
          <AnimatedText
            text="Find the perfect"
            style={{ fontSize: 36, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={145} layout="none">
          <AnimatedText
            text="companion."
            style={{ fontSize: 36, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
