import React from 'react'
import { cn } from '@/lib/utils/cn'

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  as?: React.ElementType
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export function GlassCard({
  children,
  className = '',
  padding = 'md',
  hoverable = false,
  as: Tag = 'div',
  style,
  onClick,
}: GlassCardProps) {
  return (
    <Tag
      style={style}
      onClick={onClick}
      {...(Tag === 'button' ? { type: 'button' } : {})}
      className={cn(
        'glass-container',
        hoverable && 'glass-surface cursor-pointer',
        'relative',
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
