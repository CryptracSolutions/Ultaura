import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type AnimatedTextProps = {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  highlightWord?: string;
  highlightGradient?: string;
  fontWeight?: number;
  exitDelay?: number;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 64,
  color = theme.colors.stone900,
  delay = 0,
  highlightWord,
  highlightGradient = "linear-gradient(90deg, #0ABAB5, #22d3ee)",
  fontWeight = 700,
  exitDelay,
}) => {
  const frame = useCurrentFrame();

  const enterOpacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterTranslateY = interpolate(frame - delay, [0, 20], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let exitOpacity = 1;
  let exitTranslateY = 0;

  if (exitDelay !== undefined) {
    exitOpacity = interpolate(
      frame,
      [exitDelay, exitDelay + 20],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    exitTranslateY = interpolate(
      frame,
      [exitDelay, exitDelay + 20],
      [0, -40],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  const opacity = enterOpacity * exitOpacity;
  const translateY = enterTranslateY + exitTranslateY;

  const renderText = () => {
    if (!highlightWord) {
      return text;
    }

    const parts = text.split(new RegExp(`(${highlightWord})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlightWord.toLowerCase() ? (
        <span
          key={i}
          style={{
            background: highlightGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight,
          fontFamily: theme.fonts.manrope,
          color,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 60px",
          lineHeight: 1.2,
        }}
      >
        {renderText()}
      </div>
    </AbsoluteFill>
  );
};
