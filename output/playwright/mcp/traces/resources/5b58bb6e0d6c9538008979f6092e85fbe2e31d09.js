(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/[root of the server]__225970._.js", {

"[project]/src/core/generic/is-browser.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
function isBrowser() {
    return typeof window !== 'undefined';
}
const __TURBOPACK__default__export__ = isBrowser;

})()),
"[project]/src/lib/stripe/types.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "StripeCheckoutDisplayMode": ()=>StripeCheckoutDisplayMode
});
let StripeCheckoutDisplayMode;
(function(StripeCheckoutDisplayMode) {
    StripeCheckoutDisplayMode["Popup"] = "popup";
    StripeCheckoutDisplayMode["Overlay"] = "overlay";
})(StripeCheckoutDisplayMode || (StripeCheckoutDisplayMode = {}));

})()),
"[project]/src/lib/brand-colors.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

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
 */ __turbopack_esm__({
    "brandColors": ()=>brandColors
});
const brandColors = {
    /** Tiffany Blue - Primary brand color */ primary: '#0ABAB5',
    /** Darker Tiffany Blue - For dark mode or hover states */ primaryDark: '#088A86',
    /** Stone colors - Warm neutrals */ stone: {
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
        950: '#0C0A09'
    },
    /** Pure colors for high contrast contexts like emails */ white: '#FFFFFF',
    black: '#000000',
    /** Border color matching the design system */ border: '#E7E5E4'
};

})()),
"[project]/src/configuration.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stripe$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/lib/stripe/types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$brand$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/lib/brand-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@14.2.5_@opentelemetry+api@1.9.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
const production = ("TURBOPACK compile-time value", "development") === 'production';
let Themes;
(function(Themes) {
    Themes["Light"] = "light";
    Themes["Dark"] = "dark";
})(Themes || (Themes = {}));
const configuration = {
    site: {
        name: 'Ultaura - AI Voice Companion for Seniors',
        description: 'AI voice companion that provides friendly phone conversations for your elderly loved ones. No app required — just a phone call.',
        themeColor: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$brand$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["brandColors"].primary,
        themeColorDark: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$brand$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["brandColors"].primaryDark,
        siteUrl: ("TURBOPACK compile-time value", "http://localhost:3000"),
        siteName: 'Ultaura',
        twitterHandle: '',
        githubHandle: '',
        convertKitFormId: '',
        locale: ("TURBOPACK compile-time value", "en")
    },
    auth: {
        // ensure this is the same as your Supabase project. By default - it's true
        requireEmailConfirmation: ("TURBOPACK compile-time value", "true") === 'true',
        // NB: Enable the providers below in the Supabase Console
        // in your production project
        providers: {
            emailPassword: true,
            phoneNumber: false,
            emailLink: false,
            emailOtp: false,
            oAuth: [
                'google'
            ]
        }
    },
    production,
    environment: ("TURBOPACK compile-time value", "development"),
    theme: "light",
    features: {
        enableThemeSwitcher: true,
        enableAccountDeletion: getBoolean(("TURBOPACK compile-time value", "true"), false),
        enableOrganizationDeletion: getBoolean(("TURBOPACK compile-time value", "true"), false),
        enableTeamAccounts: getBoolean(("TURBOPACK compile-time value", "false"), false),
        enableTeamAccountsBilling: getBoolean(("TURBOPACK compile-time value", "false"), false)
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
            password: 'settings/profile/password'
        }
    },
    sentry: {
        dsn: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_SENTRY_DSN
    },
    stripe: {
        embedded: true,
        displayMode: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stripe$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StripeCheckoutDisplayMode"].Popup,
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
                    'Email support'
                ],
                plans: [
                    {
                        name: 'Monthly',
                        price: '$39',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID || 'price_care_monthly'
                    },
                    {
                        name: 'Yearly',
                        price: '$399',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID || 'price_care_annual'
                    }
                ]
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
                    'Priority support'
                ],
                plans: [
                    {
                        name: 'Monthly',
                        price: '$99',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID || 'price_comfort_monthly'
                    },
                    {
                        name: 'Yearly',
                        price: '$999',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID || 'price_comfort_annual'
                    }
                ]
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
                    'Dedicated account manager'
                ],
                plans: [
                    {
                        name: 'Monthly',
                        price: '$199',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID || 'price_family_monthly'
                    },
                    {
                        name: 'Yearly',
                        price: '$1,999',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID || 'price_family_annual'
                    }
                ]
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
                    'No monthly commitment'
                ],
                plans: [
                    {
                        name: 'Per Minute',
                        price: '$0.15',
                        stripePriceId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.STRIPE_ULTAURA_PAYG_PRICE_ID || 'price_payg'
                    }
                ]
            }
        ]
    }
};
const __TURBOPACK__default__export__ = configuration;
// Validate Stripe configuration
// as this is a new requirement, we throw an error if the key is not defined
// in the environment
const isBuildPhase = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PHASE === 'phase-production-build';
if (configuration.stripe.embedded && production && !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !isBuildPhase) {
    throw new Error('The key NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined. Please add it to your environment variables.');
}
function getBoolean(value, defaultValue) {
    if (typeof value === 'string') {
        return value === 'true';
    }
    return defaultValue;
}

})()),
"[project]/src/core/generic/cookies.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "getCookie": ()=>getCookie,
    "setCookie": ()=>setCookie
});
function getCookie(name) {
    const cookieDict = document.cookie.split(';').map((x)=>x.split('=')).reduce((accum, current)=>{
        accum[current[0].trim()] = current[1];
        return accum;
    }, Object());
    return cookieDict[name];
}
function setCookie(name, value, options = {
    path: '/',
    sameSite: 'lax',
    expires: undefined,
    httpOnly: false
}) {
    let cookieText = `${name}=${value};`;
    if (options.path) {
        cookieText += ` Path=${options.path};`;
    }
    if (options.expires) {
        cookieText += ` Expires=${options.expires};`;
    }
    if (options.sameSite) {
        cookieText += ` SameSite=${options.sameSite};`;
    }
    if (options.httpOnly) {
        cookieText += ` HttpOnly;`;
    }
    document.cookie = cookieText;
}

})()),
"[project]/src/core/theming.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "DARK_THEME_CLASSNAME": ()=>DARK_THEME_CLASSNAME,
    "LIGHT_THEME_CLASSNAME": ()=>LIGHT_THEME_CLASSNAME,
    "SYSTEM_THEME_CLASSNAME": ()=>SYSTEM_THEME_CLASSNAME,
    "getStoredTheme": ()=>getStoredTheme,
    "isDarkSystemTheme": ()=>isDarkSystemTheme,
    "loadSelectedTheme": ()=>loadSelectedTheme,
    "setTheme": ()=>setTheme
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/configuration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$generic$2f$cookies$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/core/generic/cookies.ts [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
const THEME_KEY = `theme`;
const LIGHT_THEME_META_COLOR = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].site.themeColor;
const DARK_THEME_META_COLOR = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].site.themeColorDark;
const DEFAULT_THEME = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].theme;
const DARK_THEME_CLASSNAME = `dark`;
const LIGHT_THEME_CLASSNAME = `light`;
const SYSTEM_THEME_CLASSNAME = 'system';
function getStoredTheme() {
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$generic$2f$cookies$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCookie"])(THEME_KEY) ?? DEFAULT_THEME;
    } catch (e) {
        return DEFAULT_THEME;
    }
}
function setTheme(theme) {
    const root = getHtml();
    const setThemeCookie = (value)=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$generic$2f$cookies$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setCookie"])(THEME_KEY, value, {
            path: '/'
        });
    };
    root.classList.remove(DARK_THEME_CLASSNAME);
    root.classList.remove(LIGHT_THEME_CLASSNAME);
    switch(theme){
        case SYSTEM_THEME_CLASSNAME:
            setThemeCookie(SYSTEM_THEME_CLASSNAME);
            if (isDarkSystemTheme()) {
                root.classList.add(DARK_THEME_CLASSNAME);
                setMetaTag(DARK_THEME_META_COLOR);
            } else {
                setMetaTag(LIGHT_THEME_META_COLOR);
            }
            return;
        case DARK_THEME_CLASSNAME:
            root.classList.add(DARK_THEME_CLASSNAME);
            setMetaTag(DARK_THEME_META_COLOR);
            setThemeCookie(DARK_THEME_CLASSNAME);
            return;
        case LIGHT_THEME_CLASSNAME:
            setMetaTag(LIGHT_THEME_META_COLOR);
            setThemeCookie(LIGHT_THEME_CLASSNAME);
            return;
    }
}
function getHtml() {
    return document.firstElementChild;
}
function getThemeMetaTag() {
    return document.querySelector(`meta[name='theme-color']`);
}
function setMetaTag(value) {
    const callback = ()=>{
        let tag = getThemeMetaTag();
        if (tag) {
            tag.setAttribute('content', value);
        } else {
            tag = document.createElement('meta');
            tag.setAttribute('name', 'theme-color');
            tag.setAttribute('content', value);
            document.head.appendChild(tag);
        }
    };
    if (document.readyState === 'complete') {
        callback();
    } else {
        document.addEventListener('DOMContentLoaded', callback);
    }
}
function isDarkSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function loadSelectedTheme() {
    setTheme(getStoredTheme());
}

})()),
"[project]/src/components/ThemeSetter.tsx [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@14.2.5_@opentelemetry+api@1.9.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$generic$2f$is$2d$browser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/core/generic/is-browser.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$theming$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/core/theming.ts [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
var _s = __turbopack_refresh__.signature();
'use client';
;
;
;
function ThemeSetter() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$generic$2f$is$2d$browser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])()) {
            return;
        }
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const applySystemTheme = ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$theming$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setTheme"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$core$2f$theming$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SYSTEM_THEME_CLASSNAME"]);
        };
        // Ensure the current OS theme is applied on mount.
        applySystemTheme();
        // Keep in sync when the OS theme changes.
        const handler = ()=>applySystemTheme();
        // Some browsers (notably older Safari) may expose addEventListener but not
        // implement it reliably for MediaQueryList. Subscribe using both APIs.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
        }
        // Safari < 14
        if (typeof mql.addListener === 'function') {
            mql.addListener(handler);
        }
        return ()=>{
            if (typeof mql.removeEventListener === 'function') {
                mql.removeEventListener('change', handler);
            }
            // Safari < 14
            if (typeof mql.removeListener === 'function') {
                mql.removeListener(handler);
            }
        };
    }, []);
    return null;
}
_s(ThemeSetter, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = ThemeSetter;
const __TURBOPACK__default__export__ = ThemeSetter;
var _c;
__turbopack_refresh__.register(_c, "ThemeSetter");

})()),
"[next]/internal/font/google/manrope_845da2a1.module.css [app-client] (css module)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname }) => (() => {

