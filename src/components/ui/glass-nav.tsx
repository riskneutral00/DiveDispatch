import Link from "next/link";
import React from "react";

interface NavItem {
  key: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface GlassNavProps {
  logo?: React.ReactNode;
  items?: NavItem[];
  activeKey?: string;
  trailing?: React.ReactNode;
  onItemClick?: (item: NavItem) => void;
  className?: string;
}

export function GlassNav({
  logo,
  items = [],
  activeKey,
  trailing,
  onItemClick,
  className = "",
}: GlassNavProps) {
  return (
    <nav
      className={[
        "glass sticky top-0 z-50",
        "flex items-center gap-2 px-4 py-3 sm:px-6",
        "shadow-lg shadow-black/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}
    >
      {logo && <div className="flex-shrink-0 mr-4">{logo}</div>}

      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href ?? "#"}
              onClick={onItemClick ? (e) => { e.preventDefault(); onItemClick(item); } : undefined}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[calc(var(--border-radius)/2)]",
                "text-sm font-medium whitespace-nowrap",
                "transition-all",
                "focus:outline-none focus-visible:ring-2",
              ]
                .filter(Boolean)
                .join(" ")}
              style={isActive ? {
                color: "var(--color-text-primary)",
                background: "var(--color-glass-bg-elevated)",
                backdropFilter: "blur(var(--glass-blur-elevated))",
                WebkitBackdropFilter: "blur(var(--glass-blur-elevated))",
                borderColor: "var(--color-glass-border-elevated)",
                boxShadow: "0 4px 16px var(--color-glass-shadow), inset 0 1px 0 var(--color-glass-specular-subtle)",
                transitionDuration: "var(--transition-speed)",
              } : {
                color: "var(--color-text-secondary)",
                background: "transparent",
                transitionDuration: "var(--transition-speed)",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {trailing && <div className="flex-shrink-0 ml-4">{trailing}</div>}
    </nav>
  );
}
