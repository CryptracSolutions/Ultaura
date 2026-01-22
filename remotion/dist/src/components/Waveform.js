import { jsx as _jsx } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, springs } from "../theme";
export const Waveform = ({ width = 200, height = 60, bars = 12, color = theme.colors.primary, animated = true, variant = "gradient", entranceDelay = 0, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const barWidth = (width / bars) * 0.6;
    const gap = (width / bars) * 0.4;
    // Entrance animation
    const entranceSpring = spring({
        frame: Math.max(0, frame - entranceDelay),
        fps,
        config: springs.smooth,
    });
    const containerOpacity = interpolate(Math.max(0, frame - entranceDelay), [0, 15], [0, 1], { extrapolateRight: "clamp" });
    return (_jsx("div", { style: {
            width,
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: gap,
            opacity: containerOpacity,
            transform: `scale(${interpolate(entranceSpring, [0, 1], [0.9, 1])})`,
        }, children: Array.from({ length: bars }).map((_, i) => {
            const phase = (i / bars) * Math.PI * 2;
            const secondaryPhase = ((i + bars / 2) / bars) * Math.PI * 2;
            // Multi-layered wave for more organic motion
            const wave1 = Math.sin((frame * 0.12) + phase);
            const wave2 = Math.sin((frame * 0.08) + secondaryPhase) * 0.5;
            const combinedWave = (wave1 + wave2) / 1.5;
            const animatedHeight = animated
                ? interpolate(combinedWave, [-1, 1], [height * 0.15, height * 0.95])
                : height * 0.5;
            // Staggered entrance for each bar
            const barEntranceDelay = entranceDelay + i * 2;
            const barEntrance = spring({
                frame: Math.max(0, frame - barEntranceDelay),
                fps,
                config: springs.snappy,
            });
            const barScale = interpolate(barEntrance, [0, 1], [0, 1]);
            // Glow intensity based on height
            const glowIntensity = interpolate(animatedHeight, [height * 0.15, height * 0.95], [0.2, 0.8]);
            const getBarStyle = () => {
                switch (variant) {
                    case "glow":
                        return {
                            background: color,
                            boxShadow: `0 0 ${10 * glowIntensity}px ${color}${Math.round(glowIntensity * 100).toString(16).padStart(2, '0')}`,
                        };
                    case "gradient":
                        return {
                            background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${color} 50%, ${theme.colors.primaryDark} 100%)`,
                            boxShadow: `0 0 ${6 * glowIntensity}px ${color}40`,
                        };
                    default:
                        return {
                            background: color,
                        };
                }
            };
            return (_jsx("div", { style: {
                    width: barWidth,
                    height: animatedHeight * barScale,
                    borderRadius: barWidth / 2,
                    transform: `scaleY(${barScale})`,
                    transformOrigin: "center",
                    ...getBarStyle(),
                } }, i));
        }) }));
};
