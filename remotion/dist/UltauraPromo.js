import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useVideoConfig, interpolate, AbsoluteFill, Sequence } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { theme, springs } from "./theme";
import { ProgressBar, Watermark } from "./components";
import { HookScene, ProblemScene, SolutionScene, AICallsScene, DashboardScene, SafetyScene, RemindersScene, CTAScene, } from "./scenes";
// Royalty-free ambient/corporate music from Pixabay
const BACKGROUND_MUSIC_URL = "https://cdn.pixabay.com/audio/2024/11/29/audio_5abe58a705.mp3";
// Sound effects
const WHOOSH_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/24/audio_1ca2a0c5e2.mp3";
// Soft chime for positive moments
const CHIME_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_115b9c6d7c.mp3";
// Subtle notification sound
const NOTIFICATION_SOUND_URL = "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3";
export const UltauraPromo = () => {
    const { fps, durationInFrames } = useVideoConfig();
    const { sections } = theme;
    // Transition durations
    const fadeTransition = Math.round(fps * 0.5);
    const slideTransition = Math.round(fps * 0.6);
    const wipeTransition = Math.round(fps * 0.5);
    // Fade in/out duration for music
    const musicFadeFrames = fps * 2;
    // Calculate transition start frames (accounting for TransitionSeries overlaps)
    const getTransitionFrame = (sceneIndex) => {
        const sceneDurations = [
            sections.hook.duration,
            sections.problem.duration,
            sections.solution.duration,
            sections.aiCalls.duration,
            sections.dashboard.duration,
            sections.safety.duration,
            sections.reminders.duration,
        ];
        const transitionDurations = [
            fadeTransition,
            wipeTransition,
            slideTransition,
            slideTransition,
            slideTransition,
            slideTransition,
            fadeTransition,
        ];
        let frame = 0;
        for (let i = 0; i < sceneIndex; i++) {
            frame += sceneDurations[i] - transitionDurations[i];
        }
        return frame;
    };
    return (_jsxs(AbsoluteFill, { style: {
            backgroundColor: theme.colors.background,
            overflow: "hidden",
        }, children: [_jsx(Audio, { src: BACKGROUND_MUSIC_URL, volume: (f) => {
                    // Fade in at start
                    if (f < musicFadeFrames) {
                        return interpolate(f, [0, musicFadeFrames], [0, 0.32]);
                    }
                    // Fade out at end
                    if (f > durationInFrames - musicFadeFrames) {
                        return interpolate(f, [durationInFrames - musicFadeFrames, durationInFrames], [0.32, 0]);
                    }
                    // Normal volume
                    return 0.32;
                }, loop: true }), [2, 3, 4, 5].map((sceneIndex) => (_jsx(Sequence, { from: getTransitionFrame(sceneIndex), layout: "none", children: _jsx(Audio, { src: WHOOSH_SOUND_URL, volume: 0.12 }) }, `whoosh-${sceneIndex}`))), _jsx(Sequence, { from: getTransitionFrame(2) + 30, layout: "none", children: _jsx(Audio, { src: CHIME_SOUND_URL, volume: 0.08 }) }), _jsx(Sequence, { from: getTransitionFrame(5) + 40, layout: "none", children: _jsx(Audio, { src: NOTIFICATION_SOUND_URL, volume: 0.1 }) }), _jsx(Sequence, { from: getTransitionFrame(5) + 60, layout: "none", children: _jsx(Audio, { src: NOTIFICATION_SOUND_URL, volume: 0.08 }) }), _jsx(Sequence, { from: getTransitionFrame(7) + 60, layout: "none", children: _jsx(Audio, { src: CHIME_SOUND_URL, volume: 0.1 }) }), _jsxs(TransitionSeries, { children: [_jsx(TransitionSeries.Sequence, { durationInFrames: sections.hook.duration, children: _jsx(HookScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: fade(), timing: linearTiming({ durationInFrames: fadeTransition }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.problem.duration, children: _jsx(ProblemScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: wipe({ direction: "from-bottom-left" }), timing: linearTiming({ durationInFrames: wipeTransition }) }), _jsx(TransitionSeries.Sequence, { durationInFrames: sections.solution.duration, children: _jsx(SolutionScene, {}) }), _jsx(TransitionSeries.Transition, { presentation: slide({ direction: "from-right" }), timing: springTiming({
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
