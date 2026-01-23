import { Composition } from "remotion";
import { UltauraPromo } from "./UltauraPromo";
import { theme, TRANSITION_COUNT, TRANSITION_DURATION_FRAMES } from "./theme";

// Calculate total duration accounting for transition overlaps
// Each transition subtracts from total since scenes overlap during transitions
const transitionDuration = TRANSITION_DURATION_FRAMES;
const numberOfTransitions = TRANSITION_COUNT;
const totalSceneDuration = Object.values(theme.sections).reduce(
  (acc, section) => acc + section.duration,
  0
);
const calculatedDuration = totalSceneDuration - (numberOfTransitions * transitionDuration);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="UltauraPromo"
        component={UltauraPromo}
        durationInFrames={calculatedDuration}
        fps={theme.fps}
        width={theme.dimensions.width}
        height={theme.dimensions.height}
      />
    </>
  );
};
