import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYaml } from 'yaml'

const workflowDir = resolve(__dirname, '..', '.github', 'workflows')

function loadWorkflow(name: string) {
  const filePath = resolve(workflowDir, name)
  expect(existsSync(filePath), `${name} should exist`).toBe(true)
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseYaml(raw)
  return { raw, parsed }
}

describe('GitHub Actions workflows', () => {
  describe('ci.yml', () => {
    it('exists and is valid YAML', () => {
      const { parsed } = loadWorkflow('ci.yml')
      expect(parsed.name).toBe('CI')
    })

    it('triggers on pull requests to main', () => {
      const { parsed } = loadWorkflow('ci.yml')
      expect(parsed.on?.pull_request?.branches).toContain('main')
    })

    it('has install, lint, typecheck, and test steps', () => {
      const { raw } = loadWorkflow('ci.yml')
      expect(raw).toContain('npm ci')
      expect(raw).toContain('npm run lint')
      expect(raw).toMatch(/npx tsc|typecheck/)
      expect(raw).toContain('npm test')
    })

    it('runs on ubuntu-latest', () => {
      const { parsed } = loadWorkflow('ci.yml')
      expect(parsed.jobs.ci['runs-on']).toBe('ubuntu-latest')
    })

    it('uses Node.js 20', () => {
      const { raw } = loadWorkflow('ci.yml')
      expect(raw).toMatch(/node-version.*20/)
    })
  })

  describe('deploy.yml', () => {
    it('exists and is valid YAML', () => {
      const { parsed } = loadWorkflow('deploy.yml')
      expect(parsed.name).toBe('Deploy')
    })

    it('triggers on push to main', () => {
      const { parsed } = loadWorkflow('deploy.yml')
      expect(parsed.on?.push?.branches).toContain('main')
    })

    it('uses Vercel CLI for deployment', () => {
      const { raw } = loadWorkflow('deploy.yml')
      expect(raw).toContain('vercel')
    })

    it('deploys to production', () => {
      const { raw } = loadWorkflow('deploy.yml')
      expect(raw).toContain('--prod')
    })
  })

  describe('rollback.yml', () => {
    it('exists and is valid YAML', () => {
      const { parsed } = loadWorkflow('rollback.yml')
      expect(parsed.name).toBe('Rollback')
    })

    it('supports manual workflow_dispatch with required commit SHA input', () => {
      const { parsed } = loadWorkflow('rollback.yml')
      const inputs = parsed.on.workflow_dispatch.inputs
      expect(inputs.commit_sha.required).toBe(true)
      expect(inputs.commit_sha.type).toBe('string')
    })

    it('checks out the specified commit and deploys', () => {
      const { raw } = loadWorkflow('rollback.yml')
      expect(raw).toContain('commit_sha')
      expect(raw).toContain('vercel')
      expect(raw).toContain('--prod')
    })
  })
})
