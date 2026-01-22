import React from "react";
interface SceneLayoutProps {
    children: React.ReactNode;
    background?: React.ReactNode;
}
/**
 * Standard scene layout with:
 * - Full-screen background layer
 * - Content area (top 70%)
 * - Text/subtitle area (bottom 30%)
 */
export declare const SceneLayout: React.FC<SceneLayoutProps>;
interface ContentAreaProps {
    children: React.ReactNode;
    centered?: boolean;
}
/**
 * Main content area - top 65% of screen
 */
export declare const ContentArea: React.FC<ContentAreaProps>;
interface TextAreaProps {
    children: React.ReactNode;
}
/**
 * Text/subtitle area - bottom 35% of screen
 */
export declare const TextArea: React.FC<TextAreaProps>;
export {};
//# sourceMappingURL=SceneLayout.d.ts.map