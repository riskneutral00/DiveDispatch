export type ButtonHoverEffect = 'glow-lift' | 'glow' | 'none'
export type IconButtonHoverEffect = 'glow' | 'opacity' | 'none'
export type CardHoverEffect = 'glass-glow' | 'opacity' | 'none'
export type BadgeHoverEffect = 'glass-glow' | 'opacity' | 'none'

export const INTERACTION_DEFAULTS = {
  buttonHover: 'glow-lift' as ButtonHoverEffect,
  iconButtonHover: 'glow' as IconButtonHoverEffect,
  cardHover: 'glass-glow' as CardHoverEffect,
  badgeHover: 'glass-glow' as BadgeHoverEffect,
  dialogMelt: true,
} as const
