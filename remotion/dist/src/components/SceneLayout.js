import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { theme } from "../theme";
/**
 * Standard scene layout with:
 * - Full-screen background layer
 * - Content area (top 70%)
 * - Text/subtitle area (bottom 30%)
 */
export const SceneLayout = ({ children, background, }) => {
    return (_jsxs("div", { style: {
            width: theme.dimensions.width,
            height: theme.dimensions.height,
            position: "relative",
            overflow: "hidden",
            backgroundColor: theme.colors.background,
        }, children: [background && (_jsx("div", { style: { position: "absolute", inset: 0, zIndex: 0 }, children: background })), _jsx("div", { style: {
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }, children: children })] }));
};
/**
 * Main content area - top 65% of screen
 */
export const ContentArea = ({ children, centered = true, }) => {
    return (_jsx("div", { style: {
            flex: "0 0 65%",
            display: "flex",
            flexDirection: "column",
            alignItems: centered ? "center" : "flex-start",
            justifyContent: "center",
            padding: "60px 40px 20px",
        }, children: children }));
};
/**
 * Text/subtitle area - bottom 35% of screen
 */
export const TextArea = ({ children }) => {
    return (_jsx("div", { style: {
            flex: "0 0 35%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "20px 50px",
            textAlign: "center",
        }, children: children }));
};
