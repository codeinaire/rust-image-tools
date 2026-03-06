declare global {
  interface Window {
    // Exposed by ImageConverter.tsx for use in Playwright e2e tests.
    // fmt uses string (not ValidFormat enum) so spec files can pass raw strings.
    // All spec files guard with waitForFunction(() => !!window.__converter)
    // before accessing it, so undefined is intentionally excluded from this type.
    __converter: {
      ensureReady: () => Promise<number>
      detectFormat: (data: Uint8Array) => Promise<string>
      convertImageTimed: (
        data: Uint8Array,
        fmt: string,
      ) => Promise<{ data: Uint8Array; conversionMs: number }>
      getDimensions: (data: Uint8Array) => Promise<{ width: number; height: number }>
    }
  }
}

export {}
