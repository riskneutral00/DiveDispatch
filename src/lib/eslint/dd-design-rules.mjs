/**
 * DiveDispatch design system ESLint rules.
 *
 * These mirror the Claude Code hooks so enforcement works in ANY editor and CI.
 * Escape hatch: {/* design-ok *​/} comment on the same line or parent JSX element.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

const PALETTES =
  'red|blue|green|gray|slate|zinc|neutral|stone|amber|yellow|orange|purple|pink|indigo|violet|teal|cyan|emerald|lime|rose|fuchsia|sky'
const PALETTE_RE = new RegExp(
  `\\b(bg|text|border|ring|from|to|via)-(${PALETTES})-\\d+\\b`,
)
const OFF_LADDER_GAP_RE = /\bgap-(0\.5|2\.5|5)\b/
const BACKWARD_SPACING_RE = /\bp-(5|6|8)\s+(sm|md):p-(3|4)\b/
const RAW_TEXT_SIZE_RE = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/
const HARDCODED_RADIUS_RE = /\brounded-(sm|md|lg|xl|2xl|3xl|none)\b/
const UNPREFIXED_MULTICOL_RE = /(?<!\w:)\bgrid-cols-[2-9]\b/

const JUSTIFIED_DESIGN_OK_RE = /design-ok:\s*\S/

/** Check if a node or any ancestor has a justified design-ok comment (colon + reason) */
function hasDesignOk(node, sourceCode) {
  let current = node
  while (current) {
    const comments = sourceCode.getCommentsBefore(current)
    const commentsAfter = sourceCode.getCommentsAfter(current)
    const allComments = [...comments, ...commentsAfter]
    if (allComments.some((c) => JUSTIFIED_DESIGN_OK_RE.test(c.value))) return true

    // Check inline comments on the same line
    const line = current.loc?.start?.line
    if (line) {
      const lineComments = sourceCode.getAllComments().filter(
        (c) => c.loc.start.line === line && JUSTIFIED_DESIGN_OK_RE.test(c.value),
      )
      if (lineComments.length > 0) return true
    }

    current = current.parent
  }
  return false
}

/** Extract string value from a className JSX attribute (handles literals + template literals) */
function getClassNameString(node) {
  if (!node) return null
  // className="..." — string literal
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  // className={`...`} — template literal
  if (
    node.type === 'JSXExpressionContainer' &&
    node.expression?.type === 'TemplateLiteral'
  ) {
    return node.expression.quasis.map((q) => q.value.raw).join('')
  }
  // className={"..."} — string in expression container
  if (
    node.type === 'JSXExpressionContainer' &&
    node.expression?.type === 'Literal' &&
    typeof node.expression.value === 'string'
  ) {
    return node.expression.value
  }
  return null
}

// ── Rules ────────────────────────────────────────────────────────────────────

/** Rule: no-hardcoded-palette — ban bg-red-500, text-blue-400, etc. */
const noHardcodedPalette = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded Tailwind palette colors; use design tokens.' },
    messages: {
      paletteColor:
        "Hardcoded palette color '{{match}}' — use semantic tokens (text-primary, text-secondary, bg-accent, etc.). Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return
        const val = getClassNameString(node.value)
        if (!val) return
        const match = val.match(PALETTE_RE)
        if (match && !hasDesignOk(node, context.sourceCode)) {
          context.report({ node, messageId: 'paletteColor', data: { match: match[0] } })
        }
      },
    }
  },
}

/** Rule: no-off-ladder-spacing — ban gap-0.5, gap-2.5, gap-5 */
const noOffLadderSpacing = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow off-ladder spacing values.' },
    messages: {
      offLadder:
        "Off-ladder spacing '{{match}}' — use gap-1, gap-1.5, gap-2, gap-3, gap-4, gap-6, gap-8. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
      backward:
        'Backward spacing detected (desktop padding smaller than mobile). Spacing must be additive. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return
        const val = getClassNameString(node.value)
        if (!val) return
        if (hasDesignOk(node, context.sourceCode)) return

        const gapMatch = val.match(OFF_LADDER_GAP_RE)
        if (gapMatch) {
          context.report({ node, messageId: 'offLadder', data: { match: gapMatch[0] } })
        }
        if (BACKWARD_SPACING_RE.test(val)) {
          context.report({ node, messageId: 'backward' })
        }
      },
    }
  },
}

