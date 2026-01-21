import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { theme } from "../theme";

interface AnimatedTextProps {
  text: string;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
  animationType?: "fadeUp" | "fadeIn" | "typewriter" | "scale";
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  style,
  animationType = "fadeUp",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delay);

  const getAnimation = () => {
    switch (animationType) {
      case "fadeUp": {
        const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(adjustedFrame, [0, 15], [30, 0], {
          extrapolateRight: "clamp",
        });
        return {
          opacity,
          transform: `translateY(${translateY}px)`,
        };
      }
      case "fadeIn": {
        const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
          extrapolateRight: "clamp",
        });
        return { opacity };
      }
      case "scale": {
        const scale = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 12, stiffness: 100 },
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
          clipPath: `inset(0 ${100 - (charsToShow / text.length) * 100}% 0 0)`,
        };
      }
      default:
        return {};
    }
  };

  return (
    <div
      style={{
        fontFamily: theme.fonts.heading,
        color: theme.colors.textPrimary,
        ...style,
        ...getAnimation(),
      }}
    >
      {text}
    </div>
  );
};
