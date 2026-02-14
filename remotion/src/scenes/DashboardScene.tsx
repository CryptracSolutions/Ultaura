import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CountingNumber } from "../components/CountingNumber";
import { FakeCursor } from "../components/FakeCursor";
import { MoodChart } from "../components/MoodChart";
import { ProgressBarAnimated } from "../components/ProgressBarAnimated";
import { ShiftingGradientBg } from "../components/ShiftingGradientBg";
import { StatCard } from "../components/StatCard";
import { theme } from "../theme";
import type { SceneText } from "../types";

type DashboardSceneProps = {
  sceneText: SceneText;
};

export const DashboardScene: React.FC<DashboardSceneProps> = ({
  sceneText,
}) => {
  const frame = useCurrentFrame();

  // Title fade in
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleTranslateY = interpolate(frame, [10, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Staggered card fade-outs
  const card3Opacity = interpolate(frame, [220, 250], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const card2Opacity = interpolate(frame, [235, 265], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const card1Opacity = interpolate(frame, [250, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress bar fade-out with card 3
  const progressOpacity = interpolate(frame, [220, 250], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title fade-out
  const titleExitOpacity = interpolate(frame, [250, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing wellness dot
  const dotOpacity = 0.7 + Math.sin(frame * 0.2) * 0.3;

  // Progress bar label opacity
  const progressLabelOpacity = interpolate(frame, [80, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <ShiftingGradientBg duration={316} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          paddingTop: 100,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 42,
            color: theme.colors.white,
            textAlign: "center",
            fontWeight: 700,
            fontFamily: theme.fonts.manrope,
            opacity: titleOpacity * titleExitOpacity,
            transform: `translateY(${titleTranslateY}px)`,
            marginBottom: 10,
          }}
        >
          {sceneText.dashboardTitle}
        </div>

        {/* Card 1 — Mood */}
        <div style={{ opacity: card1Opacity }}>
          <StatCard
            title={sceneText.dashboardLabels.mood}
            delay={20}
            width={900}
          >
            <MoodChart delay={30} width={850} height={180} />
          </StatCard>
        </div>

        {/* Card 2 — Duration */}
        <div style={{ opacity: card2Opacity }}>
          <StatCard
            title={sceneText.dashboardLabels.duration}
            delay={35}
            width={900}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
              }}
            >
              <CountingNumber
                from={0}
                to={parseInt(sceneText.dashboardValues.durationNumber, 10)}
                delay={45}
                duration={30}
                suffix={sceneText.dashboardValues.durationSuffix}
                fontSize={48}
                color={theme.colors.white}
              />
            </div>
          </StatCard>
        </div>

        {/* Card 3 — Wellness */}
        <div style={{ opacity: card3Opacity }}>
          <StatCard
            title={sceneText.dashboardLabels.wellness}
            delay={50}
            width={900}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  opacity: dotOpacity,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: 32,
                  color: theme.colors.white,
                  fontWeight: 600,
                  marginLeft: 12,
                  fontFamily: theme.fonts.manrope,
                }}
              >
                {sceneText.dashboardValues.wellnessText}
              </div>
            </div>
          </StatCard>
        </div>

        {/* Progress bar section */}
        <div
          style={{
            opacity: progressOpacity * progressLabelOpacity,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: 900,
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: "#A8A29E",
                fontFamily: theme.fonts.manrope,
              }}
            >
              Monthly Minutes Used
            </div>
            <div
              style={{
                fontSize: 16,
                color: theme.colors.white,
                fontFamily: theme.fonts.manrope,
              }}
            >
              67%
            </div>
          </div>
          <ProgressBarAnimated
            targetPercent={67}
            delay={80}
            duration={45}
            width={900}
            height={16}
          />
        </div>
      </div>

      {/* FakeCursor overlay */}
      <FakeCursor
        waypoints={[
          { x: 900, y: 1600, frame: 80 },
          { x: 540, y: 500, frame: 95, action: "hover" },
          { x: 540, y: 750, frame: 110, action: "hover" },
          { x: 600, y: 1100, frame: 130 },
        ]}
        delay={0}
      />
    </AbsoluteFill>
  );
};
