import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  elevated?: boolean;
  hoverable?: boolean;
  as?: React.ElementType;
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
}: GlassCardProps) {
  return (
    <Tag
      className={[
        elevated ? "glass-elevated" : "glass",
        "relative overflow-hidden shadow-lg shadow-black/10",
        hoverable && "hover:scale-[1.01] hover:shadow-xl cursor-pointer",
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