__turbopack_export_value__({
  "className": "manrope_845da2a1-module__aHmpqG__className",
  "variable": "manrope_845da2a1-module__aHmpqG__variable",
});

})()),
"[next]/internal/font/google/manrope_845da2a1.js [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_import__("[next]/internal/font/google/manrope_845da2a1.module.css [app-client] (css module)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const fontData = {
    className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].className,
    style: {
        fontFamily: "'__Manrope_845da2', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontStyle: "normal"
    }
};
if (__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].variable != null) {
    fontData.variable = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].variable;
}
const __TURBOPACK__default__export__ = fontData;

})()),
"[next]/internal/font/google/jetbrains_mono_726660c.module.css [app-client] (css module)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname }) => (() => {

__turbopack_export_value__({
  "className": "jetbrains_mono_726660c-module__ZQ4Aqq__className",
  "variable": "jetbrains_mono_726660c-module__ZQ4Aqq__variable",
});

})()),
"[next]/internal/font/google/jetbrains_mono_726660c.js [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_import__("[next]/internal/font/google/jetbrains_mono_726660c.module.css [app-client] (css module)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const fontData = {
    className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].className,
    style: {
        fontFamily: "'__JetBrains_Mono_726660', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        fontStyle: "normal"
    }
};
if (__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].variable != null) {
    fontData.variable = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].variable;
}
const __TURBOPACK__default__export__ = fontData;

})()),
"[project]/src/components/Fonts.tsx [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[next]/internal/font/google/manrope_845da2a1.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[next]/internal/font/google/jetbrains_mono_726660c.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@14.2.5_@opentelemetry+api@1.9.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@14.2.5_@opentelemetry+api@1.9.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/navigation.js [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
var _s = __turbopack_refresh__.signature();
'use client';
;
// Use the sans font for headings by default
const heading = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"];
function Fonts() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useServerInsertedHTML"])(()=>{
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("style", {
            dangerouslySetInnerHTML: {
                __html: `
          :root {
            --font-family-sans: 'Manrope', ${__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$manrope_845da2a1$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].style.fontFamily}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            --font-family-heading: 'Manrope', ${heading.style.fontFamily}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            --font-family-mono: 'JetBrains Mono', ${__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$jetbrains_mono_726660c$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          }
        `
            }
        }, 'fonts', false, {
            fileName: "[project]/src/components/Fonts.tsx",
            lineNumber: 28,
            columnNumber: 7
        }, this);
    });
    return null;
}
_s(Fonts, "X3clMt6GybD9ifYpSoKx4XyCFnA=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$14$2e$2$2e$5_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useServerInsertedHTML"]
    ];
});
_c = Fonts;
const __TURBOPACK__default__export__ = Fonts;
var _c;
__turbopack_refresh__.register(_c, "Fonts");

})()),
"[project]/src/app/layout.tsx [app-rsc] (ecmascript, Next.js server component, client modules)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname }) => (() => {


})()),
}]);

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__225970._.js.map