import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs } from "../theme";
import { GradientBackground, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
export const SafetyScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Shield entrance with bounce
    const shieldEntrance = spring({
        frame,
        fps,
        config: springs.bouncy,
    });
    // Shield pulse animation
    const pulseScale = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.98, 1.04]);
    const pulseGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [20, 50]);
    // Checkmark animation inside shield
    const checkProgress = spring({
        frame: Math.max(0, frame - 20),
        fps,
        config: springs.snappy,
        durationInFrames: 15,
    });
    // Alert card animations
    const card1Entrance = spring({
        frame: Math.max(0, frame - 40),
        fps,
        config: springs.smooth,
    });
    const card2Entrance = spring({
        frame: Math.max(0, frame - 65),
        fps,
        config: springs.smooth,
    });
    // Floating safety particles
    const particles = [0, 1, 2, 3, 4].map((i) => {
        const phase = (i / 5) * Math.PI * 2;
        const radius = 100 + (i % 3) * 20;
        const speed = 0.015 + (i % 2) * 0.005;
        return {
            x: Math.cos(frame * speed + phase) * radius,
            y: Math.sin(frame * speed + phase) * radius * 0.4,
            opacity: interpolate(Math.sin(frame * 0.05 + i), [-1, 1], [0.2, 0.5]),
            size: 4 + (i % 3) * 2,
        };
    });
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "radial" }), children: [_jsx(ContentArea, { children: _jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 30,
                        position: "relative",
                    }, children: [particles.map((p, i) => (_jsx("div", { style: {
                                position: "absolute",
                                top: "25%",
                                left: "50%",
                                width: p.size,
                                height: p.size,
                                borderRadius: "50%",
                                background: theme.colors.primary,
                                transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
                                opacity: p.opacity * shieldEntrance,
                                boxShadow: `0 0 ${p.size * 2}px ${theme.colors.primary}60`,
                            } }, i))), _jsxs("div", { style: {
                                position: "relative",
                                transform: `scale(${shieldEntrance * pulseScale})`,
                                opacity: interpolate(shieldEntrance, [0, 1], [0, 1]),
                            }, children: [_jsx("div", { style: {
                                        position: "absolute",
                                        top: -30,
                                        left: -30,
                                        right: -30,
                                        bottom: -30,
                                        background: `radial-gradient(circle, ${theme.colors.primary}40 0%, transparent 70%)`,
                                        filter: `blur(${pulseGlow * 0.5}px)`,
                                        opacity: interpolate(Math.sin(frame * 0.1), [-1, 1], [0.4, 0.8]),
                                    } }), _jsxs("svg", { width: "130", height: "150", viewBox: "0 0 24 24", fill: "none", style: { position: "relative", zIndex: 1 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "shieldGradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: theme.colors.primaryLight }), _jsx("stop", { offset: "50%", stopColor: theme.colors.primary }), _jsx("stop", { offset: "100%", stopColor: theme.colors.primaryDark })] }), _jsxs("filter", { id: "shieldGlow", children: [_jsx("feGaussianBlur", { stdDeviation: "1", result: "coloredBlur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "coloredBlur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] })] }), _jsx("path", { d: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z", fill: "url(#shieldGradient)", filter: "url(#shieldGlow)" }), _jsx("path", { d: "M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z", fill: "white", style: {
                                                opacity: checkProgress,
                                                transform: `scale(${checkProgress})`,
                                                transformOrigin: "center",
                                            } })] })] }), _jsxs("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                width: 340,
                            }, children: [_jsxs("div", { style: {
                                        background: theme.colors.backgroundCard,
                                        borderRadius: 16,
                                        padding: 18,
                                        borderLeft: `4px solid ${theme.colors.warning}`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 14,
                                        opacity: card1Entrance,
                                        transform: `translateX(${interpolate(card1Entrance, [0, 1], [-40, 0])}px)`,
                                        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.2)`,
                                    }, children: [_jsx("div", { style: {
                                                width: 42,
                                                height: 42,
                                                borderRadius: 10,
                                                background: `${theme.colors.warning}20`,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }, children: _jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: theme.colors.warning, children: _jsx("path", { d: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" }) }) }), _jsxs("div", { children: [_jsx("div", { style: {
                                                        fontFamily: theme.fonts.heading,
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: theme.colors.textPrimary,
                                                    }, children: "Wellness Check" }), _jsx("div", { style: {
                                                        fontFamily: theme.fonts.body,
                                                        fontSize: 12,
                                                        color: theme.colors.textSecondary,
                                                        marginTop: 2,
                                                    }, children: "Mom mentioned feeling tired" })] })] }), _jsxs("div", { style: {
                                        background: theme.colors.backgroundCard,
                                        borderRadius: 16,
                                        padding: 18,
                                        borderLeft: `4px solid ${theme.colors.success}`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 14,
                                        opacity: card2Entrance,
                                        transform: `translateX(${interpolate(card2Entrance, [0, 1], [40, 0])}px)`,
                                        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.2)`,
                                    }, children: [_jsx("div", { style: {
                                                width: 42,
                                                height: 42,
                                                borderRadius: 10,
                                                background: `${theme.colors.success}20`,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }, children: _jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: theme.colors.success, children: _jsx("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" }) }) }), _jsxs("div", { children: [_jsx("div", { style: {
                                                        fontFamily: theme.fonts.heading,
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: theme.colors.textPrimary,
                                                    }, children: "All Clear" }), _jsx("div", { style: {
                                                        fontFamily: theme.fonts.body,
                                                        fontSize: 12,
                                                        color: theme.colors.textSecondary,
                                                        marginTop: 2,
                                                    }, children: "Today's call went great" })] })] })] })] }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 100, layout: "none", children: _jsx(AnimatedText, { text: "Instant wellness alerts", style: {
                                fontSize: 38,
                                fontWeight: 600,
                                color: theme.colors.textPrimary,
                                lineHeight: 1.4,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 125, layout: "none", children: _jsx(AnimatedText, { text: "when something seems off.", style: {
                                fontSize: 38,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                lineHeight: 1.4,
                            }, animationType: "fadeUp" }) })] })] }));
};
