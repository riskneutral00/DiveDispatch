import { describe, it, expect, beforeEach } from 'vitest'
import {
  TEST_SLUGS,
  seedUser,
  seedBooking,
} from '../fixtures'
import { makeT } from '../helpers/convex-helpers'
import {
  sanitizeString,
  sanitizeFields,
} from '../../convex/lib/sanitize'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'; DROP TABLE users; --",
  '{{constructor.constructor("return this")()}}',
  '<iframe src="javascript:alert(1)">',
  'javascript:alert(1)',
]

describe('Input sanitization — XSS payloads in booking fields', () => {
  it('stores XSS payloads in booking draftState without error', async () => {
    for (const payload of XSS_PAYLOADS.slice(0, 3)) {
      const t = makeT()
      await t.run(async (ctx) => {
        await seedUser(ctx)
        const bookingId = await seedBooking(ctx, {
          ownerId: TEST_SLUGS.diveCenter,
          status: 'Draft',
        })
        await ctx.db.patch(bookingId, { draftState: JSON.stringify({ notes: payload }) })
        const booking = await ctx.db.get(bookingId)
        const parsed = JSON.parse(booking!.draftState!)
        expect(parsed.notes).toBe(payload)
      })
    }
  })
})

describe('Input sanitization — SQL injection patterns (no-op in Convex but documented)', () => {
  it('SQL injection in string fields is harmless (Convex is not SQL)', async () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; DELETE FROM bookings WHERE 1=1",
      "UNION SELECT * FROM users --",
    ]

    for (const payload of sqlPayloads) {
      const t = makeT()
      await t.run(async (ctx) => {
        const slug = `sql-${Math.random().toString(36).slice(2, 8)}`
        const userId = await seedUser(ctx, {
          name: payload,
          slug,
          tokenIdentifier: `test|${slug}`,
        })
        const user = await ctx.db.get(userId)
        expect(user?.name).toBe(payload)
      })
    }
  })
})

describe('Input sanitization — field length boundaries', () => {
  it('accepts maximum reasonable field lengths', async () => {
    await t.run(async (ctx) => {
      const longName = 'A'.repeat(500)
      const userId = await seedUser(ctx, {
        name: longName,
        slug: 'long-name-test',
        tokenIdentifier: 'test|long-name-test',
      })
      const user = await ctx.db.get(userId)
      expect(user?.name).toBe(longName)
      expect(user?.name?.length).toBe(500)
    })
  })
})

describe('sanitizeString — whitespace trimming', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString(' hello ')).toBe('hello')
  })

  it('trims tabs and newlines', () => {
    expect(sanitizeString('\t hello \n')).toBe('hello')
  })

  it('preserves internal whitespace', () => {
    expect(sanitizeString(' hello world ')).toBe('hello world')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeString('   ')).toBe('')
  })
})

describe('sanitizeString — zero-width / invisible character stripping', () => {
  it('strips zero-width space (U+200B)', () => {
    expect(sanitizeString('a\u200Bb')).toBe('ab')
  })

  it('strips null bytes (U+0000)', () => {
    expect(sanitizeString('a\u0000b')).toBe('ab')
  })

  it('strips right-to-left override (U+202E)', () => {
    expect(sanitizeString('a\u202Eb')).toBe('ab')
  })

  it('preserves zero-width joiner (U+200D) — required for compound emoji', () => {
    expect(sanitizeString('a\u200Db')).toBe('a\u200Db')
    const familyEmoji = '👨\u200D👩\u200D👧\u200D👦'
    expect(sanitizeString(familyEmoji)).toBe(familyEmoji)
  })

  it('strips soft hyphen (U+00AD)', () => {
    expect(sanitizeString('hel\u00ADlo')).toBe('hello')
  })

  it('preserves zero-width non-joiner (U+200C) — required for Farsi/Indic scripts', () => {
    expect(sanitizeString('a\u200Cb')).toBe('a\u200Cb')
  })

  it('preserves variation selectors (U+FE0F) — controls emoji presentation', () => {
    expect(sanitizeString('❤\uFE0F')).toBe('❤\uFE0F')
  })

  it('strips BOM / FEFF', () => {
    expect(sanitizeString('\uFEFFhello')).toBe('hello')
  })
})