/** Rule: no-bare-form-elements — ban <input>, <select>, <textarea> outside ui/ */
const noBareFormElements = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow bare HTML form elements outside ui/.' },
    messages: {
      bareElement:
        'Bare <{{tag}}> outside src/components/ui/. Use the {{component}} component. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    // Skip ui/ directory (that's where primitives are defined)
    if (filename.includes('/components/ui/')) return {}
    // Skip test files
    if (filename.includes('.test.') || filename.includes('.spec.')) return {}

    const componentMap = { input: 'Input', select: 'Select', textarea: 'Textarea' }

    return {
      JSXOpeningElement(node) {
        const tag = node.name?.name
        if (!tag || !componentMap[tag]) return
        if (hasDesignOk(node, context.sourceCode)) return
        context.report({
          node,
          messageId: 'bareElement',
          data: { tag, component: componentMap[tag] },
        })
      },
    }
  },
}

/** Rule: no-inline-color — ban inline hex/rgb in style props */
const noInlineColor = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow inline hex/rgb colors in style props.' },
    messages: {
      inlineColor:
        'Inline color value in style prop — use CSS variable tokens (var(--color-*)). Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.',
    },
  },
  create(context) {
    return {
      Property(node) {
        // Only check inside style={{ }} JSX attributes
        if (!node.parent?.parent?.type?.startsWith('JSX')) {
          // Walk up to find if we're inside a JSX style attribute
          let current = node.parent
          let inStyleAttr = false
          while (current) {
            if (
              current.type === 'JSXAttribute' &&
              current.name?.name === 'style'
            ) {
              inStyleAttr = true
              break
            }
            current = current.parent
          }
          if (!inStyleAttr) return
        }

        const key = node.key?.name || node.key?.value
        if (!key) return
        const colorProps = ['color', 'background', 'backgroundColor', 'borderColor']
        if (!colorProps.includes(key)) return

        const val = node.value
        if (val?.type !== 'Literal' || typeof val.value !== 'string') return

        if (/^#[0-9a-fA-F]/.test(val.value) || /^rgba?\(/.test(val.value)) {
          if (hasDesignOk(node, context.sourceCode)) return
          context.report({ node, messageId: 'inlineColor' })
        }
      },
    }
  },
}

/** Rule: no-raw-text-size — ban text-sm, text-xs, text-lg etc. in favor of design tokens */
const noRawTextSize = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw Tailwind text sizes; use design tokens (text-body, text-label, text-card-title, text-page-title, text-section-header).' },
    messages: {
      rawSize:
        "Raw text size '{{match}}' — use text-body, text-label, text-card-title, text-page-title, or text-section-header. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (filename.includes('/components/ui/')) return {}
    if (filename.includes('.test.') || filename.includes('.spec.') || filename.includes('.stories.')) return {}

    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return
        const val = getClassNameString(node.value)
        if (!val) return
        const match = val.match(RAW_TEXT_SIZE_RE)
        if (match && !hasDesignOk(node, context.sourceCode)) {
          context.report({ node, messageId: 'rawSize', data: { match: match[0] } })
        }
      },
    }
  },
}

/** Rule: no-hardcoded-radius — ban rounded-sm, rounded-lg etc. in favor of rounded-theme */
const noHardcodedRadius = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded border radius; use rounded-theme or component variant.' },
    messages: {
      hardcodedRadius:
        "Hardcoded radius '{{match}}' — use rounded-theme (maps to --border-radius). Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (filename.includes('/components/ui/')) return {}
    if (filename.includes('.test.') || filename.includes('.spec.') || filename.includes('.stories.')) return {}

    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return
        const val = getClassNameString(node.value)
        if (!val) return
        const match = val.match(HARDCODED_RADIUS_RE)
        if (match && !hasDesignOk(node, context.sourceCode)) {
          context.report({ node, messageId: 'hardcodedRadius', data: { match: match[0] } })
        }
      },
    }
  },
}

