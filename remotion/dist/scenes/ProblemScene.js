import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs } from "../theme";
import { GradientBackground, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
export const ProblemScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Calendar entrance
    const calendarEntrance = spring({
        frame,
        fps,
        config: springs.smooth,
    });
    // Floating phone icons with improved motion
    const phones = [
        { x: -180, y: -80, delay: 0, rotation: -15 },
        { x: 180, y: -40, delay: 15, rotation: 20 },
        { x: -140, y: 80, delay: 30, rotation: -25 },
        { x: 160, y: 60, delay: 45, rotation: 15 },
        { x: 0, y: -120, delay: 60, rotation: 5 },
    ];
    // Days of the week for calendar
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "default", showParticles: false }), children: [_jsx(ContentArea, { children: _jsxs("div", { style: {
                        position: "relative",
                        width: 340,
                        height: 280,
                    }, children: [_jsxs("div", { style: {
                                width: 340,
                                height: 220,
                                background: theme.colors.backgroundCard,
                                borderRadius: 24,
                                border: `1px solid ${theme.colors.textMuted}25`,
                                opacity: interpolate(calendarEntrance, [0, 1], [0, 0.9]),
                                transform: `scale(${interpolate(calendarEntrance, [0, 1], [0.9, 1])})`,
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
                            }, children: [_jsxs("div", { style: {
                                        padding: 22,
                                        background: theme.colors.backgroundLight,
                                        borderBottom: `1px solid ${theme.colors.textMuted}15`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }, children: [_jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: theme.colors.textMuted, children: _jsx("path", { d: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" }) }), _jsx("div", { style: {
                                                fontFamily: theme.fonts.heading,
                                                fontSize: 18,
                                                fontWeight: 600,
                                                color: theme.colors.textMuted,
                                            }, children: "This Week" })] }), _jsx("div", { style: {
                                        flex: 1,
                                        padding: 20,
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "center",
                                    }, children: days.map((day, i) => {
                                        const dayDelay = 15 + i * 5;
                                        const dayEntrance = spring({
                                            frame: Math.max(0, frame - dayDelay),
                                            fps,
                                            config: springs.snappy,
                                        });
                                        // Empty circle pulse
                                        const emptyPulse = interpolate(Math.sin(frame * 0.04 + i), [-1, 1], [0.3, 0.6]);
                                        return (_jsxs("div", { style: {
                                                flex: 1,
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: 10,
                                                opacity: dayEntrance,
                                                transform: `translateY(${interpolate(dayEntrance, [0, 1], [15, 0])}px)`,
                                            }, children: [_jsx("div", { style: {
                                                        fontFamily: theme.fonts.body,
                                                        fontSize: 13,
                                                        fontWeight: 500,
                                                        color: theme.colors.textMuted,
                                                    }, children: day }), _jsx("div", { style: {
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        border: `2px dashed ${theme.colors.textMuted}`,
                                                        opacity: emptyPulse,
                                                    } })] }, i));
                                    }) })] }), phones.map((phone, i) => {
                            const adjustedFrame = Math.max(0, frame - phone.delay);
                            const phoneSpring = spring({
                                frame: adjustedFrame,
                                fps,
                                config: springs.gentle,
                            });
                            // Floating motion
                            const floatY = interpolate(Math.sin(adjustedFrame * 0.03 + i), [-1, 1], [-8, 8]);
                            const opacity = interpolate(frame, [phone.delay, phone.delay + 20, 160, 180], [0, 0.35, 0.35, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                            return (_jsx("div", { style: {
                                    position: "absolute",
                                    left: `calc(50% + ${phone.x}px)`,
                                    top: `calc(50% + ${phone.y}px)`,
                                    opacity: opacity * phoneSpring,
                                    transform: `
                    translateY(${floatY}px)
                    rotate(${phone.rotation}deg)
                    scale(${interpolate(phoneSpring, [0, 1], [0.5, 1])})
                  `,
                                }, children: _jsx("div", { style: {
                                        width: 45,
                                        height: 45,
                                        borderRadius: 12,
                                        background: `${theme.colors.textMuted}15`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: `1px solid ${theme.colors.textMuted}20`,
                                    }, children: _jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: theme.colors.textMuted, opacity: 0.5, children: _jsx("path", { d: "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" }) }) }) }, i));
                        })] }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 30, layout: "none", children: _jsx(AnimatedText, { text: "Millions of seniors", style: {
                                fontSize: 44,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                lineHeight: 1.4,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 60, layout: "none", children: _jsx(AnimatedText, { text: "spend days without", style: {
                                fontSize: 44,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                lineHeight: 1.4,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 90, layout: "none", children: _jsx(AnimatedText, { text: "meaningful conversation.", style: {
                                fontSize: 44,
                                fontWeight: 700,
                                color: theme.colors.textPrimary,
                                lineHeight: 1.4,
                            }, animationType: "glowReveal" }) })] })] }));
};
