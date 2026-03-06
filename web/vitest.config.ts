import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use node environment — File and Uint8Array are available natively in Node 20+.
    // The jsdom package requires Node >=20.19 which is newer than our runtime.
    environment: 'node',
    // Only pick up vitest unit tests under tests/unit/
    include: ['tests/unit/**/*.test.ts'],
  },
})
