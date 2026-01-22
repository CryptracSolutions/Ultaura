import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { theme, springs, easings } from "../theme";

interface AnimatedTextProps {
  text: string;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
  animationType?:
    | "fadeUp"
    | "fadeIn"
    | "typewriter"
    | "scale"
    | "charReveal"
    | "wordReveal"
    | "glowReveal";
  highlightWord?: string;
  highlightColor?: string;
  charDelay?: number; // Frames between each character for charReveal
}

// Character animation component for charReveal
const AnimatedChar: React.FC<{
  char: string;
  index: number;
  frame: number;
  fps: number;
  delay: number;
  charDelay: number;
  style?: React.CSSProperties;
}> = ({ char, index, frame, fps, delay, charDelay, style }) => {
  const charStartFrame = delay + index * charDelay;
  const adjustedFrame = Math.max(0, frame - charStartFrame);

  const springValue = spring({
    frame: adjustedFrame,
    fps,
    config: springs.snappy,
  });

  const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(springValue, [0, 1], [20, 0]);
  const rotate = interpolate(springValue, [0, 1], [-8, 0]);

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
        whiteSpace: char === " " ? "pre" : "normal",
        ...style,
      }}
    >
      {char}
    </span>
  );
};

// Word animation component for wordReveal
const AnimatedWord: React.FC<{
  word: string;
  index: number;
  frame: number;
  fps: number;
  delay: number;
  wordDelay: number;
  style?: React.CSSProperties;
  isHighlighted?: boolean;
  highlightColor?: string;
}> = ({ word, index, frame, fps, delay, wordDelay, style, isHighlighted, highlightColor }) => {
  const wordStartFrame = delay + index * wordDelay;
  const adjustedFrame = Math.max(0, frame - wordStartFrame);

  const springValue = spring({
    frame: adjustedFrame,
    fps,
    config: springs.smooth,
  });

  const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(springValue, [0, 1], [30, 0]);
  const scale = interpolate(springValue, [0, 1], [0.9, 1]);

  // Highlight wipe animation
  const highlightProgress = isHighlighted
    ? spring({
        frame: adjustedFrame,
        fps,
        config: springs.smooth,
        delay: 8,
        durationInFrames: 18,
      })
    : 0;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        marginRight: "0.25em",
        ...style,
      }}
    >
      {/* Highlight background */}
      {isHighlighted && (
        <span
          style={{
            position: "absolute",
            left: -4,
            right: -4,
            top: "50%",
            height: "1.1em",
            transform: `translateY(-50%) scaleX(${highlightProgress})`,
            transformOrigin: "left center",
            backgroundColor: highlightColor || theme.colors.primary,
            opacity: 0.2,
            borderRadius: "0.15em",
            zIndex: 0,
          }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
    </span>
  );
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  style,
  animationType = "fadeUp",
  highlightWord,
  highlightColor,
  charDelay = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delay);

  const getAnimation = () => {
    switch (animationType) {
      case "fadeUp": {
        const springValue = spring({
          frame: adjustedFrame,
          fps,
          config: springs.smooth,
        });
        const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
          easing: easings.easeOut,
        });
        const translateY = interpolate(springValue, [0, 1], [30, 0]);
        return {
          opacity,
          transform: `translateY(${translateY}px)`,
        };
      }
      case "fadeIn": {
        const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
          extrapolateRight: "clamp",
          easing: easings.easeOut,
        });
        return { opacity };
      }
      case "scale": {
        const scale = spring({
          frame: adjustedFrame,
          fps,
          config: springs.bouncy,
        });
        const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
          extrapolateRight: "clamp",
        });
        return {
          opacity,
          transform: `scale(${scale})`,
        };
      }
      case "typewriter": {
        const charsToShow = Math.floor(
          interpolate(adjustedFrame, [0, text.length * 2], [0, text.length], {
            extrapolateRight: "clamp",
          })
        );
        return {
          opacity: 1,
          text: text.slice(0, charsToShow),
          showCursor: true,
        };
      }
      case "glowReveal": {
        const springValue = spring({
          frame: adjustedFrame,
          fps,
          config: springs.smooth,
        });
        const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(springValue, [0, 1], [40, 0]);
        const glowOpacity = interpolate(adjustedFrame, [10, 30, 60], [0, 0.6, 0.3], {
          extrapolateRight: "clamp",
        });
        return {
          opacity,
          transform: `translateY(${translateY}px)`,
          textShadow: `0 0 40px ${theme.colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}`,
        };
      }
      case "charReveal":
      case "wordReveal":
        return {}; // Handled by child components
      default:
        return {};
    }
  };

  // Character reveal animation
  if (animationType === "charReveal") {
    const chars = text.split("");
    return (
      <div
        style={{
          fontFamily: theme.fonts.heading,
          color: theme.colors.textPrimary,
          ...style,
        }}
      >
        {chars.map((char, i) => (
          <AnimatedChar
            key={i}
            char={char}
            index={i}
            frame={frame}
            fps={fps}
            delay={delay}
            charDelay={charDelay}
            style={style}
          />
        ))}
      </div>
    );
  }

  // Word reveal animation
  if (animationType === "wordReveal") {
    const words = text.split(" ");
    return (
      <div
        style={{
          fontFamily: theme.fonts.heading,
          color: theme.colors.textPrimary,
          ...style,
        }}
      >
        {words.map((word, i) => (
          <AnimatedWord
            key={i}
            word={word}
            index={i}
            frame={frame}
            fps={fps}
            delay={delay}
            wordDelay={8}
            style={style}
            isHighlighted={highlightWord ? word.toLowerCase().includes(highlightWord.toLowerCase()) : false}
            highlightColor={highlightColor}
          />
        ))}
      </div>
    );
  }

  // Typewriter with cursor
  if (animationType === "typewriter") {
    const animation = getAnimation() as { text?: string; showCursor?: boolean };
    const cursorOpacity = interpolate(
      frame % 30,
      [0, 15, 30],
      [1, 0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return (
      <div
        style={{
          fontFamily: theme.fonts.heading,
          color: theme.colors.textPrimary,
          ...style,
        }}
      >
        <span>{animation.text}</span>
        {animation.showCursor && (
          <span style={{ opacity: cursorOpacity }}>|</span>
        )}
      </div>
    );
  }

  const animation = getAnimation();

  return (
    <div
      style={{
        fontFamily: theme.fonts.heading,
        color: theme.colors.textPrimary,
        ...style,
        ...animation,
      }}
    >
      {text}
    </div>
  );
};
