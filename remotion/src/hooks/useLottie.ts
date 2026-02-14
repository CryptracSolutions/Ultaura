import { useCallback, useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import type { LottieAnimationData } from "@remotion/lottie";

export function useLottieData(filename: string): LottieAnimationData | null {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() =>
    delayRender(`Loading Lottie: ${filename}`)
  );

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(staticFile(filename));
      const json = await response.json();
      setData(json as LottieAnimationData);
      continueRender(handle);
    } catch (err) {
      cancelRender(err);
    }
  }, [filename, handle]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}