/** Rule: no-unprefixed-multicol — ban grid-cols-N (N>1) without responsive prefix */
const noUnprefixedMulticol = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow unprefixed multi-column grid on mobile.' },
    messages: {
      unprefixed:
        "Unprefixed '{{match}}' — mobile must be grid-cols-1. Use sm:grid-cols-N or md:grid-cols-N. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return
        const val = getClassNameString(node.value)
        if (!val) return
        if (val.includes('grid-cols-1')) return
        const match = val.match(UNPREFIXED_MULTICOL_RE)
        if (match && !hasDesignOk(node, context.sourceCode)) {
          context.report({ node, messageId: 'unprefixed', data: { match: match[0] } })
        }
      },
    }
  },
}

/** Rule: no-tokenizable-inline-style — ban style={{ color: 'var(--color-text-primary)' }} when a Tailwind class exists */
const TOKENIZABLE_MAP = {
  color: {
    'var(--color-text-primary)': 'text-primary',
    'var(--color-text-secondary)': 'text-secondary',
    'var(--color-text-on-primary)': 'text-on-primary',
    'var(--color-success)': 'text-success',
    'var(--color-warning)': 'text-warning',
    'var(--color-destructive)': 'text-destructive',
    'var(--color-accent)': 'text-accent',
  },
  background: {
    'var(--color-glass-bg)': 'bg-glass-bg',
    'var(--color-surface)': 'bg-surface',
    'var(--color-surface-elevated)': 'bg-surface-elevated',
    'var(--color-glass-container-bg)': 'bg-glass-container-bg',
    'var(--color-glass-bg-elevated)': 'bg-glass-bg-elevated',
  },
  backgroundColor: {
    'var(--color-glass-bg)': 'bg-glass-bg',
    'var(--color-surface)': 'bg-surface',
    'var(--color-surface-elevated)': 'bg-surface-elevated',
    'var(--color-glass-container-bg)': 'bg-glass-container-bg',
    'var(--color-glass-bg-elevated)': 'bg-glass-bg-elevated',
  },
  borderColor: {
    'var(--color-glass-border)': 'border-glass-border',
    'var(--color-glass-border-elevated)': 'border-glass-border-elevated',
    'var(--color-glass-container-border)': 'border-glass-container-border',
  },
}

const noTokenizableInlineStyle = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Flag inline style props that have Tailwind class equivalents.' },
    messages: {
      tokenizable:
        "Inline style '{{prop}}: {{value}}' has a Tailwind equivalent: className=\"{{className}}\". Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.",
    },
  },
  create(context) {
    return {
      Property(node) {
        let current = node.parent
        let inStyleAttr = false
        while (current) {
          if (
            current.type === 'JSXAttribute' &&
            current.name?.name === 'style'
          ) {
            inStyleAttr = true
            break
          }
          current = current.parent
        }
        if (!inStyleAttr) return

        const key = node.key?.name || node.key?.value
        if (!key || !TOKENIZABLE_MAP[key]) return

        const val = node.value
        if (val?.type !== 'Literal' || typeof val.value !== 'string') return

        const className = TOKENIZABLE_MAP[key][val.value]
        if (!className) return
        if (hasDesignOk(node, context.sourceCode)) return

        context.report({
          node,
          messageId: 'tokenizable',
          data: { prop: key, value: val.value, className },
        })
      },
    }
  },
}

/** Shared: skip files outside the app (ui/, tests, stories, generated). */
function isExemptFile(filename) {
  if (!filename) return true
  if (filename.includes('/components/ui/')) return true
  if (filename.includes('.test.') || filename.includes('.spec.')) return true
  if (filename.includes('.stories.')) return true
  if (filename.includes('/_generated/')) return true
  return false
}

/** Rule: no-raw-button — ban <button> outside ui/. Mirrors raw-button-blocker.sh. */
const noRawButton = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw <button> outside src/components/ui/.' },
    messages: {
      rawButton:
        "Raw <button> outside ui/. Use Button, IconButton, MenuButton, or SaveButton from @/components/ui. Add {/* design-ok: <reason> */} to suppress (DnD handle, compound-control internal).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isExemptFile(filename)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.name !== 'button') return
        if (hasDesignOk(node, context.sourceCode)) return
        context.report({ node, messageId: 'rawButton' })
      },
    }
  },
}

