import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Lottie } from "@remotion/lottie";
import type { SceneText, VideoProps } from "../types";
import { theme } from "../theme";
import { useLottieData } from "../hooks/useLottie";
import { TypewriterText } from "../components/TypewriterText";
import { ConfettiBurst } from "../components/ConfettiBurst";

const LottieCharacter: React.FC<{
  voiceCharacter: VideoProps["voiceCharacter"];
}> = ({ voiceCharacter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useLottieData(`voices/${voiceCharacter}.json`);

  const scale = spring({ frame, fps, config: { damping: 12 } });

  if (!data) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 200,
        width: 280,
        height: 280,
        transform: `scale(${scale})`,
      }}
    >
      <Lottie animationData={data} />
    </div>
  );
};

const FirstBubble: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 60,
        top: 520,
        maxWidth: "85%",
      }}
    >
      <div
        style={{
          background: theme.colors.primary,
          borderRadius: "24px 24px 24px 4px",
          padding: "20px 28px",
        }}
      >
        <TypewriterText
          text={text}
          color={theme.colors.white}
          fontSize={26}
          charsPerFrame={0.5}
        />
      </div>
    </div>
  );
};

const SecondBubble: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const translateY = interpolate(
    spring({ frame, fps, config: { damping: 12 } }),
    [0, 1],
    [50, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 700,
        maxWidth: "85%",
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          background: theme.colors.stone200,
          borderRadius: "24px 24px 4px 24px",
          padding: "20px 28px",
        }}
      >
        <TypewriterText
          text={text}
          delay={5}
          color={theme.colors.stone900}
          fontSize={26}
        />
      </div>
    </div>
  );
};

const Scrollbar: React.FC = () => {
  const frame = useCurrentFrame();

  const top = interpolate(frame, [0, 20], [200, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const height = interpolate(frame, [0, 20], [60, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        right: 20,
        top,
        width: 4,
        height,
        backgroundColor: "#A8A29E",
        borderRadius: 2,
      }}
    />
  );
};

const AlertNotification: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const top = interpolate(
    spring({ frame, fps, config: { damping: 12 } }),
    [0, 1],
    [-100, 40],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
      }}
    >
      <div
        style={{
          background: "#ef4444",
          borderRadius: 16,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 22 }}>{"\uD83D\uDD14"}</span>
        <span
          style={{
            color: theme.colors.white,
            fontSize: 22,
            fontWeight: 600,
            fontFamily: theme.fonts.manrope,
          }}
        >
          Wellness Alert
        </span>
      </div>
    </div>
  );
};

const AlertInteraction: React.FC = () => {
  const frame = useCurrentFrame();

  const r = Math.round(
    interpolate(frame, [10, 20], [239, 34], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const g = Math.round(
    interpolate(frame, [10, 20], [68, 197], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const b = Math.round(
    interpolate(frame, [10, 20], [68, 94], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const resolved = frame >= 15;

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 60,
        right: 60,
      }}
    >
      <div
        style={{
          background: `rgb(${r},${g},${b})`,
          borderRadius: 16,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            color: theme.colors.white,
            fontSize: 22,
            fontWeight: 600,
            fontFamily: theme.fonts.manrope,
          }}
        >
          {resolved ? "\u2713 Resolved" : "\uD83D\uDD14 Wellness Alert"}
        </span>
      </div>
    </div>
  );
};

const SceneFadeOut: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.white, opacity }} />
  );
};

export const InteractiveDemoScene: React.FC<{
  sceneText: SceneText;
  voiceCharacter: VideoProps["voiceCharacter"];
}> = ({ sceneText, voiceCharacter }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.white }}>
      <Sequence from={0} premountFor={15}>
        <LottieCharacter voiceCharacter={voiceCharacter} />
      </Sequence>

      <Sequence from={15} premountFor={15}>
        <FirstBubble text={sceneText.conversationLines[0]} />
      </Sequence>

      <Sequence from={85} premountFor={15}>
        <SecondBubble text={sceneText.conversationLines[1]} />
      </Sequence>

      <Sequence from={130} premountFor={15}>
        <Scrollbar />
      </Sequence>

      <Sequence from={160} premountFor={15}>
        <AlertNotification />
      </Sequence>

      <Sequence from={200} premountFor={15}>
        <AlertInteraction />
      </Sequence>

      <Sequence from={230} premountFor={15}>
        <ConfettiBurst
          centerX={540}
          centerY={100}
          triggerFrame={0}
          count={25}
          duration={40}
        />
      </Sequence>

      <Sequence from={280}>
        <SceneFadeOut />
      </Sequence>
    </AbsoluteFill>
  );
};
