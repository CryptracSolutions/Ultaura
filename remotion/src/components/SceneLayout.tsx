import React from "react";
import { theme } from "../theme";

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
export const SceneLayout: React.FC<SceneLayoutProps> = ({
  children,
  background,
}) => {
  return (
    <div
      style={{
        width: theme.dimensions.width,
        height: theme.dimensions.height,
        position: "relative",
        overflow: "hidden",
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Background layer */}
      {background && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {background}
        </div>
      )}

      {/* Content layer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
};

interface ContentAreaProps {
  children: React.ReactNode;
  centered?: boolean;
}

/**
 * Main content area - top 65% of screen
 */
export const ContentArea: React.FC<ContentAreaProps> = ({
  children,
  centered = true,
}) => {
  return (
    <div
      style={{
        flex: "0 0 65%",
        display: "flex",
        flexDirection: "column",
        alignItems: centered ? "center" : "flex-start",
        justifyContent: "center",
        padding: "60px 40px 20px",
      }}
    >
      {children}
    </div>
  );
};

interface TextAreaProps {
  children: React.ReactNode;
}

/**
 * Text/subtitle area - bottom 35% of screen
 */
export const TextArea: React.FC<TextAreaProps> = ({ children }) => {
  return (
    <div
      style={{
        flex: "0 0 35%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "20px 50px",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};
