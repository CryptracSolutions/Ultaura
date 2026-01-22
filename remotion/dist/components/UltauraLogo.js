import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";
export const UltauraLogo = ({ delay = 0, size = 120, showWordmark = true, animated = true, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const adjustedFrame = Math.max(0, frame - delay);
    const scale = animated
        ? spring({
            frame: adjustedFrame,
            fps,
            config: { damping: 12, stiffness: 100 },
        })
        : 1;
    const opacity = animated
        ? interpolate(adjustedFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" })
        : 1;
    const wordmarkOpacity = animated
        ? interpolate(adjustedFrame, [15, 30], [0, 1], { extrapolateRight: "clamp" })
        : 1;
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            opacity,
        }, children: [_jsx("div", { style: {
                    width: size,
                    height: size,
                    transform: `scale(${scale})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }, children: _jsxs("svg", { width: size, height: size, viewBox: "0 0 120 120", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("circle", { cx: "60", cy: "60", r: "55", fill: `${theme.colors.primary}15` }), _jsx("circle", { cx: "60", cy: "60", r: "45", fill: theme.colors.primary }), _jsx("circle", { cx: "60", cy: "60", r: "35", fill: theme.colors.primaryLight, opacity: 0.3 }), _jsxs("g", { fill: "white", children: [_jsx("rect", { x: "35", y: "50", width: "6", height: "20", rx: "3" }), _jsx("rect", { x: "47", y: "40", width: "6", height: "40", rx: "3" }), _jsx("rect", { x: "57", y: "35", width: "6", height: "50", rx: "3" }), _jsx("rect", { x: "67", y: "40", width: "6", height: "40", rx: "3" }), _jsx("rect", { x: "79", y: "50", width: "6", height: "20", rx: "3" })] })] }) }), showWordmark && (_jsx("div", { style: {
                    fontFamily: theme.fonts.heading,
                    fontSize: size * 0.5,
                    fontWeight: 700,
                    color: theme.colors.textPrimary,
                    letterSpacing: 2,
                    opacity: wordmarkOpacity,
                }, children: "ULTAURA" }))] }));
};
