import React from "react";
import { Composition } from "remotion";
import { UltauraAd } from "./UltauraAd";
import type { VideoProps } from "./types";
import "./theme";

const defaultProps = {
  sceneText: {
    brandName: "Ultaura",
    tagline: "The call they look forward to.",
    dashboardTitle: "Your Dashboard",
    dashboardLabels: {
      mood: "Mood Trend",
      duration: "Last Call",
      wellness: "Wellness",
    },
    dashboardValues: {
      moodChartLabel: "This Week",
      durationNumber: "12",
      durationSuffix: " min",
      wellnessText: "All Good",
    },
    conversationLines: [
      "How's that garden coming along, Margaret?",
      "Just a reminder — it's time for your evening medication.",
    ] as [string, string],
    benefitCenter: "Everything they need",
    benefitNames: [
      "Reminders",
      "Schedules",
      "Insights",
      "Alerts",
    ] as [string, string, string, string],
    ctaTagline: "The call they look forward to.",
    ctaButton: "Start Your Free Trial",
    ctaPrice: "Starting at $19/mo",
    ctaSubtext: "Works on any phone. Even landlines.",
    ctaUrl: "ultaura.com",
  },
  voiceCharacter: "ara" as const,
} satisfies VideoProps;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="UltauraAd"
      component={UltauraAd}
      durationInFrames={1500}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
};
