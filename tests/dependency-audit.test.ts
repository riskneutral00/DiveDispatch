import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

const HOOK_SCRIPT = path.resolve(
  __dirname,
  '../.claude/hooks/dependency-audit.sh'
)
const WHITELIST_PATH = path.resolve(
  __dirname,
  '../.claude/skills/dependency-audit/whitelist.txt'
)

function runHook(npmCommand: string): { stdout: string; exitCode: number } {
  const hookInput = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: npmCommand },
  })
  try {
    const stdout = execFileSync('bash', [HOOK_SCRIPT], {
      encoding: 'utf-8',
      input: hookInput,
      timeout: 30000,
      env: {
        ...process.env,
        DEPENDENCY_AUDIT_WHITELIST: WHITELIST_PATH,
      },
    })
    return { stdout, exitCode: 0 }
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number }
    return {
      stdout: execError.stdout ?? '',
      exitCode: execError.status ?? 1,
    }
  }
}

function parseDecision(stdout: string): string | null {
  const match = stdout.match(/"decision"\s*:\s*"([^"]+)"/)
  return match ? match[1] : null
}

describe('dependency-audit hook', () => {
  beforeAll(() => {
    execFileSync('chmod', ['+x', HOOK_SCRIPT])
  })

  describe('command detection', () => {
    it('ignores non-npm-install commands', () => {
      const result = runHook('npm run build')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('ignores npm test commands', () => {
      const result = runHook('npm test')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('ignores git commands', () => {
      const result = runHook('git commit -m test')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('ignores npm install without arguments (installs from lockfile)', () => {
      const result = runHook('npm install')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('ignores npm i without arguments', () => {
      const result = runHook('npm i')
      expect(parseDecision(result.stdout)).toBeNull()
    })
  })

  describe('whitelisted packages', () => {
    it('allows react (whitelisted)', () => {
      const result = runHook('npm install react')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows convex (whitelisted)', () => {
      const result = runHook('npm install convex')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows scoped package @clerk/nextjs (whitelisted)', () => {
      const result = runHook('npm install @clerk/nextjs')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows multiple whitelisted packages at once', () => {
      const result = runHook('npm install react convex next')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows npm i shorthand with whitelisted package', () => {
      const result = runHook('npm i react')
      expect(parseDecision(result.stdout)).toBeNull()
    })
  })

  describe('flag handling', () => {
    it('allows whitelisted package with --save-dev flag', () => {
      const result = runHook('npm install --save-dev vitest')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows whitelisted package with -D flag', () => {
      const result = runHook('npm install -D vitest')
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('allows whitelisted package with --save flag', () => {
      const result = runHook('npm install --save react')
      expect(parseDecision(result.stdout)).toBeNull()
    })
  })

  describe('nonexistent packages', () => {
    it('blocks a clearly fake package name', () => {
      const result = runHook('npm install xyzzy-nonexistent-pkg-abc123')
      expect(parseDecision(result.stdout)).toBe('block')
      expect(result.stdout).toContain('xyzzy-nonexistent-pkg-abc123')
    })

    it('blocks a fake package among valid ones', () => {
      const result = runHook('npm install react xyzzy-fake-pkg-999')
      expect(parseDecision(result.stdout)).toBe('block')
      expect(result.stdout).toContain('xyzzy-fake-pkg-999')
    })

    it('includes reason in block response', () => {
      const result = runHook('npm install nonexistent-pkg-zzzz')
      const stdout = result.stdout
      expect(stdout).toContain('"reason"')
      expect(stdout).toContain('nonexistent-pkg-zzzz')
    })
  })

  describe('scoped packages', () => {
    it('handles scoped packages that exist (@types/node)', () => {
      const result = runHook('npm install @types/node')
      // @types/node is whitelisted
      expect(parseDecision(result.stdout)).toBeNull()
    })

    it('blocks nonexistent scoped packages', () => {
      const result = runHook('npm install @fake-org-zzz/fake-pkg-zzz')
      expect(parseDecision(result.stdout)).toBe('block')
    })
  })

  describe('whitelist file', () => {
    it('contains all current package.json dependencies', () => {
      const pkgJson = JSON.parse(
        readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
      )
      const whitelist = readFileSync(WHITELIST_PATH, 'utf-8')
      const whitelistLines = whitelist
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.startsWith('#'))

      const allDeps = [
        ...Object.keys(pkgJson.dependencies ?? {}),
        ...Object.keys(pkgJson.devDependencies ?? {}),
      ]

      for (const dep of allDeps) {
        expect(whitelistLines, `Missing from whitelist: ${dep}`).toContain(
          dep
        )
      }
    })
  })

  describe('settings.json integration', () => {
    it('has the dependency-audit hook registered in settings.json', () => {
      const settings = JSON.parse(
        readFileSync(
          path.resolve(__dirname, '../.claude/settings.json'),
          'utf-8'
        )
      )
      const bashHooks = settings.hooks.PreToolUse.find(
        (entry: { matcher?: string }) => entry.matcher === 'Bash'
      )
      expect(bashHooks).toBeDefined()
      const auditHook = bashHooks.hooks.find(
        (h: { command?: string }) =>
          h.command?.includes('dependency-audit.sh')
      )
      expect(auditHook).toBeDefined()
      expect(auditHook.type).toBe('command')
      expect(auditHook.command).toContain('dependency-audit.sh')
    })
  })
})
