import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, } from "remotion";
import { theme, springs } from "../theme";
import { GradientBackground, UltauraLogo, Waveform, AnimatedText, SceneLayout, ContentArea, TextArea, } from "../components";
export const SolutionScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    // Logo entrance
    const logoEntrance = spring({
        frame,
        fps,
        config: springs.bouncy,
    });
    // Glow pulse effect - more dramatic
    const glowIntensity = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.8]);
    const glowScale = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.9, 1.1]);
    // Waveform entrance
    const waveformEntrance = spring({
        frame: Math.max(0, frame - 45),
        fps,
        config: springs.smooth,
    });
    // Orbiting particles around logo
    const orbitParticles = [0, 1, 2, 3].map((i) => {
        const phase = (i / 4) * Math.PI * 2;
        const radius = 120 + (i % 2) * 20;
        const speed = 0.02 + (i % 2) * 0.005;
        return {
            x: Math.cos(frame * speed + phase) * radius,
            y: Math.sin(frame * speed + phase) * radius * 0.3,
            opacity: interpolate(Math.sin(frame * 0.06 + i), [-1, 1], [0.3, 0.7]) * logoEntrance,
            size: 5 + (i % 2) * 2,
        };
    });
    return (_jsxs(SceneLayout, { background: _jsx(GradientBackground, { variant: "aurora" }), children: [orbitParticles.map((p, i) => (_jsx("div", { style: {
                    position: "absolute",
                    top: "30%",
                    left: "50%",
                    width: p.size,
                    height: p.size,
                    borderRadius: "50%",
                    background: theme.colors.primaryLight,
                    transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
                    opacity: p.opacity,
                    boxShadow: `0 0 ${p.size * 3}px ${theme.colors.primary}80`,
                    zIndex: 0,
                } }, i))), _jsx("div", { style: {
                    position: "absolute",
                    top: "28%",
                    left: "50%",
                    transform: `translate(-50%, -50%) scale(${glowScale})`,
                    width: 450,
                    height: 450,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${theme.colors.primary}${Math.round(glowIntensity * 30)
                        .toString(16)
                        .padStart(2, "0")} 0%, transparent 60%)`,
                    filter: "blur(50px)",
                    zIndex: 0,
                    opacity: logoEntrance,
                } }), _jsx("div", { style: {
                    position: "absolute",
                    top: "28%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    border: `2px solid ${theme.colors.primary}20`,
                    opacity: interpolate(Math.sin(frame * 0.05), [-1, 1], [0.2, 0.5]) * logoEntrance,
                    zIndex: 0,
                } }), _jsx(ContentArea, { children: _jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 45,
                        position: "relative",
                        zIndex: 1,
                    }, children: [_jsx("div", { style: {
                                transform: `scale(${interpolate(logoEntrance, [0, 1], [0.5, 1])})`,
                                opacity: logoEntrance,
                            }, children: _jsx(UltauraLogo, { delay: 0, size: 150, showWordmark: true }) }), _jsx("div", { style: {
                                transform: `scale(${waveformEntrance})`,
                                opacity: waveformEntrance,
                            }, children: _jsx(Waveform, { width: 300, height: 75, bars: 18, variant: "glow", entranceDelay: 45 }) })] }) }), _jsxs(TextArea, { children: [_jsx(Sequence, { from: 70, layout: "none", children: _jsx(AnimatedText, { text: "An AI voice companion", style: {
                                fontSize: 42,
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                lineHeight: 1.4,
                            }, animationType: "wordReveal" }) }), _jsx(Sequence, { from: 100, layout: "none", children: _jsx(AnimatedText, { text: "that calls daily.", style: {
                                fontSize: 42,
                                fontWeight: 700,
                                color: theme.colors.primary,
                                lineHeight: 1.4,
                            }, animationType: "glowReveal" }) })] })] }));
};
