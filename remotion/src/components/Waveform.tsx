import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

interface WaveformProps {
  width?: number;
  height?: number;
  bars?: number;
  color?: string;
  animated?: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({
  width = 200,
  height = 60,
  bars = 12,
  color = theme.colors.primary,
  animated = true,
}) => {
  const frame = useCurrentFrame();

  const barWidth = (width / bars) * 0.6;
  const gap = (width / bars) * 0.4;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: gap,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const animatedHeight = animated
          ? interpolate(
              Math.sin((frame * 0.15) + phase),
              [-1, 1],
              [height * 0.2, height]
            )
          : height * 0.5;

        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: animatedHeight,
              backgroundColor: color,
              borderRadius: barWidth / 2,
              transition: "height 0.1s ease",
            }}
          />
        );
      })}
    </div>
  );
};
