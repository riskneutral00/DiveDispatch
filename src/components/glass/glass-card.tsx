import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  elevated?: boolean;
  hoverable?: boolean;
  as?: React.ElementType;
  style?: React.CSSProperties;
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function GlassCard({
  children,
  className = "",
  padding = "md",
  elevated = false,
  hoverable = false,
  as: Tag = "div",
  style,
}: GlassCardProps) {
  return (
    <Tag
      style={style}
      className={[
        elevated ? "glass-elevated" : "glass",
        "relative",
        hoverable && "hover:scale-[1.01] cursor-pointer",
        paddingMap[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
