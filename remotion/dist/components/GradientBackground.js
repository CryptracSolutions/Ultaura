import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { theme, easings } from "../theme";
// Floating particle component
const Particle = ({ index, frame, fps, variant }) => {
    // Create deterministic but varied positions using golden ratio
    const goldenRatio = 1.618033988749895;
    const x = ((index * goldenRatio * 137.5) % 100);
    const y = ((index * goldenRatio * 73.3 + 50) % 100);
    const size = 2 + (index % 5) * 1.5;
    const delay = index * 12;
    const speed = 0.3 + (index % 3) * 0.2;
    const duration = 180 + (index % 60);
    const adjustedFrame = Math.max(0, frame - delay);
    const cycleFrame = adjustedFrame % duration;
    // Smooth floating motion
    const floatY = interpolate(cycleFrame, [0, duration * 0.5, duration], [0, -60 - (index % 30), 0], { easing: easings.smooth });
    const floatX = Math.sin((adjustedFrame * speed * 0.02) + index) * 15;
    // Fade in and out
    const opacity = interpolate(cycleFrame, [0, duration * 0.15, duration * 0.7, duration], [0, 0.4 + (index % 3) * 0.1, 0.4 + (index % 3) * 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    // Glow pulse
    const glowIntensity = interpolate(Math.sin(adjustedFrame * 0.08 + index), [-1, 1], [0.5, 1]);
    const color = variant === "mesh" || variant === "aurora"
        ? theme.colors.primary
        : theme.colors.primaryLight;
    return (_jsx("div", { style: {
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            opacity: opacity * glowIntensity,
            transform: `translate(${floatX}px, ${floatY}px)`,
            boxShadow: `0 0 ${size * 3}px ${color}60`,
            zIndex: 0,
        } }));
};
// Noise overlay using CSS gradient pattern
const NoiseOverlay = ({ opacity = 0.03 }) => {
    return (_jsx("div", { style: {
            position: "absolute",
            inset: 0,
            opacity,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            mixBlendMode: "overlay",
            pointerEvents: "none",
        } }));
};
// Animated glow orbs for depth
const GlowOrb = ({ x, y, size, color, frame, speed = 0.02 }) => {
    const breathe = interpolate(Math.sin(frame * speed), [-1, 1], [0.6, 1]);
    const drift = Math.sin(frame * speed * 0.5) * 20;
    return (_jsx("div", { style: {
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}40 0%, ${color}15 40%, transparent 70%)`,
            transform: `translate(-50%, -50%) translateY(${drift}px) scale(${breathe})`,
            filter: `blur(${size * 0.3}px)`,
            zIndex: 0,
        } }));
};
export const GradientBackground = ({ variant = "default", animated = true, showParticles = true, showNoise = true, particleCount = 20, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const gradientPosition = animated
        ? interpolate(frame % 300, [0, 150, 300], [0, 100, 0], { easing: easings.smooth })
        : 50;
    const getBackground = () => {
        switch (variant) {
            case "radial":
                return `radial-gradient(ellipse at 50% ${gradientPosition}%, ${theme.colors.primaryDark}22 0%, ${theme.colors.background} 70%)`;
            case "mesh":
                return `
          radial-gradient(at 20% 30%, ${theme.colors.primary}18 0%, transparent 50%),
          radial-gradient(at 80% 70%, ${theme.colors.primaryDark}18 0%, transparent 50%),
          radial-gradient(at 50% 50%, ${theme.colors.backgroundLight} 0%, ${theme.colors.background} 100%)
        `;
            case "aurora": {
                const auroraShift1 = interpolate(frame % 400, [0, 200, 400], [20, 80, 20], { easing: easings.smooth });
                const auroraShift2 = interpolate(frame % 500, [0, 250, 500], [70, 30, 70], { easing: easings.smooth });
                return `
          radial-gradient(ellipse at ${auroraShift1}% 20%, ${theme.colors.primary}20 0%, transparent 50%),
          radial-gradient(ellipse at ${auroraShift2}% 60%, ${theme.colors.primaryLight}15 0%, transparent 40%),
          radial-gradient(ellipse at 50% 90%, ${theme.colors.primaryDark}18 0%, transparent 50%),
          linear-gradient(180deg, ${theme.colors.background} 0%, ${theme.colors.backgroundLight} 100%)
        `;
            }
            default:
                return `linear-gradient(180deg, ${theme.colors.background} 0%, ${theme.colors.backgroundLight} 100%)`;
        }
    };
    // Determine glow orb positions based on variant
    const glowOrbs = variant === "mesh" || variant === "aurora" || variant === "radial" ? [
        { x: 25, y: 25, size: 300, color: theme.colors.primary, speed: 0.015 },
        { x: 75, y: 65, size: 250, color: theme.colors.primaryDark, speed: 0.02 },
        { x: 50, y: 85, size: 200, color: theme.colors.primaryLight, speed: 0.025 },
    ] : [];
    return (_jsxs("div", { style: {
            position: "absolute",
            inset: 0,
            background: getBackground(),
            overflow: "hidden",
        }, children: [glowOrbs.map((orb, i) => (_jsx(GlowOrb, { x: orb.x, y: orb.y, size: orb.size, color: orb.color, frame: frame, speed: orb.speed }, i))), showParticles && (_jsx(_Fragment, { children: Array.from({ length: particleCount }).map((_, i) => (_jsx(Particle, { index: i, frame: frame, fps: fps, variant: variant }, i))) })), showNoise && _jsx(NoiseOverlay, { opacity: 0.025 }), _jsx("div", { style: {
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(ellipse at 50% 50%, transparent 0%, ${theme.colors.background}40 100%)`,
                    pointerEvents: "none",
                } })] }));
};
