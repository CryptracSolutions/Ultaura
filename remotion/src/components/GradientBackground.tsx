import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

interface GradientBackgroundProps {
  variant?: "default" | "radial" | "mesh";
  animated?: boolean;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  variant = "default",
  animated = true,
}) => {
  const frame = useCurrentFrame();

  const gradientPosition = animated
    ? interpolate(frame % 300, [0, 150, 300], [0, 100, 0])
    : 50;

  const getBackground = () => {
    switch (variant) {
      case "radial":
        return `radial-gradient(ellipse at 50% ${gradientPosition}%, ${theme.colors.primaryDark}22 0%, ${theme.colors.background} 70%)`;
      case "mesh":
        return `
          radial-gradient(at 20% 30%, ${theme.colors.primary}15 0%, transparent 50%),
          radial-gradient(at 80% 70%, ${theme.colors.primaryDark}15 0%, transparent 50%),
          ${theme.colors.background}
        `;
      default:
        return `linear-gradient(180deg, ${theme.colors.background} 0%, ${theme.colors.backgroundLight} 100%)`;
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: getBackground(),
      }}
    />
  );
};
