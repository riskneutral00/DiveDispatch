// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Appearance = Record<string, any>

const TEXT_PRIMARY = 'rgba(255, 255, 255, 0.95)'
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.6)'
const TEXT_MUTED = 'rgba(255, 255, 255, 0.4)'
const PRIMARY = '#60a5fa'
const DESTRUCTIVE = '#dc2626'
const RADIUS = '16px'      // card / container radius
const RADIUS_SM = '10px'   // component radius (buttons, inputs, badges)
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

const INPUT_BG = 'rgba(255, 255, 255, 0.10)'
const INPUT_BORDER = 'rgba(255, 255, 255, 0.25)'
const SOCIAL_BG = 'rgba(255, 255, 255, 0.08)'
const SOCIAL_BORDER = 'rgba(255, 255, 255, 0.2)'
const DIVIDER = 'rgba(255, 255, 255, 0.1)'

const glassInput = {
  background: INPUT_BG,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: RADIUS_SM,
  color: TEXT_PRIMARY,
  fontSize: '14px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  transition: 'all 0.3s ease',
}

export const clerkGlassAppearance: Appearance = {
  variables: {
    colorPrimary: PRIMARY,
    colorText: TEXT_PRIMARY,
    colorTextSecondary: TEXT_SECONDARY,
    colorTextOnPrimaryButton: '#ffffff',
    colorBackground: 'transparent',
    colorInputBackground: INPUT_BG,
    colorInputText: TEXT_PRIMARY,
    colorDanger: DESTRUCTIVE,
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    borderRadius: RADIUS,
    fontFamily: FONT,
    fontSize: '14px',
  },
  elements: {
    card: {
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
      padding: '0',
    },
    cardBox: {
      width: '100%',
      boxShadow: 'none',
    },

    headerTitle: {
      color: TEXT_PRIMARY,
      fontFamily: FONT,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: TEXT_SECONDARY,
    },

    formFieldLabel: {
      color: TEXT_SECONDARY,
      fontSize: '14px',
      fontWeight: '500',
    },

    formFieldInput: glassInput,

    formFieldInputShowPasswordButton: {
      color: TEXT_PRIMARY,
    },

    formButtonPrimary: {
      background: PRIMARY,
      color: '#ffffff',
      border: `1px solid ${PRIMARY}`,
      borderRadius: RADIUS_SM,
      fontWeight: '600',
      fontSize: '14px',
      boxShadow: 'none',
      transition: 'all 0.3s ease',
    },

    socialButtonsIconButton: {
      background: SOCIAL_BG,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${SOCIAL_BORDER}`,
      borderRadius: '12px',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      transition: 'all 0.3s ease',
    },
    socialButtonsBlockButton: {
      background: SOCIAL_BG,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${SOCIAL_BORDER}`,
      borderRadius: '12px',
      color: TEXT_PRIMARY,
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      transition: 'all 0.3s ease',
    },
    socialButtonsBlockButtonText: {
      color: TEXT_PRIMARY,
      fontWeight: '500',
    },

    dividerLine: {
      background: DIVIDER,
    },
    dividerText: {
      color: TEXT_MUTED,
      fontSize: '12px',
    },

    footerAction: {
      paddingTop: '16px',
    },
    footerActionLink: {
      color: PRIMARY,
      fontWeight: '600',
    },
    footerActionText: {
      color: TEXT_SECONDARY,
    },

    identityPreview: {
      background: INPUT_BG,
      border: `1px solid ${INPUT_BORDER}`,
      borderRadius: RADIUS_SM,
    },
    identityPreviewText: {
      color: TEXT_PRIMARY,
    },
    identityPreviewEditButton: {
      color: PRIMARY,
    },

    alert: {
      background: 'rgba(220, 38, 38, 0.1)',
      border: '1px solid rgba(220, 38, 38, 0.3)',
      borderRadius: RADIUS_SM,
    },
    alertText: {
      color: DESTRUCTIVE,
    },

    otpCodeFieldInput: glassInput,

    badge: {
      background: SOCIAL_BG,
      border: `1px solid ${SOCIAL_BORDER}`,
      color: TEXT_MUTED,
      borderRadius: '999px',
    },

    footerPagesLink: {
      color: TEXT_MUTED,
    },
  },
}
