(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/src_i18n_d3813f._.js", {

"[project]/src/i18n/i18n.settings.ts [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "I18N_COOKIE_NAME": ()=>I18N_COOKIE_NAME,
    "default": ()=>__TURBOPACK__default__export__,
    "defaultI18nNamespaces": ()=>defaultI18nNamespaces
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/configuration.ts [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const fallbackLng = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$configuration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].site.locale ?? 'en';
const languages = [
    fallbackLng
];
const I18N_COOKIE_NAME = 'lang';
const defaultI18nNamespaces = [
    'common',
    'auth',
    'organization',
    'profile',
    'subscription',
    'onboarding',
    'voices'
];
function getI18nSettings(language, ns = defaultI18nNamespaces) {
    let lng = language ?? fallbackLng;
    if (!languages.includes(lng)) {
        console.warn(`Language "${lng}" is not supported. Falling back to "${fallbackLng}"`);
        lng = fallbackLng;
    }
    return {
        supportedLngs: languages,
        fallbackLng,
        lng,
        fallbackNS: defaultI18nNamespaces,
        defaultNS: defaultI18nNamespaces,
        ns
    };
}
const __TURBOPACK__default__export__ = getI18nSettings;

})()),
"[project]/src/i18n/i18n.client.tsx [app-client] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {
"use strict";

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$40$23$2e$11$2e$5$2f$node_modules$2f$i18next$2f$dist$2f$esm$2f$i18next$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/i18next@23.11.5/node_modules/i18next/dist/esm/i18next.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$14$2e$1$2e$3_i18next$40$23$2e$11$2e$5_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/react-i18next@14.1.3_i18next@23.11.5_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/react-i18next/dist/es/index.js [app-client] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$14$2e$1$2e$3_i18next$40$23$2e$11$2e$5_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$initReactI18next$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/react-i18next@14.1.3_i18next@23.11.5_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/react-i18next/dist/es/initReactI18next.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$2d$browser$2d$languagedetector$40$7$2e$2$2e$2$2f$node_modules$2f$i18next$2d$browser$2d$languagedetector$2f$dist$2f$esm$2f$i18nextBrowserLanguageDetector$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/i18next-browser-languagedetector@7.2.2/node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$i18n$2e$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/src/i18n/i18n.settings.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$2d$resources$2d$to$2d$backend$40$1$2e$2$2e$1$2f$node_modules$2f$i18next$2d$resources$2d$to$2d$backend$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/i18next-resources-to-backend@1.2.1/node_modules/i18next-resources-to-backend/dist/esm/index.js [app-client] (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
;
;
let promise;
function initializeI18nClient(lng, ns) {
    const settings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$i18n$2e$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(lng, ns);
    if (promise) {
        return promise;
    }
    promise = new Promise((resolve, reject)=>{
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$40$23$2e$11$2e$5$2f$node_modules$2f$i18next$2f$dist$2f$esm$2f$i18next$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].use(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$14$2e$1$2e$3_i18next$40$23$2e$11$2e$5_react$2d$dom$40$18$2e$3$2e$1_react$40$18$2e$3$2e$1_$5f$react$40$18$2e$3$2e$1$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$initReactI18next$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["initReactI18next"]).use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$2d$resources$2d$to$2d$backend$40$1$2e$2$2e$1$2f$node_modules$2f$i18next$2d$resources$2d$to$2d$backend$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])((language, namespace)=>{
            return __turbopack_module_context__({
                "../../public/locales//en/auth.json": {
                    id: ()=>"[project]/public/locales/en/auth.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/auth.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/common.json": {
                    id: ()=>"[project]/public/locales/en/common.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/common.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/onboarding.json": {
                    id: ()=>"[project]/public/locales/en/onboarding.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/onboarding.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/organization.json": {
                    id: ()=>"[project]/public/locales/en/organization.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/organization.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/profile.json": {
                    id: ()=>"[project]/public/locales/en/profile.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/profile.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/subscription.json": {
                    id: ()=>"[project]/public/locales/en/subscription.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/subscription.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales//en/voices.json": {
                    id: ()=>"[project]/public/locales/en/voices.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/voices.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/auth.json": {
                    id: ()=>"[project]/public/locales/en/auth.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/auth.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/common.json": {
                    id: ()=>"[project]/public/locales/en/common.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/common.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/onboarding.json": {
                    id: ()=>"[project]/public/locales/en/onboarding.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/onboarding.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/organization.json": {
                    id: ()=>"[project]/public/locales/en/organization.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/organization.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/profile.json": {
                    id: ()=>"[project]/public/locales/en/profile.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/profile.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/subscription.json": {
                    id: ()=>"[project]/public/locales/en/subscription.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/subscription.json (json, async loader)")(__turbopack_import__)
                },
                "../../public/locales/en/voices.json": {
                    id: ()=>"[project]/public/locales/en/voices.json (json, async loader)",
                    module: ()=>__turbopack_require__("[project]/public/locales/en/voices.json (json, async loader)")(__turbopack_import__)
                }
            }).import(`../../public/locales/${language}/${namespace}.json`);
        })).use(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$2d$browser$2d$languagedetector$40$7$2e$2$2e$2$2f$node_modules$2f$i18next$2d$browser$2d$languagedetector$2f$dist$2f$esm$2f$i18nextBrowserLanguageDetector$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]).init({
            ...settings,
            detection: {
                order: [
                    'htmlTag',
                    'cookie',
                    'navigator'
                ],
                caches: [
                    'cookie'
                ],
                lookupCookie: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$i18n$2e$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["I18N_COOKIE_NAME"]
            },
            interpolation: {
                escapeValue: false
            }
        }, (err)=>{
            if (err) {
                return reject(err);
            }
            resolve(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$i18next$40$23$2e$11$2e$5$2f$node_modules$2f$i18next$2f$dist$2f$esm$2f$i18next$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]);
        });
    });
    return promise;
}
const __TURBOPACK__default__export__ = initializeI18nClient;

})()),
}]);

//# sourceMappingURL=src_i18n_d3813f._.js.map