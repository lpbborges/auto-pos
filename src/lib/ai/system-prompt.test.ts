import { describe, it, expect } from 'vitest'
import { getSystemPrompt } from './system-prompt'

describe('getSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(typeof getSystemPrompt()).toBe('string')
    expect(getSystemPrompt().length).toBeGreaterThan(100)
  })

  it('includes the app name', () => {
    expect(getSystemPrompt()).toContain('Auto POS')
  })

  it('mentions key features', () => {
    const prompt = getSystemPrompt()
    expect(prompt).toContain('inventory')
    expect(prompt).toContain('sales')
    expect(prompt).toContain('stock')
  })

  it('instructs the AI to use tools for live data', () => {
    expect(getSystemPrompt()).toContain('tool')
  })

  it('includes create_product confirmation guidance', () => {
    const prompt = getSystemPrompt()
    expect(prompt).toContain('create_product')
    expect(prompt).toContain('Confirma')
  })
})
