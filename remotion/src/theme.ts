import { loadFont } from "@remotion/google-fonts/Manrope";

// Load Manrope - Ultaura's brand font
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

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
    hook: { start: 0, duration: 150 },       // 0-5s
    problem: { start: 150, duration: 210 },   // 5-12s
    solution: { start: 360, duration: 180 },  // 12-18s
    aiCalls: { start: 540, duration: 240 },   // 18-26s
    dashboard: { start: 780, duration: 240 }, // 26-34s
    safety: { start: 1020, duration: 180 },   // 34-40s
    reminders: { start: 1200, duration: 180 },// 40-46s
    cta: { start: 1380, duration: 180 },      // 46-52s
  },

  // Total duration: 52 seconds = 1560 frames
  totalDuration: 1560,
} as const;

export type Theme = typeof theme;
