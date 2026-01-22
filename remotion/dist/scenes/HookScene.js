import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs, easings } from "../theme";
import { GradientBackground, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
export const HookScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Phone ring animation with spring
    const ringSpring = spring({
        frame: frame % 30,
        fps,
        config: springs.bouncy,
    });
    // Rotation wobble
    const wobble = interpolate(Math.sin(frame * 0.5), [-1, 1], [-8, 8]);
    // Ripple effects - staggered
    const ripple1Progress = (frame % 60) / 60;
    const ripple2Progress = ((frame + 20) % 60) / 60;
    const ripple3Progress = ((frame + 40) % 60) / 60;
    const getRippleStyle = (progress) => ({
        scale: interpolate(progress, [0, 1], [0.8, 2.5]),
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.5, 0]),
    });
    const ripple1 = getRippleStyle(ripple1Progress);
    const ripple2 = getRippleStyle(ripple2Progress);
    const ripple3 = getRippleStyle(ripple3Progress);
    // Phone entrance
    const phoneEntrance = spring({
        frame,
        fps,
        config: springs.heavy,
    });
    const phoneOpacity = interpolate(frame, [0, 25], [0, 1], {
        extrapolateRight: "clamp",
        easing: easings.easeOut,
    });
    const phoneScale = interpolate(phoneEntrance, [0, 1], [0.5, 1]);
    // Glow pulse
    const glowIntensity = interpolate(Math.sin(frame * 0.1), [-1, 1], [30, 80]);
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "aurora" }), children: [_jsx(ContentArea, { children: _jsxs("div", { style: {
                        position: "relative",
                        width: 240,
                        height: 240,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: phoneOpacity,
                        transform: `scale(${phoneScale})`,
                    }, children: [[ripple1, ripple2, ripple3].map((ripple, i) => (_jsx("div", { style: {
                                position: "absolute",
                                width: 200,
                                height: 200,
                                borderRadius: "50%",
                                border: `${3 - i}px solid ${theme.colors.primary}`,
                                transform: `scale(${ripple.scale})`,
                                opacity: ripple.opacity,
                            } }, i))), _jsx("div", { style: {
                                position: "absolute",
                                width: 180,
                                height: 180,
                                borderRadius: "50%",
                                background: `radial-gradient(circle, ${theme.colors.primary}20 0%, transparent 70%)`,
                                filter: `blur(20px)`,
                                opacity: interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.7]),
                            } }), _jsx("div", { style: {
                                width: 130,
                                height: 130,
                                borderRadius: "50%",
                                background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transform: `scale(${ringSpring}) rotate(${wobble}deg)`,
                                boxShadow: `
                0 0 ${glowIntensity}px ${theme.colors.primary}60,
                0 10px 30px rgba(0, 0, 0, 0.3),
                inset 0 2px 0 rgba(255, 255, 255, 0.2)
              `,
                            }, children: _jsx("svg", { width: "65", height: "65", viewBox: "0 0 24 24", fill: "white", children: _jsx("path", { d: "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" }) }) })] }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 40, layout: "none", children: _jsx(AnimatedText, { text: "What if your loved one", style: {
                                fontSize: 48,
                                fontWeight: 600,
                                lineHeight: 1.3,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 70, layout: "none", children: _jsx(AnimatedText, { text: "never felt alone?", style: {
                                fontSize: 48,
                                fontWeight: 700,
                                color: theme.colors.primary,
                                lineHeight: 1.3,
                                marginTop: 10,
                            }, animationType: "glowReveal", highlightWord: "alone" }) })] })] }));
};
