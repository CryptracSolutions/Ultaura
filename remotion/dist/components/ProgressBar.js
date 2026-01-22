import { jsx as _jsx } from "react/jsx-runtime";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";
export const ProgressBar = ({ height = 4, showAtBottom = true, }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const progress = (frame / durationInFrames) * 100;
    // Fade in at start, fade out at end
    const opacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (_jsx("div", { style: {
            position: "absolute",
            left: 40,
            right: 40,
            [showAtBottom ? "bottom" : "top"]: 50,
            height,
            backgroundColor: `${theme.colors.textMuted}30`,
            borderRadius: height / 2,
            overflow: "hidden",
            opacity,
            zIndex: 100,
        }, children: _jsx("div", { style: {
                width: `${progress}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primaryLight})`,
                borderRadius: height / 2,
                boxShadow: `0 0 10px ${theme.colors.primary}60`,
            } }) }));
};
