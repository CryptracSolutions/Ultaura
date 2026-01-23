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
    config: springs.quick,
  });

  const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Slide in from alternating sides
  const slideDirection = index % 2 === 0 ? -1 : 1;
  const slideX = interpolate(tileSpring, [0, 1], [slideDirection * 80, 0]);

  // Faster selection animation at frame 45
  const selectionProgress = isSelected
    ? spring({
        frame: Math.max(0, frame - 45),
        fps,
        config: springs.bouncy,
      })
    : 0;

  const selectedScale = interpolate(selectionProgress, [0, 1], [1, 1.08]);
  const glowOpacity = interpolate(selectionProgress, [0, 1], [0, 0.5]);

  return (
    <div
      style={{
        width: 180,
        height: 220,
        background: theme.colors.backgroundCard,
        borderRadius: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 18,
        opacity,
        transform: `scale(${tileSpring * selectedScale}) translateX(${slideX}px)`,
        border: isSelected
          ? `3px solid ${theme.colors.primary}`
          : `1px solid ${theme.colors.textMuted}25`,
        boxShadow: isSelected
          ? `0 0 40px ${theme.colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")}, 0 10px 30px rgba(0,0,0,0.4)`
          : "0 8px 24px rgba(0, 0, 0, 0.25)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 95,
          height: 95,
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
          style={{ width: 70, height: 70, objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 22,
          fontWeight: 600,
          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
        }}
      >
        {voice.name}
      </div>

      <div
        style={{
          fontFamily: theme.fonts.body,
          fontSize: 16,
          color: theme.colors.textSecondary,
        }}
      >
        {voice.trait}
      </div>

      {isSelected && selectionProgress > 0.5 && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: theme.colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 12px ${theme.colors.primary}60`,
            transform: `scale(${selectionProgress})`,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
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
            gap: 28,
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 42,
              fontWeight: 700,
              color: theme.colors.textPrimary,
              opacity: headerEntrance,
              transform: `translateY(${interpolate(headerEntrance, [0, 1], [-20, 0])}px)`,
            }}
          >
            Choose a voice.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", position: "relative" }}>
            <div style={{ display: "flex", gap: 18 }}>
              {voices.slice(0, 3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={12 + i * 5}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              {voices.slice(3).map((voice, i) => (
                <VoiceTile
                  key={voice.id}
                  voice={voice}
                  index={i + 3}
                  frame={frame}
                  fps={fps}
                  isSelected={voice.id === selectedVoice}
                  delay={12 + (i + 3) * 5}
                />
              ))}
            </div>

          </div>

          <Sequence from={65} layout="none">
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 20,
                color: theme.colors.textSecondary,
                opacity: interpolate(frame - 65, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Selected: <span style={{ color: theme.colors.primary, fontWeight: 600 }}>Ara</span>
            </div>
          </Sequence>
        </div>
      </ContentArea>

      <TextArea>
        <Sequence from={90} layout="none">
          <AnimatedText
            text="Find the perfect"
            style={{ fontSize: 38, fontWeight: 600, color: theme.colors.textPrimary, lineHeight: 1.4 }}
            animationType="wordReveal"
          />
        </Sequence>
        <Sequence from={115} layout="none">
          <AnimatedText
            text="companion."
            style={{ fontSize: 38, fontWeight: 700, color: theme.colors.primary, lineHeight: 1.4 }}
            animationType="glowReveal"
          />
        </Sequence>
      </TextArea>
    </SceneLayout>
  );
};
