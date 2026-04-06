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

/** Check if a node or any ancestor has a design-ok comment */
function hasDesignOk(node, sourceCode) {
  let current = node
  while (current) {
    const comments = sourceCode.getCommentsBefore(current)
    const commentsAfter = sourceCode.getCommentsAfter(current)
    const allComments = [...comments, ...commentsAfter]
    if (allComments.some((c) => c.value.includes('design-ok'))) return true

    // Check inline comments on the same line
    const line = current.loc?.start?.line
    if (line) {
      const lineComments = sourceCode.getAllComments().filter(
        (c) => c.loc.start.line === line && c.value.includes('design-ok'),
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

/** Find the className attribute value string for a JSX element */
function getClassNameFromElement(jsxNode) {
  const attr = jsxNode.attributes?.find(
    (a) => a.type === 'JSXAttribute' && a.name?.name === 'className',
  )
  if (!attr?.value) return null
  return getClassNameString(attr.value)
}

// ── Rules ────────────────────────────────────────────────────────────────────

/** Rule: no-hardcoded-palette — ban bg-red-500, text-blue-400, etc. */
const noHardcodedPalette = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded Tailwind palette colors; use design tokens.' },
    messages: {
      paletteColor:
        "Hardcoded palette color '{{match}}' — use semantic tokens (text-primary, text-secondary, bg-accent, etc.). Add {/* design-ok */} to suppress.",
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
        "Off-ladder spacing '{{match}}' — use gap-1, gap-1.5, gap-2, gap-3, gap-4, gap-6, gap-8. Add {/* design-ok */} to suppress.",
      backward:
        'Backward spacing detected (desktop padding smaller than mobile). Spacing must be additive. Add {/* design-ok */} to suppress.',
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
        'Bare <{{tag}}> outside src/components/ui/. Use the {{component}} component. Add {/* design-ok */} to suppress.',
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
        'Inline color value in style prop — use CSS variable tokens (var(--color-*)). Add {/* design-ok */} to suppress.',
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

// ── Plugin export ────────────────────────────────────────────────────────────

export default {
  meta: { name: 'dd-design', version: '1.0.0' },
  rules: {
    'no-hardcoded-palette': noHardcodedPalette,
    'no-off-ladder-spacing': noOffLadderSpacing,
    'no-bare-form-elements': noBareFormElements,
    'no-inline-color': noInlineColor,
  },
}
