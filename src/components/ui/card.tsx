import React from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  centered?: boolean;
  overflow?: "visible" | "hidden";
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

export function Card({
  children,
  className = '',
  padding = 'md',
  hoverable = false,
  centered = false,
  overflow = 'visible',
  as: Tag = 'div',
  style,
  onClick,
}: CardProps) {
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
        centered && 'text-center',
        overflow === 'hidden' && 'overflow-hidden',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
