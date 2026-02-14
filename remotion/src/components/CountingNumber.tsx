import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type CountingNumberProps = {
  from?: number;
  to: number;
  delay?: number;
  duration?: number;
  suffix?: string;
  fontSize?: number;
  color?: string;
};

export const CountingNumber: React.FC<CountingNumberProps> = ({
  from = 0,
  to,
  delay = 0,
  duration = 30,
  suffix = "",
  fontSize = 48,
  color = theme.colors.white,
}) => {
  const frame = useCurrentFrame();

  const value = Math.round(
    interpolate(frame, [delay, delay + duration], [from, to], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <div
      style={{
        fontSize,
        fontWeight: 700,
        fontFamily: theme.fonts.manrope,
        color,
      }}
    >
      {value}
      {suffix}
    </div>
  );
};
