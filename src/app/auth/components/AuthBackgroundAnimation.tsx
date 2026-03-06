'use client';

import { motion, useReducedMotion } from 'framer-motion';

const LINE_COUNT = 24;

const KEY_POINTS: Array<[number, number, number]> = [
  [-140, 670, 9.0],
  [60, 610, 7.0],
  [220, 460, 3.2],
  [350, 395, 0.8],
  [480, 420, 0.2],
  [580, 415, 0.8],
  [720, 320, 3.5],
  [870, 200, 6.5],
  [1140, 130, 7.5],
];

function smoothPath(points: Array<{ x: number; y: number }>): string {
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function createWavePath(index: number): string {
  const offset = (index / (LINE_COUNT - 1) - 0.5) * 2;
  const halfRange = (LINE_COUNT - 1) / 2;
  const points = KEY_POINTS.map(([x, baseY, spread]) => ({
    x,
    y: baseY + offset * spread * halfRange,
  }));
  return smoothPath(points);
}

const wavePaths = Array.from({ length: LINE_COUNT }, (_, i) => createWavePath(i));

function WaveField({ animated }: { animated: boolean }) {
  const Group = animated ? motion.g : 'g';
  const Svg = animated ? motion.svg : 'svg';

  const svgProps = animated
    ? {
        animate: { x: [0, 6, -4, 0], y: [0, -5, 3, 0] },
        transition: {
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      }
    : {};

  const groupProps = animated
    ? {
        animate: { x: [0, 4, -3, 0], y: [0, -3, 2, 0] },
        transition: {
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      }
    : {};

  return (
    <Svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1000 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      {...svgProps}
    >
      <defs>
        <linearGradient
          id="auth-wave-gradient"
          x1="0"
          y1="650"
          x2="1000"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(192,38,211,0.95)" />
          <stop offset="32%" stopColor="rgba(147,51,234,0.92)" />
          <stop offset="52%" stopColor="rgba(99,102,241,0.88)" />
          <stop offset="74%" stopColor="rgba(20,184,166,0.90)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0.96)" />
        </linearGradient>
        <filter id="wave-glow">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <Group {...groupProps}>
        <g filter="url(#wave-glow)">
          {wavePaths.map((d, i) => (
            <path
              key={`glow-${i}`}
              d={d}
              fill="none"
              stroke="url(#auth-wave-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity={0.12 + (i / (LINE_COUNT - 1)) * 0.18}
            />
          ))}
        </g>

        {wavePaths.map((d, i) => (
          <path
            key={`line-${i}`}
            d={d}
            fill="none"
            stroke="url(#auth-wave-gradient)"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity={0.35 + (i / (LINE_COUNT - 1)) * 0.55}
          />
        ))}
      </Group>
    </Svg>
  );
}

function StaticAmbientSurface() {
  return (
    <>
      <div className="absolute inset-0 bg-card" />
      <WaveField animated={false} />
    </>
  );
}

export function AuthBackgroundAnimation() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <StaticAmbientSurface />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-card" />
      <WaveField animated />
    </div>
  );
}