/** Rule: no-raw-label — ban <label> outside ui/. Mirrors raw-primitive-guard.sh. */
const noRawLabel = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw <label> outside src/components/ui/.' },
    messages: {
      rawLabel:
        "Raw <label> outside ui/. Use FieldLabel from @/components/ui/field-shell. Add {/* design-ok: <reason> */} to suppress (compound-control internal).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isExemptFile(filename)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.name !== 'label') return
        if (hasDesignOk(node, context.sourceCode)) return
        context.report({ node, messageId: 'rawLabel' })
      },
    }
  },
}

/** Rule: no-raw-dialog — ban <dialog> outside ui/. Mirrors raw-primitive-guard.sh. */
const noRawDialog = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw <dialog> outside src/components/ui/.' },
    messages: {
      rawDialog:
        "Raw <dialog> outside ui/. Use Dialog or ConfirmActionDialog from @/components/ui. Add {/* design-ok: <reason> */} to suppress.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isExemptFile(filename)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.name !== 'dialog') return
        if (hasDesignOk(node, context.sourceCode)) return
        context.report({ node, messageId: 'rawDialog' })
      },
    }
  },
}

/** Rule: no-raw-anchor-internal — ban <a href="/..."> (internal nav) outside ui/. */
const noRawAnchorInternal = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw <a href="/..."> for internal navigation; use ActionLink.' },
    messages: {
      rawAnchor:
        "Raw <a href=\"/...\"> for internal navigation. Use ActionLink or MenuButton from @/components/ui. External <a href=\"https://...\"> is allowed. Add {/* design-ok: <reason> */} to suppress.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isExemptFile(filename)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.name !== 'a') return
        if (hasDesignOk(node, context.sourceCode)) return
        const hrefAttr = node.attributes?.find(
          (a) => a.type === 'JSXAttribute' && a.name?.name === 'href',
        )
        if (!hrefAttr) return
        const val = hrefAttr.value
        // String literal
        let hrefValue = null
        if (val?.type === 'Literal' && typeof val.value === 'string') {
          hrefValue = val.value
        } else if (
          val?.type === 'JSXExpressionContainer' &&
          val.expression?.type === 'Literal' &&
          typeof val.expression.value === 'string'
        ) {
          hrefValue = val.expression.value
        } else if (
          val?.type === 'JSXExpressionContainer' &&
          val.expression?.type === 'TemplateLiteral' &&
          val.expression.quasis.length > 0
        ) {
          hrefValue = val.expression.quasis[0].value.raw
        }
        if (!hrefValue) return
        // Flag relative/internal: starts with "/" or "#", or no scheme (relative)
        // Allow: starts with "http://", "https://", "mailto:", "tel:"
        if (/^(https?:|mailto:|tel:)/.test(hrefValue)) return
        if (hrefValue.startsWith('/') || hrefValue.startsWith('#') || /^[a-z0-9]/i.test(hrefValue)) {
          context.report({ node, messageId: 'rawAnchor' })
        }
      },
    }
  },
}

// ── Plugin export ────────────────────────────────────────────────────────────

const ddDesignPlugin = {
  meta: { name: 'dd-design', version: '1.0.0' },
  rules: {
    'no-hardcoded-palette': noHardcodedPalette,
    'no-off-ladder-spacing': noOffLadderSpacing,
    'no-bare-form-elements': noBareFormElements,
    'no-inline-color': noInlineColor,
    'no-raw-text-size': noRawTextSize,
    'no-hardcoded-radius': noHardcodedRadius,
    'no-unprefixed-multicol': noUnprefixedMulticol,
    'no-tokenizable-inline-style': noTokenizableInlineStyle,
    'no-raw-button': noRawButton,
    'no-raw-label': noRawLabel,
    'no-raw-dialog': noRawDialog,
    'no-raw-anchor-internal': noRawAnchorInternal,
  },
}

export default ddDesignPlugin
