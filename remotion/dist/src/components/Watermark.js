import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, Img, staticFile } from "remotion";
import { theme } from "../theme";
export const Watermark = ({ position = "top-right", }) => {
    const frame = useCurrentFrame();
    // Subtle pulse animation
    const pulseOpacity = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.5, 0.7]);
    // Fade in
    const fadeIn = interpolate(frame, [0, 45], [0, 1], {
        extrapolateRight: "clamp",
    });
    const positionStyles = {
        "top-left": { top: 60, left: 40 },
        "top-right": { top: 60, right: 40 },
        "bottom-left": { bottom: 80, left: 40 },
        "bottom-right": { bottom: 80, right: 40 },
    };
    return (_jsxs("div", { style: {
            position: "absolute",
            ...positionStyles[position],
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: fadeIn * pulseOpacity,
            zIndex: 100,
        }, children: [_jsx(Img, { src: staticFile("ultaura-logo.png"), style: {
                    width: 32,
                    height: 32,
                    objectFit: "contain",
                } }), _jsx("span", { style: {
                    fontFamily: theme.fonts.heading,
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    letterSpacing: 1,
                }, children: "ULTAURA" })] }));
};
