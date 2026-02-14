import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

type ShiftingGradientBgProps = {
  duration: number;
};

export const ShiftingGradientBg: React.FC<ShiftingGradientBgProps> = ({
  duration,
}) => {
  const frame = useCurrentFrame();

  const r1 = Math.round(
    interpolate(frame, [0, duration], [0x1c, 0x1e], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const g1 = Math.round(
    interpolate(frame, [0, duration], [0x19, 0x18], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const b1 = Math.round(
    interpolate(frame, [0, duration], [0x17, 0x20], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const r2 = Math.round(
    interpolate(frame, [0, duration], [0x0c, 0x0a], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const g2 = Math.round(
    interpolate(frame, [0, duration], [0x0a, 0x0c], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const b2 = Math.round(
    interpolate(frame, [0, duration], [0x09, 0x12], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const angle = interpolate(frame, [0, duration], [135, 180], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const background = `linear-gradient(${angle}deg, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}))`;

  return <AbsoluteFill style={{ background }} />;
};
