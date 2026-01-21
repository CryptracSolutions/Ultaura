import { Composition } from "remotion";
import { UltauraPromo } from "./UltauraPromo";
import { theme } from "./theme";

// Calculate total duration accounting for transition overlaps
// Each transition subtracts from total since scenes overlap during transitions
const transitionDuration = Math.round(theme.fps * 0.5); // 0.5 seconds
const numberOfTransitions = 7; // 7 transitions between 8 scenes
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
