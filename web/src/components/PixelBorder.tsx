"use client";

interface PixelBorderProps {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export default function PixelBorder({
  children,
  className = "",
  highlight = false,
}: PixelBorderProps) {
  return (
    <div
      className={`
        bg-bg-panel border-2 border-border-light
        ${highlight ? "shadow-pixel-raised" : "shadow-pixel"}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