describe('sanitizeString — length capping', () => {
  it('truncates strings exceeding maxLength', () => {
    const input = 'x'.repeat(1000)
    expect(sanitizeString(input, 500)).toBe('x'.repeat(500))
    expect(sanitizeString(input, 500).length).toBe(500)
  })

  it('does not truncate strings within maxLength', () => {
    expect(sanitizeString('hello', 500)).toBe('hello')
  })

  it('truncates after stripping (so final length is accurate)', () => {
    const input = 'a\u200Bb\u200Bc\u200Bde'
    expect(sanitizeString(input, 10)).toBe('abcde')
  })

  it('truncates to exact maxLength when stripped content is longer', () => {
    const input = 'x'.repeat(300)
    const result = sanitizeString(input, 200)
    expect(result.length).toBe(200)
  })

  it('does not split surrogate pairs when truncating (grapheme-safe)', () => {
    const input = '🤿'.repeat(10)
    const result = sanitizeString(input, 5)
    expect(Array.from(result).length).toBe(5)
    expect(result).toBe('🤿🤿🤿🤿🤿')
  })
})

describe('sanitizeString — NFC normalization', () => {
  it('normalizes decomposed accents to NFC', () => {
    const nfd = 'e\u0301'
    const nfc = '\u00E9'
    expect(sanitizeString(nfd)).toBe(nfc)
  })
})

describe('sanitizeString — international characters preserved', () => {
  it('preserves Thai characters', () => {
    const thai = 'สวัสดีครับ'
    expect(sanitizeString(thai)).toBe(thai)
  })

  it('preserves Chinese characters', () => {
    const chinese = '你好世界'
    expect(sanitizeString(chinese)).toBe(chinese)
  })

  it('preserves Arabic characters', () => {
    const arabic = 'مرحبا'
    expect(sanitizeString(arabic)).toBe(arabic)
  })

  it('preserves emoji', () => {
    expect(sanitizeString('🤿🐠🦈')).toBe('🤿🐠🦈')
  })

  it('preserves Farsi text with ZWNJ', () => {
    const farsi = 'می\u200Cخواهم'
    expect(sanitizeString(farsi)).toBe(farsi)
  })

  it('preserves compound emoji with ZWJ sequences', () => {
    const familyEmoji = '👨\u200D👩\u200D👧\u200D👦'
    expect(sanitizeString(familyEmoji)).toBe(familyEmoji)
  })

  it("preserves O'Brien (apostrophe in names)", () => {
    expect(sanitizeString("O'Brien")).toBe("O'Brien")
  })

  it('preserves hyphenated names', () => {
    expect(sanitizeString('Mary-Jane')).toBe('Mary-Jane')
  })

  it('preserves accented Latin characters', () => {
    expect(sanitizeString('José García')).toBe('José García')
  })
})

describe('sanitizeFields — object sanitization', () => {
  it('sanitizes configured string fields', () => {
    const input = { name: ' hello ', email: ' test@example.com ', age: 30 }
    const config = { name: 200, email: 254 }
    const result = sanitizeFields(input, config)
    expect(result.name).toBe('hello')
    expect(result.email).toBe('test@example.com')
    expect(result.age).toBe(30)
  })

  it('does not mutate the original object', () => {
    const input = { name: ' hello ' }
    const config = { name: 200 }
    sanitizeFields(input, config)
    expect(input.name).toBe(' hello ')
  })

  it('skips fields not in config', () => {
    const input = { name: ' hello ', extra: ' world ' }
    const config = { name: 200 }
    const result = sanitizeFields(input, config)
    expect(result.extra).toBe(' world ')
  })

  it('skips config fields not in object', () => {
    const input = { name: ' hello ' }
    const config = { name: 200, email: 254 }
    const result = sanitizeFields(input, config)
    expect(result.name).toBe('hello')
    expect('email' in result).toBe(false)
  })

  it('applies maxLength from config', () => {
    const input = { name: 'x'.repeat(300) }
    const config = { name: 200 }
    const result = sanitizeFields(input, config)
    expect(result.name).toBe('x'.repeat(200))
  })

  it('handles undefined string values gracefully', () => {
    const input = { name: undefined, email: 'test@test.com' }
    const config = { name: 200, email: 254 }
    const result = sanitizeFields(input, config)
    expect(result.name).toBeUndefined()
    expect(result.email).toBe('test@test.com')
  })
})
