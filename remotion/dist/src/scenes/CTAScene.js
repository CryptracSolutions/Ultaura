import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs, easings } from "../theme";
import { GradientBackground, UltauraLogo, SceneLayout } from "../components";
// Animated particle with trail effect
const FloatingParticle = ({ index, frame, fps }) => {
    const goldenRatio = 1.618033988749895;
    const x = ((index * goldenRatio * 137.5) % 100);
    const y = ((index * goldenRatio * 73.3 + 50) % 100);
    const size = 3 + (index % 4) * 2;
    const delay = index * 10;
    const speed = 0.4 + (index % 3) * 0.2;
    const duration = 150 + (index % 50);
    const adjustedFrame = Math.max(0, frame - delay);
    const cycleFrame = adjustedFrame % duration;
    const floatY = interpolate(cycleFrame, [0, duration * 0.5, duration], [0, -80 - (index % 40), 0], { easing: easings.smooth });
    const floatX = Math.sin((adjustedFrame * speed * 0.025) + index) * 20;
    const opacity = interpolate(cycleFrame, [0, duration * 0.1, duration * 0.7, duration], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const scale = interpolate(cycleFrame, [0, duration * 0.3, duration], [0.5, 1, 0.5]);
    // Glow based on position
    const glow = interpolate(Math.sin(adjustedFrame * 0.1 + index), [-1, 1], [0.3, 1]);
    return (_jsx("div", { style: {
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 100%)`,
            opacity: opacity * glow,
            transform: `translate(${floatX}px, ${floatY}px) scale(${scale})`,
            boxShadow: `0 0 ${size * 4 * glow}px ${theme.colors.primary}80`,
            zIndex: 0,
        } }));
};
export const CTAScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Logo entrance
    const logoSpring = spring({
        frame,
        fps,
        config: springs.bouncy,
    });
    // Button animations
    const buttonEntrance = spring({
        frame: Math.max(0, frame - 50),
        fps,
        config: springs.snappy,
    });
    // Continuous button pulse - more energetic
    const pulseScale = interpolate(Math.sin(frame * 0.12), [-1, 1], [0.98, 1.04]);
    const pulseGlow = interpolate(Math.sin(frame * 0.12), [-1, 1], [40, 80]);
    // Shine effect across button
    const shinePosition = interpolate(frame % 90, [0, 90], [-100, 200]);
    // Trust badges entrance
    const badgeEntrances = [0, 1, 2].map((i) => spring({
        frame: Math.max(0, frame - 90 - i * 10),
        fps,
        config: springs.snappy,
    }));
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "aurora", particleCount: 30 }), children: [Array.from({ length: 20 }).map((_, i) => (_jsx(FloatingParticle, { index: i, frame: frame, fps: fps }, i))), _jsx("div", { style: {
                    position: "absolute",
                    top: "35%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 500,
                    height: 500,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${theme.colors.primary}20 0%, ${theme.colors.primary}08 40%, transparent 70%)`,
                    filter: "blur(40px)",
                    opacity: interpolate(Math.sin(frame * 0.05), [-1, 1], [0.5, 0.8]),
                    zIndex: 0,
                } }), _jsxs("div", { style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 35,
                    zIndex: 1,
                }, children: [_jsx("div", { style: {
                            transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
                            opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
                        }, children: _jsx(UltauraLogo, { delay: 0, size: 130, showWordmark: true }) }), _jsx(Sequence, { from: 25, layout: "none", children: _jsxs("div", { style: {
                                fontFamily: theme.fonts.heading,
                                fontSize: 34,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                textAlign: "center",
                                padding: "0 40px",
                                opacity: interpolate(frame - 25, [0, 20], [0, 1], {
                                    extrapolateRight: "clamp",
                                }),
                                transform: `translateY(${interpolate(frame - 25, [0, 20], [25, 0], {
                                    extrapolateRight: "clamp",
                                    easing: easings.easeOut,
                                })}px)`,
                            }, children: ["AI Voice Companion", _jsx("br", {}), _jsx("span", { style: { color: theme.colors.primary }, children: "for Seniors" })] }) }), _jsx(Sequence, { from: 50, layout: "none", children: _jsxs("div", { style: {
                                position: "relative",
                                transform: `scale(${buttonEntrance * pulseScale})`,
                                opacity: interpolate(frame - 50, [0, 15], [0, 1], {
                                    extrapolateRight: "clamp",
                                }),
                            }, children: [_jsx("div", { style: {
                                        position: "absolute",
                                        inset: -8,
                                        borderRadius: 50,
                                        background: `${theme.colors.primary}30`,
                                        filter: "blur(15px)",
                                        opacity: interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.7]),
                                    } }), _jsxs("div", { style: {
                                        position: "relative",
                                        background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary} 50%, ${theme.colors.primaryDark} 100%)`,
                                        padding: "22px 55px",
                                        borderRadius: 45,
                                        boxShadow: `
                  0 0 ${pulseGlow}px ${theme.colors.primary}50,
                  0 12px 35px rgba(0, 0, 0, 0.35),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2)
                `,
                                        overflow: "hidden",
                                    }, children: [_jsx("div", { style: {
                                                position: "absolute",
                                                top: 0,
                                                left: shinePosition,
                                                width: 60,
                                                height: "100%",
                                                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                                                transform: "skewX(-20deg)",
                                            } }), _jsx("div", { style: {
                                                fontFamily: theme.fonts.heading,
                                                fontSize: 24,
                                                fontWeight: 700,
                                                color: "white",
                                                letterSpacing: 1.5,
                                                textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                                position: "relative",
                                                zIndex: 1,
                                            }, children: "Start Free Trial" })] })] }) }), _jsx(Sequence, { from: 80, layout: "none", children: _jsxs("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 16,
                                opacity: interpolate(frame - 80, [0, 20], [0, 1], {
                                    extrapolateRight: "clamp",
                                }),
                            }, children: [_jsxs("div", { style: {
                                        fontFamily: theme.fonts.body,
                                        fontSize: 17,
                                        color: theme.colors.textSecondary,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }, children: [_jsx("span", { children: "3-day free trial" }), _jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsx("span", { children: "No credit card" })] }), _jsx("div", { style: {
                                        display: "flex",
                                        gap: 24,
                                        marginTop: 10,
                                        flexWrap: "wrap",
                                        justifyContent: "center",
                                    }, children: [
                                        { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", label: "Secure", color: theme.colors.success },
                                        { icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6.3 1.2.9 1.2 1.5v3c0 .8-.7 1.5-1.5 1.5h-5c-.8 0-1.5-.7-1.5-1.5v-3c0-.6.6-1.2 1.2-1.5V9.5C9.2 8.1 10.6 7 12 7z", label: "Private", color: theme.colors.info },
                                        { icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z", label: "24/7", color: theme.colors.primary },
                                    ].map((badge, i) => (_jsxs("div", { style: {
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            transform: `translateY(${interpolate(badgeEntrances[i], [0, 1], [15, 0])}px)`,
                                            opacity: badgeEntrances[i],
                                        }, children: [_jsx("div", { style: {
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: "50%",
                                                    background: `${badge.color}20`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: badge.color, children: _jsx("path", { d: badge.icon }) }) }), _jsx("span", { style: {
                                                    fontFamily: theme.fonts.body,
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    color: theme.colors.textMuted,
                                                }, children: badge.label })] }, badge.label))) })] }) })] })] }));
};
