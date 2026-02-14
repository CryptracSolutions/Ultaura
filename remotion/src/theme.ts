import { loadFont } from "@remotion/google-fonts/Manrope";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const theme = {
  colors: {
    primary: "#0ABAB5",
    primaryDark: "#088A86",
    warmBg: "#F5F5F4",
    darkBg: "#272728",
    white: "#FFFFFF",
    stone50: "#FAFAF9",
    stone100: "#F5F5F4",
    stone200: "#E7E5E4",
    stone800: "#292524",
    stone900: "#1C1917",
    stone950: "#0C0A09",
    cyan400: "#22d3ee",
  },
  fonts: {
    manrope: fontFamily,
  },
} as const;
