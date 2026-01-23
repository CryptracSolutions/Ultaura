import { loadFont } from "@remotion/google-fonts/Manrope";
import { Easing } from "remotion";

// Load Manrope - Ultaura's brand font
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Transition configuration (30fps)
export const TRANSITION_DURATION_FRAMES = 18; // 0.6s
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

// Ultaura Brand Theme
export const theme = {
  colors: {
    // Primary brand color - Tiffany Blue
    primary: "#0ABAB5",
    primaryLight: "#3DD4CF",
    primaryDark: "#089A96",

    // Backgrounds
    background: "#0A0A0F",
    backgroundLight: "#121218",
    backgroundCard: "#1A1A22",

    // Text
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0B0",
    textMuted: "#6B6B7B",

    // Semantic
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // Gradients
    gradientStart: "#0ABAB5",
    gradientEnd: "#089A96",
  },

  fonts: {
    heading: fontFamily,
    body: fontFamily,
  },

  // 9:16 vertical format
  dimensions: {
    width: 1080,
    height: 1920,
  },

  // 30 FPS standard
  fps: 30,

  // Section timings in frames (at 30fps)
  sections: {
    hook: { start: 0, duration: 180 },             // 6s
    voiceSelection: { start: 180, duration: 210 }, // 7s
    reminders: { start: 390, duration: 210 },      // 7s
    schedule: { start: 600, duration: 210 },       // 7s
    insightsSafety: { start: 810, duration: 360 }, // 12s
    calls: { start: 1170, duration: 270 },         // 9s
    cta: { start: 1440, duration: 228 },           // 7.6s
  },

  // Total raw duration before overlap subtraction
  totalRawDuration: 1668,

  // Final output duration: 52 seconds = 1560 frames
  totalDuration: 1560,
} as const;

export type Theme = typeof theme;
export type SpringConfig = typeof springs;
export type EasingConfig = typeof easings;
