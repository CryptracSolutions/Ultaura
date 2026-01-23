import { loadFont } from "@remotion/google-fonts/Manrope";
import { Easing } from "remotion";

// Load Manrope - Ultaura's brand font
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Transition configuration (30fps) - faster for TikTok/Reels pacing
export const TRANSITION_DURATION_FRAMES = 15; // 0.5s (was 0.6s)
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
    surface: "#1A1A22",

    // Text
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0B0",
    textMuted: "#6B6B7B",

    // Semantic
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // Accent for variety
    accent: "#8B5CF6",

    // Gradients
    gradientStart: "#0ABAB5",
    gradientEnd: "#089A96",
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

  // Section timings in frames (at 30fps) - optimized for TikTok/Reels pacing
  sections: {
    hook: { start: 0, duration: 150 },               // 5s (was 6s)
    voiceSelection: { start: 150, duration: 165 },   // 5.5s (was 7s)
    reminders: { start: 315, duration: 165 },        // 5.5s (was 7s)
    schedule: { start: 480, duration: 165 },         // 5.5s (was 7s)
    insightsSafety: { start: 645, duration: 240 },   // 8s (was 12s)
    calls: { start: 885, duration: 210 },            // 7s (was 9s)
    cta: { start: 1095, duration: 210 },             // 7s (was 7.6s)
  },

  // Total raw duration before overlap subtraction
  totalRawDuration: 1305,

  // Final output duration: ~40.5 seconds = 1215 frames (was 52s/1560f)
  totalDuration: 1215,
} as const;

export type Theme = typeof theme;
export type SpringConfig = typeof springs;
export type EasingConfig = typeof easings;
