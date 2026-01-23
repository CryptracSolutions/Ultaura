import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface ScreenShakeProps {
  children: React.ReactNode;
  intensity?: number;
  duration?: number;
  trigger?: number;
}

export const ScreenShake: React.FC<ScreenShakeProps> = ({
  children,
  intensity = 3,
  duration = 6,
  trigger = 0,
}) => {
  const frame = useCurrentFrame();

  // Calculate if we're within the shake window
  const shakeFrame = frame - trigger;
  const isShaking = shakeFrame >= 0 && shakeFrame < duration;

  if (!isShaking) {
    return <>{children}</>;
  }

  // Decay the intensity over the duration
  const decayedIntensity = interpolate(
    shakeFrame,
    [0, duration],
    [intensity, 0],
    {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    }
  );

  // Generate pseudo-random shake values based on frame
  // Using sine waves at different frequencies for x and y
  const shakeX =
    Math.sin(shakeFrame * 2.5) * decayedIntensity +
    Math.sin(shakeFrame * 5.3) * decayedIntensity * 0.5;

  const shakeY =
    Math.cos(shakeFrame * 2.8) * decayedIntensity +
    Math.cos(shakeFrame * 4.7) * decayedIntensity * 0.5;

  // Subtle rotation shake
  const rotation = Math.sin(shakeFrame * 3.2) * decayedIntensity * 0.15;

  return (
    <div
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px) rotate(${rotation}deg)`,
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
};
