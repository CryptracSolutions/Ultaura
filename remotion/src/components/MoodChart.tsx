import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type MoodChartProps = {
  delay?: number;
  width?: number;
  height?: number;
};

const DATA_POINTS = [0.3, 0.45, 0.4, 0.65, 0.8];
const PATH_LENGTH = 800;

export const MoodChart: React.FC<MoodChartProps> = ({
  delay = 0,
  width = 800,
  height = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const padding = 20;

  const points = DATA_POINTS.map((val, i) => ({
    x: (i / (DATA_POINTS.length - 1)) * (width - padding * 2) + padding,
    y: (1 - val) * (height - padding * 2) + padding,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const dashOffset = interpolate(frame, [delay, delay + 60], [PATH_LENGTH, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Fill area */}
      <path
        d={fillD}
        fill={theme.colors.primary}
        fillOpacity={0.1}
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={dashOffset}
        stroke="none"
        style={{
          clipPath: `inset(0 ${(dashOffset / PATH_LENGTH) * 100}% 0 0)`,
        }}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={theme.colors.primary}
        strokeWidth={3}
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {points.map((p, i) => {
        const dotDelay = delay + 30 + i * 8;
        if (frame <= dotDelay) return null;
        const scale = spring({
          frame: frame - dotDelay,
          fps,
          config: { damping: 12 },
        });
        return (
          <g key={i} transform={`translate(${p.x}, ${p.y}) scale(${scale}) translate(${-p.x}, ${-p.y})`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={6}
              fill={theme.colors.primary}
            />
          </g>
        );
      })}
    </svg>
  );
};
