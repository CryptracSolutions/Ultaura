import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs } from "../theme";
import { GradientBackground, PhoneFrame, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
// Animated chart bar component
const AnimatedBar = ({ value, maxHeight, delay, frame, fps, emoji, day, index }) => {
    const adjustedFrame = Math.max(0, frame - delay);
    const barSpring = spring({
        frame: adjustedFrame,
        fps,
        config: springs.snappy,
    });
    const barHeight = interpolate(barSpring, [0, 1], [0, value * maxHeight]);
    // Emoji bounce entrance
    const emojiSpring = spring({
        frame: Math.max(0, adjustedFrame - 10),
        fps,
        config: springs.bouncy,
    });
    // Slight continuous bar glow
    const glowIntensity = interpolate(Math.sin(frame * 0.08 + index), [-1, 1], [0.3, 0.6]);
    return (_jsxs("div", { style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
        }, children: [_jsx("div", { style: {
                    fontSize: 16,
                    transform: `scale(${emojiSpring})`,
                    opacity: emojiSpring,
                }, children: emoji }), _jsx("div", { style: {
                    width: "100%",
                    height: barHeight,
                    background: `linear-gradient(180deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                    borderRadius: 5,
                    boxShadow: `0 0 ${10 * glowIntensity}px ${theme.colors.primary}40`,
                } }), _jsx("div", { style: {
                    fontFamily: theme.fonts.body,
                    fontSize: 11,
                    color: theme.colors.textMuted,
                    opacity: interpolate(barSpring, [0, 0.5, 1], [0, 0, 1]),
                }, children: day })] }));
};
// Animated topic tag
const TopicTag = ({ topic, delay, frame, fps, index }) => {
    const adjustedFrame = Math.max(0, frame - delay);
    const tagSpring = spring({
        frame: adjustedFrame,
        fps,
        config: springs.snappy,
    });
    return (_jsx("div", { style: {
            padding: "6px 12px",
            background: `${theme.colors.primary}20`,
            borderRadius: 16,
            fontFamily: theme.fonts.body,
            fontSize: 12,
            fontWeight: 500,
            color: theme.colors.primary,
            transform: `scale(${tagSpring}) translateY(${interpolate(tagSpring, [0, 1], [10, 0])}px)`,
            opacity: tagSpring,
            border: `1px solid ${theme.colors.primary}30`,
        }, children: topic }));
};
export const DashboardScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Mood data for chart
    const moodData = [
        { day: "M", value: 0.7, emoji: "😊" },
        { day: "T", value: 0.85, emoji: "😊" },
        { day: "W", value: 0.6, emoji: "😐" },
        { day: "T", value: 0.9, emoji: "😊" },
        { day: "F", value: 0.75, emoji: "😊" },
        { day: "S", value: 0.8, emoji: "😊" },
        { day: "S", value: 0.95, emoji: "😄" },
    ];
    const topics = ["Family", "Health", "Weather", "Hobbies"];
    // Card entrance animations
    const moodCardEntrance = spring({
        frame: Math.max(0, frame - 20),
        fps,
        config: springs.smooth,
    });
    const topicsCardEntrance = spring({
        frame: Math.max(0, frame - 80),
        fps,
        config: springs.smooth,
    });
    const statsEntrance = spring({
        frame: Math.max(0, frame - 120),
        fps,
        config: springs.snappy,
    });
    // Animated stat counter
    const callCount = Math.min(7, Math.floor(interpolate(frame, [130, 160], [0, 7], { extrapolateRight: "clamp" })));
    const avgDuration = Math.min(45, Math.floor(interpolate(frame, [130, 160], [0, 45], { extrapolateRight: "clamp" })));
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "default", showParticles: false }), children: [_jsx(ContentArea, { children: _jsx(PhoneFrame, { delay: 0, scale: 0.95, tiltIntensity: 0.6, children: _jsxs("div", { style: {
                            width: "100%",
                            height: "100%",
                            background: theme.colors.background,
                            padding: 16,
                            paddingTop: 45,
                        }, children: [_jsx("div", { style: {
                                    fontFamily: theme.fonts.heading,
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: theme.colors.textPrimary,
                                    marginBottom: 20,
                                    opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
                                }, children: "Weekly Insights" }), _jsxs("div", { style: {
                                    background: theme.colors.backgroundCard,
                                    borderRadius: 16,
                                    padding: 16,
                                    marginBottom: 14,
                                    opacity: moodCardEntrance,
                                    transform: `translateY(${interpolate(moodCardEntrance, [0, 1], [20, 0])}px)`,
                                    border: `1px solid ${theme.colors.primary}15`,
                                }, children: [_jsxs("div", { style: {
                                            fontFamily: theme.fonts.body,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: theme.colors.textSecondary,
                                            marginBottom: 14,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }, children: [_jsx("span", { children: "\uD83D\uDCCA" }), " Mood Trend"] }), _jsx("div", { style: {
                                            display: "flex",
                                            alignItems: "flex-end",
                                            justifyContent: "space-between",
                                            height: 85,
                                            gap: 6,
                                        }, children: moodData.map((item, i) => (_jsx(AnimatedBar, { value: item.value, maxHeight: 60, delay: 40 + i * 6, frame: frame, fps: fps, emoji: item.emoji, day: item.day, index: i }, i))) })] }), _jsxs("div", { style: {
                                    background: theme.colors.backgroundCard,
                                    borderRadius: 16,
                                    padding: 16,
                                    marginBottom: 14,
                                    opacity: topicsCardEntrance,
                                    transform: `translateY(${interpolate(topicsCardEntrance, [0, 1], [20, 0])}px)`,
                                    border: `1px solid ${theme.colors.primary}15`,
                                }, children: [_jsxs("div", { style: {
                                            fontFamily: theme.fonts.body,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: theme.colors.textSecondary,
                                            marginBottom: 12,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }, children: [_jsx("span", { children: "\uD83D\uDCAC" }), " Topics Discussed"] }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: topics.map((topic, i) => (_jsx(TopicTag, { topic: topic, delay: 90 + i * 8, frame: frame, fps: fps, index: i }, topic))) })] }), _jsxs("div", { style: {
                                    display: "flex",
                                    gap: 12,
                                    opacity: statsEntrance,
                                    transform: `translateY(${interpolate(statsEntrance, [0, 1], [20, 0])}px)`,
                                }, children: [_jsxs("div", { style: {
                                            flex: 1,
                                            background: theme.colors.backgroundCard,
                                            borderRadius: 16,
                                            padding: 16,
                                            textAlign: "center",
                                            border: `1px solid ${theme.colors.primary}20`,
                                        }, children: [_jsx("div", { style: {
                                                    fontFamily: theme.fonts.heading,
                                                    fontSize: 28,
                                                    fontWeight: 700,
                                                    color: theme.colors.primary,
                                                    textShadow: `0 0 20px ${theme.colors.primary}30`,
                                                }, children: callCount }), _jsx("div", { style: {
                                                    fontFamily: theme.fonts.body,
                                                    fontSize: 11,
                                                    color: theme.colors.textSecondary,
                                                    marginTop: 4,
                                                }, children: "Calls" })] }), _jsxs("div", { style: {
                                            flex: 1,
                                            background: theme.colors.backgroundCard,
                                            borderRadius: 16,
                                            padding: 16,
                                            textAlign: "center",
                                            border: `1px solid ${theme.colors.success}20`,
                                        }, children: [_jsxs("div", { style: {
                                                    fontFamily: theme.fonts.heading,
                                                    fontSize: 28,
                                                    fontWeight: 700,
                                                    color: theme.colors.success,
                                                    textShadow: `0 0 20px ${theme.colors.success}30`,
                                                }, children: [avgDuration, "m"] }), _jsx("div", { style: {
                                                    fontFamily: theme.fonts.body,
                                                    fontSize: 11,
                                                    color: theme.colors.textSecondary,
                                                    marginTop: 4,
                                                }, children: "Avg Duration" })] })] })] }) }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 160, layout: "none", children: _jsx(AnimatedText, { text: "Family dashboard tracks", style: {
                                fontSize: 34,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                lineHeight: 1.4,
                            }, animationType: "fadeUp" }) }), _jsx(Sequence, { from: 185, layout: "none", children: _jsx(AnimatedText, { text: "mood, topics & connection.", style: {
                                fontSize: 34,
                                fontWeight: 700,
                                color: theme.colors.primary,
                                lineHeight: 1.4,
                            }, animationType: "glowReveal" }) })] })] }));
};
