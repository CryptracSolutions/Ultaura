import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useVideoConfig, interpolate, AbsoluteFill, Audio, staticFile, } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { theme, springs } from "./theme";
import { ProgressBar, Watermark } from "./components";
import { HookScene, ProblemScene, SolutionScene, AICallsScene, DashboardScene, SafetyScene, RemindersScene, CTAScene, } from "./scenes";
export const UltauraPromo = () => {
    const { fps, durationInFrames } = useVideoConfig();
    const { sections } = theme;
    // Transition durations
    const fadeTransition = Math.round(fps * 0.5);
    const slideTransition = Math.round(fps * 0.6);
    const wipeTransition = Math.round(fps * 0.5);
    // Fade in/out duration for music
    const musicFadeFrames = fps * 2;
    return (_jsxs(AbsoluteFill, { style: {
            backgroundColor: theme.colors.background,
            overflow: "hidden",
        }, children: [_jsx(Audio, { src: staticFile("background-music.mp3"), volume: (f) => {
                    // Fade in at start
                    if (f < musicFadeFrames) {
                        return interpolate(f, [0, musicFadeFrames], [0, 0.25]);
                    }
                    // Fade out at end
                    if (f > durationInFrames - musicFadeFrames) {
                        return interpolate(f, [durationInFrames - musicFadeFrames, durationInFrames], [0.25, 0]);
                    }
                    // Normal volume
                    return 0.25;
                } }), _jsxs(TransitionSeries, { children: [_jsx(TransitionSeries.Sequence, { durationInFrames: sections.hook.duration, children: _jsx(HookScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: fade(), timing: linearTiming({ durationInFrames: fadeTransition }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.problem.duration, children: _jsx(ProblemScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: wipe({ direction: "from-bottom-left" }), timing: linearTiming({ durationInFrames: wipeTransition }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.solution.duration, children: _jsx(SolutionScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: slide({ direction: "from-right" }), timing: springTiming({
                            config: springs.smooth,
                            durationInFrames: slideTransition
                        }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.aiCalls.duration, children: _jsx(AICallsScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: slide({ direction: "from-left" }), timing: springTiming({
                            config: springs.smooth,
                            durationInFrames: slideTransition
                        }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.dashboard.duration, children: _jsx(DashboardScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: slide({ direction: "from-right" }), timing: springTiming({
                            config: springs.smooth,
                            durationInFrames: slideTransition
                        }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.safety.duration, children: _jsx(SafetyScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: slide({ direction: "from-left" }), timing: springTiming({
                            config: springs.smooth,
                            durationInFrames: slideTransition
                        }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.reminders.duration, children: _jsx(RemindersScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: fade(), timing: linearTiming({ durationInFrames: fadeTransition }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.cta.duration, children: _jsx(CTAScene, {}) })] }), _jsx(ProgressBar, {}), _jsx(Watermark, { position: "top-right" })] }));
};
