/**
 * Ultaura Brand Colors
 *
 * Central source of truth for brand colors used across the application.
 * Use these constants for:
 * - Email templates (which can't use CSS custom properties)
 * - Meta tags and browser theme colors
 * - Any context where CSS variables aren't available
 *
 * For regular component styling, prefer Tailwind classes (bg-primary, text-primary, etc.)
 * which reference the CSS custom properties defined in globals.css
 */

export const brandColors = {
  /** Tiffany Blue - Primary brand color */
  primary: '#0ABAB5',

  /** Darker Tiffany Blue - For dark mode or hover states */
  primaryDark: '#088A86',

  /** Stone colors - Warm neutrals */
  stone: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
    950: '#0C0A09',
  },

  /** Pure colors for high contrast contexts like emails */
  white: '#FFFFFF',
  black: '#000000',

  /** Border color matching the design system */
  border: '#E7E5E4', // stone-200
} as const;

export type BrandColors = typeof brandColors;
