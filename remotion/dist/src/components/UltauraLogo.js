import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, spring, useVideoConfig, interpolate, Img, staticFile } from "remotion";
import { theme, springs, easings } from "../theme";
export const UltauraLogo = ({ delay = 0, size = 120, showWordmark = true, animated = true, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const adjustedFrame = Math.max(0, frame - delay);
    // Logo entrance with bounce
    const logoSpring = animated
        ? spring({
            frame: adjustedFrame,
            fps,
            config: springs.bouncy,
        })
        : 1;
    const opacity = animated
        ? interpolate(adjustedFrame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
            easing: easings.easeOut,
        })
        : 1;
    // Wordmark entrance (delayed)
    const wordmarkSpring = animated
        ? spring({
            frame: Math.max(0, adjustedFrame - 15),
            fps,
            config: springs.smooth,
        })
        : 1;
    const wordmarkOpacity = animated
        ? interpolate(adjustedFrame, [15, 35], [0, 1], { extrapolateRight: "clamp" })
        : 1;
    // Subtle glow pulse
    const glowIntensity = interpolate(Math.sin(adjustedFrame * 0.06), [-1, 1], [0.3, 0.6]);
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            opacity,
        }, children: [_jsxs("div", { style: {
                    position: "relative",
                    width: size,
                    height: size,
                    transform: `scale(${logoSpring})`,
                }, children: [_jsx("div", { style: {
                            position: "absolute",
                            inset: -20,
                            background: `radial-gradient(circle, ${theme.colors.primary}${Math.round(glowIntensity * 60).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                            filter: "blur(20px)",
                            borderRadius: "50%",
                        } }), _jsx(Img, { src: staticFile("ultaura-logo.png"), style: {
                            width: size,
                            height: size,
                            objectFit: "contain",
                            position: "relative",
                            zIndex: 1,
                            filter: `drop-shadow(0 0 ${20 * glowIntensity}px ${theme.colors.primary}80)`,
                        } })] }), showWordmark && (_jsx("div", { style: {
                    fontFamily: theme.fonts.heading,
                    fontSize: size * 0.4,
                    fontWeight: 700,
                    color: theme.colors.textPrimary,
                    letterSpacing: 3,
                    opacity: wordmarkOpacity,
                    transform: `translateY(${interpolate(wordmarkSpring, [0, 1], [15, 0])}px)`,
                    textShadow: `0 0 ${30 * glowIntensity}px ${theme.colors.primary}40`,
                }, children: "ULTAURA" }))] }));
};
