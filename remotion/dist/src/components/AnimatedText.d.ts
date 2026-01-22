import React from "react";
interface AnimatedTextProps {
    text: string;
    delay?: number;
    style?: React.CSSProperties;
    className?: string;
    animationType?: "fadeUp" | "fadeIn" | "typewriter" | "scale" | "charReveal" | "wordReveal" | "glowReveal";
    highlightWord?: string;
    highlightColor?: string;
    charDelay?: number;
}
export declare const AnimatedText: React.FC<AnimatedTextProps>;
export {};
//# sourceMappingURL=AnimatedText.d.ts.map