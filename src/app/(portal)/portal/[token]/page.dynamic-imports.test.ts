import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SOURCE = readFileSync(
  resolve(__dirname, 'page.tsx'),
  'utf-8',
)

describe('DD-075: portal page dynamic imports', () => {
  it('keeps StepContact as a static import', () => {
    expect(SOURCE).toMatch(
      /^import\s+\{.*StepContact.*\}\s+from\s+/m,
    )
  })

  const dynamicComponents = [
    'StepMedical',
    'StepWaiver',
    'StepEquipment',
    'StepSafety',
    'PortalSubmit',
  ]

  for (const name of dynamicComponents) {
    it(`loads ${name} via next/dynamic with ssr: false`, () => {
      // Should NOT have a static import for this component
      const staticImportPattern = new RegExp(
        `^import\\s+\\{[^}]*${name}[^}]*\\}\\s+from\\s+`,
        'm',
      )
      expect(SOURCE).not.toMatch(staticImportPattern)

      // Should have a dynamic() call for this component
      const dynamicPattern = new RegExp(
        `const\\s+${name}\\s*=\\s*dynamic\\(`,
      )
      expect(SOURCE).toMatch(dynamicPattern)

      // Should use ssr: false
      // Look for the dynamic() call block containing ssr: false
      const dynamicBlock = SOURCE.match(
        new RegExp(`const\\s+${name}\\s*=\\s*dynamic\\([\\s\\S]*?\\)\\s*\\)`, 'm'),
      )
      expect(dynamicBlock).not.toBeNull()
      expect(dynamicBlock![0]).toContain('ssr: false')
    })

    it(`shows PortalStepLoading as loading fallback for ${name}`, () => {
      const dynamicBlock = SOURCE.match(
        new RegExp(`const\\s+${name}\\s*=\\s*dynamic\\([\\s\\S]*?\\)\\s*\\)`, 'm'),
      )
      expect(dynamicBlock).not.toBeNull()
      expect(dynamicBlock![0]).toMatch(
        /loading:\s*\(\)\s*=>\s*<PortalStepLoading\s*\/>/,
      )
    })
  }

  it('imports next/dynamic', () => {
    expect(SOURCE).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })
})
