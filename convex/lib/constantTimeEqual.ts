/**
 * Constant-time comparison for two Uint8Array buffers.
 *
 * Uses XOR accumulation to avoid short-circuit evaluation, preventing
 * timing side-channel attacks on HMAC signature verification.
 *
 * Works in any JavaScript runtime (Web Crypto, Node.js, Convex V8 isolate).
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!
  }
  return result === 0
}
