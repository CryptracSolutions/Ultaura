import React from "react";
import { useCurrentFrame } from "remotion";
import { theme } from "../theme";

type TypewriterTextProps = {
  text: string;
  delay?: number;
  charsPerFrame?: number;
  fontSize?: number;
  color?: string;
  cursorColor?: string;
  showCursor?: boolean;
};

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  delay = 0,
  charsPerFrame = 0.5,
  fontSize = 28,
  color = theme.colors.stone900,
  cursorColor = theme.colors.primary,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();

  const charCount = Math.min(
    text.length,
    Math.floor(Math.max(0, frame - delay) * charsPerFrame),
  );

  const displayed = text.slice(0, charCount);
  const isTyping = charCount < text.length;
  const cursorOpacity = frame % 20 < 10 ? 1 : 0;

  return (
    <div
      style={{
        fontSize,
        fontFamily: theme.fonts.manrope,
        color,
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      {displayed}
      {(isTyping || showCursor) && (
        <span style={{ color: cursorColor, opacity: cursorOpacity }}>
          {"\u258C"}
        </span>
      )}
    </div>
  );
};
