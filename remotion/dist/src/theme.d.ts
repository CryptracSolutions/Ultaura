export declare const springs: {
    readonly smooth: {
        readonly damping: 200;
    };
    readonly snappy: {
        readonly damping: 20;
        readonly stiffness: 200;
    };
    readonly bouncy: {
        readonly damping: 8;
        readonly stiffness: 100;
    };
    readonly heavy: {
        readonly damping: 15;
        readonly stiffness: 80;
        readonly mass: 2;
    };
    readonly pop: {
        readonly damping: 12;
        readonly stiffness: 300;
    };
    readonly gentle: {
        readonly damping: 30;
        readonly stiffness: 50;
    };
};
export declare const easings: {
    readonly easeOut: (t: number) => number;
    readonly easeIn: (t: number) => number;
    readonly easeInOut: (t: number) => number;
    readonly easeOutExpo: (t: number) => number;
    readonly easeInOutExpo: (t: number) => number;
    readonly smooth: (t: number) => number;
    readonly snappy: (t: number) => number;
    readonly gentle: (t: number) => number;
};
export declare const theme: {
    readonly colors: {
        readonly primary: "#0ABAB5";
        readonly primaryLight: "#3DD4CF";
        readonly primaryDark: "#089A96";
        readonly background: "#0A0A0F";
        readonly backgroundLight: "#121218";
        readonly backgroundCard: "#1A1A22";
        readonly textPrimary: "#FFFFFF";
        readonly textSecondary: "#A0A0B0";
        readonly textMuted: "#6B6B7B";
        readonly success: "#22C55E";
        readonly warning: "#F59E0B";
        readonly error: "#EF4444";
        readonly info: "#3B82F6";
        readonly gradientStart: "#0ABAB5";
        readonly gradientEnd: "#089A96";
    };
    readonly fonts: {
        readonly heading: string;
        readonly body: string;
    };
    readonly dimensions: {
        readonly width: 1080;
        readonly height: 1920;
    };
    readonly fps: 30;
    readonly sections: {
        readonly hook: {
            readonly start: 0;
            readonly duration: 150;
        };
        readonly problem: {
            readonly start: 150;
            readonly duration: 210;
        };
        readonly solution: {
            readonly start: 360;
            readonly duration: 180;
        };
        readonly aiCalls: {
            readonly start: 540;
            readonly duration: 240;
        };
        readonly dashboard: {
            readonly start: 780;
            readonly duration: 240;
        };
        readonly safety: {
            readonly start: 1020;
            readonly duration: 180;
        };
        readonly reminders: {
            readonly start: 1200;
            readonly duration: 180;
        };
        readonly cta: {
            readonly start: 1380;
            readonly duration: 180;
        };
    };
    readonly totalDuration: 1560;
};
export type Theme = typeof theme;
export type SpringConfig = typeof springs;
export type EasingConfig = typeof easings;
//# sourceMappingURL=theme.d.ts.map