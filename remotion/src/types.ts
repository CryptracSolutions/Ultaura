export type SceneText = {
  brandName: string;
  tagline: string;
  dashboardTitle: string;
  dashboardLabels: {
    mood: string;
    duration: string;
    wellness: string;
  };
  dashboardValues: {
    moodChartLabel: string;
    durationNumber: string;
    durationSuffix: string;
    wellnessText: string;
  };
  conversationLines: [string, string];
  benefitCenter: string;
  benefitNames: [string, string, string, string];
  ctaTagline: string;
  ctaButton: string;
  ctaPrice: string;
  ctaSubtext: string;
  ctaUrl: string;
};

export type VideoProps = {
  sceneText: SceneText;
  voiceCharacter: "ara" | "eve" | "leo" | "rex" | "sal";
};
