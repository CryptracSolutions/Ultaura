import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GradientOrb } from "../components/GradientOrb";
import { OrbitIcon } from "../components/OrbitIcon";
import type { SceneText } from "../types";

type UserBenefitsSceneProps = {
  sceneText: SceneText;
};

const ICONS = ["🔔", "📅", "📊", "🛡️"];
const ICON_POSITIONS = [
  { finalX: 540, finalY: 550 },
  { finalX: 800, finalY: 850 },
  { finalX: 540, finalY: 1150 },
  { finalX: 280, finalY: 850 },
];
const START_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const ICON_DELAYS = [30, 45, 60, 75];

export const UserBenefitsScene: React.FC<UserBenefitsSceneProps> = ({
  sceneText,
}) => {
  const frame = useCurrentFrame();

  // Center text animation
  const centerOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const centerY = interpolate(frame, [15, 35], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out everything
  const fadeOut = interpolate(frame, [250, 300], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.darkBg }}>
      <div style={{ opacity: fadeOut }}>
        <GradientOrb size={800} />

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: 60,
            right: 60,
            textAlign: "center",
            opacity: centerOpacity,
            transform: `translateY(${centerY}px)`,
          }}
        >
          <span
            style={{
              fontSize: 36,
              color: theme.colors.white,
              fontWeight: 700,
              fontFamily: theme.fonts.manrope,
            }}
          >
            {sceneText.benefitCenter}
          </span>
        </div>

        {/* Orbit Icons */}
        {ICONS.map((emoji, i) => (
          <OrbitIcon
            key={i}
            icon={
              <span style={{ fontSize: 36, textAlign: "center" }}>{emoji}</span>
            }
            orbitRadius={250}
            startAngle={START_ANGLES[i]}
            finalX={ICON_POSITIONS[i].finalX}
            finalY={ICON_POSITIONS[i].finalY}
            delay={ICON_DELAYS[i]}
            size={80}
          />
        ))}

        {/* Benefit labels */}
        {sceneText.benefitNames.map((name, i) => {
          const labelOpacity = interpolate(
            frame,
            [90 + i * 15, 110 + i * 15],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          return (
            <div
              key={`label-${i}`}
              style={{
                position: "absolute",
                left: ICON_POSITIONS[i].finalX - 100,
                top: ICON_POSITIONS[i].finalY + 60,
                width: 200,
                textAlign: "center",
                opacity: labelOpacity,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  color: theme.colors.stone200,
                  fontWeight: 500,
                  fontFamily: theme.fonts.manrope,
                }}
              >
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
