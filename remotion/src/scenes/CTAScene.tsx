import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";
import { LogoReveal } from "../components/LogoReveal";
import { PulsingButton } from "../components/PulsingButton";
import type { SceneText } from "../types";

const InlineCursor: React.FC<{
  waypoints: { x: number; y: number; frame: number; action?: "click" }[];
  delay?: number;
}> = ({ waypoints, delay = 0 }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - delay);

  // Find current segment
  let x = waypoints[0].x;
  let y = waypoints[0].y;
  let clicking = false;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (localFrame >= from.frame && localFrame <= to.frame) {
      const progress = interpolate(
        localFrame,
        [from.frame, to.frame],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      x = interpolate(progress, [0, 1], [from.x, to.x], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      y = interpolate(progress, [0, 1], [from.y, to.y], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      break;
    }
    if (localFrame > to.frame) {
      x = to.x;
      y = to.y;
      if (to.action === "click" && localFrame - to.frame < 10) {
        clicking = true;
      }
    }
  }

  const opacity = interpolate(localFrame, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorScale = clicking ? 0.8 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x - 10,
        top: y - 10,
        width: 20,
        height: 20,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.9)",
        boxShadow: "0 0 10px rgba(255,255,255,0.5)",
        opacity,
        transform: `scale(${cursorScale})`,
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
};

type CTASceneProps = {
  sceneText: SceneText;
};

const BADGES = [
  { src: "badges/1-hipaa-compliant.png", delay: 115 },
  { src: "badges/2-soc2-compliant.png", delay: 125 },
  { src: "badges/3-aarp-logo.png", delay: 135 },
];

export const CTAScene: React.FC<CTASceneProps> = ({ sceneText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Brand name animation
  const brandOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brandY = interpolate(frame, [10, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline animation
  const taglineOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Price animation
  const priceOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtext animation
  const subtextOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // URL animation
  const urlOpacity = interpolate(frame, [150, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.colors.stone900}, ${theme.colors.stone950})`,
      }}
    >
      {/* Logo */}
      <div style={{ position: "absolute", top: 180, left: 0, right: 0, height: 300 }}>
        <Sequence from={0} premountFor={15}>
          <LogoReveal />
        </Sequence>
      </div>

      {/* Brand name */}
      <div
        style={{
          position: "absolute",
          top: 500,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 48,
            color: theme.colors.white,
            fontWeight: 700,
            fontFamily: theme.fonts.manrope,
          }}
        >
          {sceneText.brandName}
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          top: 580,
          left: 60,
          right: 60,
          textAlign: "center",
          opacity: taglineOpacity,
        }}
      >
        <span
          style={{
            fontSize: 30,
            color: theme.colors.stone200,
            fontWeight: 500,
            fontFamily: theme.fonts.manrope,
          }}
        >
          {sceneText.ctaTagline}
        </span>
      </div>

      {/* Pulsing Button */}
      <div
        style={{
          position: "absolute",
          top: 700,
          left: 140,
          right: 140,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <PulsingButton
          text={sceneText.ctaButton}
          delay={45}
          clickFrame={85}
          width={800}
          height={80}
        />
      </div>

      {/* Fake Cursor */}
      <InlineCursor
        waypoints={[
          { x: 900, y: 1200, frame: 0 },
          { x: 540, y: 740, frame: 10, action: "click" },
        ]}
        delay={75}
      />

      {/* Price */}
      <div
        style={{
          position: "absolute",
          top: 830,
          left: 60,
          right: 60,
          textAlign: "center",
        }}
      >
        <div style={{ opacity: priceOpacity }}>
          <span
            style={{
              fontSize: 22,
              color: theme.colors.white,
              fontWeight: 600,
              fontFamily: theme.fonts.manrope,
            }}
          >
            {sceneText.ctaPrice}
          </span>
        </div>
        <div style={{ opacity: subtextOpacity, marginTop: 8 }}>
          <span
            style={{
              fontSize: 18,
              color: "#A8A29E",
              fontFamily: theme.fonts.manrope,
            }}
          >
            {sceneText.ctaSubtext}
          </span>
        </div>
      </div>

      {/* Trust badges */}
      <div
        style={{
          position: "absolute",
          top: 920,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 40,
        }}
      >
        {BADGES.map((badge, i) => {
          const badgeSpring = spring({
            frame: Math.max(0, frame - badge.delay),
            fps,
            config: { damping: 12 },
          });
          const badgeY = interpolate(badgeSpring, [0, 1], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <Img
              key={i}
              src={staticFile(badge.src)}
              style={{
                height: 48,
                opacity: 0.7 * badgeSpring,
                transform: `translateY(${badgeY}px)`,
              }}
            />
          );
        })}
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          top: 1050,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: urlOpacity,
        }}
      >
        <span
          style={{
            fontSize: 20,
            color: "#A8A29E",
            fontWeight: 500,
            fontFamily: theme.fonts.manrope,
          }}
        >
          {sceneText.ctaUrl}
        </span>
      </div>
    </AbsoluteFill>
  );
};
