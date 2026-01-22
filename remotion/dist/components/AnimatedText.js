import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, useVideoConfig, interpolate, spring, } from "remotion";
import { theme, springs, easings } from "../theme";
// Character animation component for charReveal
const AnimatedChar = ({ char, index, frame, fps, delay, charDelay, style }) => {
    const charStartFrame = delay + index * charDelay;
    const adjustedFrame = Math.max(0, frame - charStartFrame);
    const springValue = spring({
        frame: adjustedFrame,
        fps,
        config: springs.snappy,
    });
    const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
        extrapolateRight: "clamp",
    });
    const translateY = interpolate(springValue, [0, 1], [20, 0]);
    const rotate = interpolate(springValue, [0, 1], [-8, 0]);
    return (_jsx("span", { style: {
            display: "inline-block",
            opacity,
            transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
            whiteSpace: char === " " ? "pre" : "normal",
            ...style,
        }, children: char }));
};
// Word animation component for wordReveal
const AnimatedWord = ({ word, index, frame, fps, delay, wordDelay, style, isHighlighted, highlightColor }) => {
    const wordStartFrame = delay + index * wordDelay;
    const adjustedFrame = Math.max(0, frame - wordStartFrame);
    const springValue = spring({
        frame: adjustedFrame,
        fps,
        config: springs.smooth,
    });
    const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
        extrapolateRight: "clamp",
    });
    const translateY = interpolate(springValue, [0, 1], [30, 0]);
    const scale = interpolate(springValue, [0, 1], [0.9, 1]);
    // Highlight wipe animation
    const highlightProgress = isHighlighted
        ? spring({
            frame: adjustedFrame,
            fps,
            config: springs.smooth,
            delay: 8,
            durationInFrames: 18,
        })
        : 0;
    return (_jsxs("span", { style: {
            display: "inline-block",
            position: "relative",
            opacity,
            transform: `translateY(${translateY}px) scale(${scale})`,
            marginRight: "0.25em",
            ...style,
        }, children: [isHighlighted && (_jsx("span", { style: {
                    position: "absolute",
                    left: -4,
                    right: -4,
                    top: "50%",
                    height: "1.1em",
                    transform: `translateY(-50%) scaleX(${highlightProgress})`,
                    transformOrigin: "left center",
                    backgroundColor: highlightColor || theme.colors.primary,
                    opacity: 0.2,
                    borderRadius: "0.15em",
                    zIndex: 0,
                } })), _jsx("span", { style: { position: "relative", zIndex: 1 }, children: word })] }));
};
export const AnimatedText = ({ text, delay = 0, style, animationType = "fadeUp", highlightWord, highlightColor, charDelay = 2, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const adjustedFrame = Math.max(0, frame - delay);
    const getAnimation = () => {
        switch (animationType) {
            case "fadeUp": {
                const springValue = spring({
                    frame: adjustedFrame,
                    fps,
                    config: springs.smooth,
                });
                const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
                    extrapolateRight: "clamp",
                    easing: easings.easeOut,
                });
                const translateY = interpolate(springValue, [0, 1], [30, 0]);
                return {
                    opacity,
                    transform: `translateY(${translateY}px)`,
                };
            }
            case "fadeIn": {
                const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
                    extrapolateRight: "clamp",
                    easing: easings.easeOut,
                });
                return { opacity };
            }
            case "scale": {
                const scale = spring({
                    frame: adjustedFrame,
                    fps,
                    config: springs.bouncy,
                });
                const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
                    extrapolateRight: "clamp",
                });
                return {
                    opacity,
                    transform: `scale(${scale})`,
                };
            }
            case "typewriter": {
                const charsToShow = Math.floor(interpolate(adjustedFrame, [0, text.length * 2], [0, text.length], {
                    extrapolateRight: "clamp",
                }));
                return {
                    opacity: 1,
                    text: text.slice(0, charsToShow),
                    showCursor: true,
                };
            }
            case "glowReveal": {
                const springValue = spring({
                    frame: adjustedFrame,
                    fps,
                    config: springs.smooth,
                });
                const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
                    extrapolateRight: "clamp",
                });
                const translateY = interpolate(springValue, [0, 1], [40, 0]);
                const glowOpacity = interpolate(adjustedFrame, [10, 30, 60], [0, 0.6, 0.3], {
                    extrapolateRight: "clamp",
                });
                return {
                    opacity,
                    transform: `translateY(${translateY}px)`,
                    textShadow: `0 0 40px ${theme.colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}`,
                };
            }
            case "charReveal":
            case "wordReveal":
                return {}; // Handled by child components
            default:
                return {};
        }
    };
    // Character reveal animation
    if (animationType === "charReveal") {
        const chars = text.split("");
        return (_jsx("div", { style: {
                fontFamily: theme.fonts.heading,
                color: theme.colors.textPrimary,
                ...style,
            }, children: chars.map((char, i) => (_jsx(AnimatedChar, { char: char, index: i, frame: frame, fps: fps, delay: delay, charDelay: charDelay, style: style }, i))) }));
    }
    // Word reveal animation
    if (animationType === "wordReveal") {
        const words = text.split(" ");
        return (_jsx("div", { style: {
                fontFamily: theme.fonts.heading,
                color: theme.colors.textPrimary,
                ...style,
            }, children: words.map((word, i) => (_jsx(AnimatedWord, { word: word, index: i, frame: frame, fps: fps, delay: delay, wordDelay: 8, style: style, isHighlighted: highlightWord ? word.toLowerCase().includes(highlightWord.toLowerCase()) : false, highlightColor: highlightColor }, i))) }));
    }
    // Typewriter with cursor
    if (animationType === "typewriter") {
        const animation = getAnimation();
        const cursorOpacity = interpolate(frame % 30, [0, 15, 30], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (_jsxs("div", { style: {
                fontFamily: theme.fonts.heading,
                color: theme.colors.textPrimary,
                ...style,
            }, children: [_jsx("span", { children: animation.text }), animation.showCursor && (_jsx("span", { style: { opacity: cursorOpacity }, children: "|" }))] }));
    }
    const animation = getAnimation();
    return (_jsx("div", { style: {
            fontFamily: theme.fonts.heading,
            color: theme.colors.textPrimary,
            ...style,
            ...animation,
        }, children: text }));
};
