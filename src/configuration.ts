import type { Provider } from '@supabase/supabase-js';
import { StripeCheckoutDisplayMode } from '~/lib/stripe/types';
import { brandColors } from '~/lib/brand-colors';

const production = process.env.NODE_ENV === 'production';

enum Themes {
  Light = 'light',
  Dark = 'dark',
}

const configuration = {
  site: {
    name: 'Ultaura - AI Voice Companion for Seniors',
    description: 'AI voice companion that provides friendly phone conversations for your elderly loved ones. No app required — just a phone call.',
    themeColor: brandColors.primary,
    themeColorDark: brandColors.primaryDark,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: 'Ultaura',
    twitterHandle: '',
    githubHandle: '',
    convertKitFormId: '',
    locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  },
  auth: {
    // ensure this is the same as your Supabase project. By default - it's true
    requireEmailConfirmation:
      process.env.NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION === 'true',
    // NB: Enable the providers below in the Supabase Console
    // in your production project
    providers: {
      emailPassword: true,
      phoneNumber: false,
      emailLink: false,
      emailOtp: false,
      oAuth: ['google'] as Provider[],
    },
  },
  production,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  theme: Themes.Light,
  features: {
    enableThemeSwitcher: true,
    enableAccountDeletion: getBoolean(
      process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_DELETION,
      false,
    ),
    enableOrganizationDeletion: getBoolean(
      process.env.NEXT_PUBLIC_ENABLE_ORGANIZATION_DELETION,
      false,
    ),
    enableTeamAccounts: getBoolean(
      process.env.NEXT_PUBLIC_ENABLE_TEAM_ACCOUNTS,
      false,
    ),
    enableTeamAccountsBilling: getBoolean(
      process.env.NEXT_PUBLIC_ENABLE_TEAM_ACCOUNTS_BILLING,
      false,
    ),
  },
  paths: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    signInMfa: '/auth/verify',
    onboarding: `/onboarding`,
    appPrefix: '/dashboard',
    appHome: '/dashboard',
    authCallback: '/auth/callback',
    settings: {
      profile: 'settings/profile',
      organization: 'settings/organization',
      subscription: 'settings/subscription',
      authentication: 'settings/profile/authentication',
      email: 'settings/profile/email',
      password: 'settings/profile/password',
    },
  },
  sentry: {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  stripe: {
    embedded: true,
    displayMode: StripeCheckoutDisplayMode.Popup,
    products: [
      {
        name: 'Care',
        description: 'Perfect for staying connected with one loved one',
        badge: '1 Phone Line',
        features: [
          '300 minutes per month',
          '1 phone line',
          'Daily check-in calls',
          'Medication reminders',
          'Email support',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '$39',
            stripePriceId: process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID || 'price_care_monthly',
          },
          {
            name: 'Yearly',
            price: '$399',
            stripePriceId: process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID || 'price_care_annual',
          },
        ],
      },
      {
        name: 'Comfort',
        badge: 'Most Popular',
        recommended: true,
        description: 'Ideal for couples or checking in on two family members',
        features: [
          '900 minutes per month',
          '2 phone lines',
          'Daily check-in calls',
          'Medication reminders',
          'Memory & conversation history',
          'Priority support',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '$99',
            stripePriceId: process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID || 'price_comfort_monthly',
          },
          {
            name: 'Yearly',
            price: '$999',
            stripePriceId: process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID || 'price_comfort_annual',
          },
        ],
      },
      {
        name: 'Family',
        description: 'Best value for larger families with multiple loved ones',
        badge: 'Best Value',
        features: [
          '2,000 minutes per month',
          '4 phone lines',
          'Daily check-in calls',
          'Medication reminders',
          'Memory & conversation history',
          'Safety monitoring & alerts',
          'Dedicated account manager',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '$199',
            stripePriceId: process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID || 'price_family_monthly',
          },
          {
            name: 'Yearly',
            price: '$1,999',
            stripePriceId: process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID || 'price_family_annual',
          },
        ],
      },
      {
        name: 'Pay As You Go',
        description: 'Flexible usage-based billing for occasional check-ins',
        badge: 'Flexible',
        features: [
          'Pay only for what you use',
          '$0.15 per minute',
          'Up to 4 phone lines',
          'Daily check-in calls',
          'Medication reminders',
          'No monthly commitment',
        ],
        plans: [
          {
            name: 'Per Minute',
            price: '$0.15',
            stripePriceId: process.env.STRIPE_ULTAURA_PAYG_PRICE_ID || 'price_payg',
          },
        ],
      },
    ],
  },
};

export default configuration;

// Validate Stripe configuration
// as this is a new requirement, we throw an error if the key is not defined
// in the environment
if (
  configuration.stripe.embedded &&
  production &&
  !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
) {
  throw new Error(
    'The key NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined. Please add it to your environment variables.',
  );
}

function getBoolean(value: unknown, defaultValue: boolean) {
  if (typeof value === 'string') {
    return value === 'true';
  }

  return defaultValue;
}
