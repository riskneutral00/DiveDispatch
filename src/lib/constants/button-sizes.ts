export const TOUCH_TARGET_CLASS = 'min-h-[44px] min-w-[44px]'

export const BUTTON_SIZE_MAP = {
  sm: `px-3 py-1.5 text-body gap-1.5 ${TOUCH_TARGET_CLASS}`,
  md: `px-4 py-2 text-body gap-2 ${TOUCH_TARGET_CLASS}`,
  lg: `px-6 py-3 text-card-title gap-2 ${TOUCH_TARGET_CLASS}`,
  icon: `p-2 text-body ${TOUCH_TARGET_CLASS}`,
} as const

export type ButtonSize = keyof typeof BUTTON_SIZE_MAP

export const ICON_BUTTON_SIZE = 'w-11 h-11'

export const MENU_BUTTON_SIZE_MAP = {
  sm: 'px-3 py-1.5 text-label min-h-[44px]',
  md: 'px-4 py-2 text-body min-h-[44px]',
} as const

export type MenuButtonSize = keyof typeof MENU_BUTTON_SIZE_MAP
