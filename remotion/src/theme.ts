import { loadFont } from "@remotion/google-fonts/Manrope";
import { Easing } from "remotion";

// Load Manrope - Ultaura's brand font
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Transition configuration (30fps) - faster for TikTok/Reels pacing
export const TRANSITION_DURATION_FRAMES = 10; // 0.33s for crisp social pacing
export const TRANSITION_COUNT = 6;

// Spring configurations for different animation types
export const springs = {
  // Smooth, no bounce - for subtle reveals and text
  smooth: { damping: 200 },
  // Snappy, minimal bounce - for UI elements
  snappy: { damping: 20, stiffness: 200 },
  // Bouncy entrance - for playful, attention-grabbing animations
  bouncy: { damping: 8, stiffness: 100 },
  // Heavy, slow, small bounce - for large elements like phones
  heavy: { damping: 15, stiffness: 80, mass: 2 },
  // Quick pop - for icons and small elements
  pop: { damping: 12, stiffness: 300 },
  // Gentle float - for background elements
  gentle: { damping: 30, stiffness: 50 },
  // Premium crossfade - no overshoot
  premiumFade: { damping: 200, stiffness: 100 },

  // New energetic presets for fast-paced promo
  quick: { damping: 15, stiffness: 300 },
  energetic: { damping: 10, stiffness: 250 },
  shake: { damping: 5, stiffness: 500 },
} as const;

// Easing presets for interpolate functions
export const easings = {
  // Standard easing curves
  easeOut: Easing.out(Easing.quad),
  easeIn: Easing.in(Easing.quad),
  easeInOut: Easing.inOut(Easing.quad),
  // More dramatic curves
  easeOutExpo: Easing.out(Easing.exp),
  easeInOutExpo: Easing.inOut(Easing.exp),
  // Custom bezier curves
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
  snappy: Easing.bezier(0.34, 1.56, 0.64, 1),
  gentle: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const;

// Ultaura Brand Theme (derived from src/app/globals.css)
export const theme = {
  colors: {
    // Primary brand color - Tiffany Blue
    primary: "#24b5a1",
    primaryLight: "#3dc6b1",
    primaryDark: "#0e9b89",

    // Backgrounds
    background: "#f8f8f7",
    backgroundLight: "#ffffff",
    backgroundCard: "#ffffff",
    surface: "#f4f3f1",

    // Text
    textPrimary: "#0c0a09",
    textSecondary: "#79716b",
    textMuted: "#a6a09b",

    // Semantic
    success: "#00bc7d",
    warning: "#ffb900",
    error: "#e7000b",
    info: "#2b7fff",

    // Accent for variety
    accent: "#2b7fff",

    // Gradients
    gradientStart: "#24b5a1",
    gradientEnd: "#0e9b89",
  },

  fonts: {
    heading: fontFamily,
    body: fontFamily,
    primary: fontFamily,
  },

  // 9:16 vertical format
  dimensions: {
    width: 1080,
    height: 1920,
  },

  // 30 FPS standard
  fps: 30,

  // Section timings in frames (at 30fps) - 30s total after transitions
  sections: {
    hook: { start: 0, duration: 90 },          // 3s
    seniorView: { start: 90, duration: 135 },  // 4.5s
    reminders: { start: 225, duration: 120 },  // 4s
    familyView: { start: 345, duration: 135 }, // 4.5s
    insights: { start: 480, duration: 165 },   // 5.5s
    peace: { start: 645, duration: 105 },      // 3.5s
    cta: { start: 750, duration: 210 },        // 7s
  },

  // Total raw duration before overlap subtraction
  totalRawDuration: 960,

  // Final output duration: 30 seconds = 900 frames (subtract transitions)
  totalDuration: 900,
} as const;

export type Theme = typeof theme;
export type SpringConfig = typeof springs;
export type EasingConfig = typeof easings;
