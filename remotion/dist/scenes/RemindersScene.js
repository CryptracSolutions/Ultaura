import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs } from "../theme";
import { GradientBackground, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
const ReminderCard = ({ icon, title, time, color, delay, index, }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const adjustedFrame = Math.max(0, frame - delay);
    const springValue = spring({
        frame: adjustedFrame,
        fps,
        config: springs.snappy,
    });
    const translateX = interpolate(springValue, [0, 1], [index % 2 === 0 ? -100 : 100, 0]);
    const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
    });
    // Check circle fill animation
    const checkFill = spring({
        frame: Math.max(0, adjustedFrame - 15),
        fps,
        config: springs.bouncy,
    });
    // Subtle glow
    const glowIntensity = interpolate(Math.sin(frame * 0.06 + index), [-1, 1], [0.1, 0.3]);
    return (_jsxs("div", { style: {
            background: theme.colors.backgroundCard,
            borderRadius: 18,
            padding: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity,
            transform: `translateX(${translateX}px)`,
            border: `1px solid ${color}25`,
            boxShadow: `0 4px 20px rgba(0, 0, 0, 0.15), 0 0 ${30 * glowIntensity}px ${color}20`,
        }, children: [_jsx("div", { style: {
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: `${color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: `1px solid ${color}25`,
                }, children: icon }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: {
                            fontFamily: theme.fonts.heading,
                            fontSize: 17,
                            fontWeight: 600,
                            color: theme.colors.textPrimary,
                            marginBottom: 4,
                        }, children: title }), _jsx("div", { style: {
                            fontFamily: theme.fonts.body,
                            fontSize: 13,
                            color: theme.colors.textSecondary,
                        }, children: time })] }), _jsxs("div", { style: {
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                }, children: [_jsx("div", { style: {
                            position: "absolute",
                            inset: 0,
                            borderRadius: "50%",
                            background: color,
                            transform: `scale(${checkFill})`,
                        } }), _jsx("div", { style: {
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "white",
                            position: "relative",
                            zIndex: 1,
                            transform: `scale(${checkFill})`,
                            opacity: checkFill,
                        } })] })] }));
};
export const RemindersScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const reminders = [
        {
            icon: (_jsx("svg", { width: "26", height: "26", viewBox: "0 0 24 24", fill: theme.colors.error, children: _jsx("path", { d: "M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" }) })),
            title: "Take Medication",
            time: "8:00 AM Daily",
            color: theme.colors.error,
        },
        {
            icon: (_jsx("svg", { width: "26", height: "26", viewBox: "0 0 24 24", fill: theme.colors.info, children: _jsx("path", { d: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" }) })),
            title: "Doctor Appointment",
            time: "Tomorrow 2:30 PM",
            color: theme.colors.info,
        },
        {
            icon: (_jsx("svg", { width: "26", height: "26", viewBox: "0 0 24 24", fill: theme.colors.success, children: _jsx("path", { d: "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" }) })),
            title: "Call Sarah",
            time: "This Saturday",
            color: theme.colors.success,
        },
    ];
    // Header entrance
    const headerEntrance = spring({
        frame,
        fps,
        config: springs.smooth,
    });
    // Bell icon animation
    const bellWobble = interpolate(Math.sin(frame * 0.3), [-1, 1], [-8, 8]);
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "mesh" }), children: [_jsx(ContentArea, { children: _jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 28,
                        width: "100%",
                        maxWidth: 400,
                    }, children: [_jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                opacity: headerEntrance,
                                transform: `translateY(${interpolate(headerEntrance, [0, 1], [-20, 0])}px)`,
                            }, children: [_jsx("div", { style: {
                                        transform: `rotate(${bellWobble}deg)`,
                                        transformOrigin: "top center",
                                    }, children: _jsx("svg", { width: "44", height: "44", viewBox: "0 0 24 24", fill: theme.colors.primary, children: _jsx("path", { d: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" }) }) }), _jsx("div", { style: {
                                        fontFamily: theme.fonts.heading,
                                        fontSize: 30,
                                        fontWeight: 700,
                                        color: theme.colors.textPrimary,
                                    }, children: "Reminders" })] }), _jsx("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                width: "100%",
                            }, children: reminders.map((reminder, i) => (_jsx(ReminderCard, { ...reminder, delay: 30 + i * 25, index: i }, i))) })] }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 110, layout: "none", children: _jsx(AnimatedText, { text: "Medication. Appointments.", style: {
                                fontSize: 34,
                                fontWeight: 600,
                                color: theme.colors.textPrimary,
                                lineHeight: 1.4,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 140, layout: "none", children: _jsx(AnimatedText, { text: "Never miss a thing.", style: {
                                fontSize: 34,
                                fontWeight: 700,
                                color: theme.colors.primary,
                                lineHeight: 1.4,
                            }, animationType: "glowReveal" }) })] })] }));
};
