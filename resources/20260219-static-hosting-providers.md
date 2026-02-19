# Static Website Hosting Providers

Comparison of the main free-tier platforms for hosting a static web app — relevant when deploying this project (a Parcel-bundled TypeScript + WASM site with no server-side component).

## What Matters for This Project

- **WASM MIME type** — browsers refuse to execute WASM unless the server sends `Content-Type: application/wasm`. All four platforms do this correctly.
- **Custom response headers** — needed to set `Cross-Origin-Opener-Policy` (COOP) and `Cross-Origin-Embedder-Policy` (COEP) if `SharedArrayBuffer` is ever required. Currently this project uses regular Web Workers (no shared memory), so it is not required yet, but worth knowing which platforms support it.
- **Bandwidth** — image files are large. A user uploading a 20 MB TIFF and downloading a 15 MB PNG is 35 MB of transfer per conversion. Free-tier bandwidth limits matter.
- **Build pipeline** — the site needs `wasm-pack build` (Rust toolchain) before `parcel build`. Not all platforms have Rust pre-installed.
- **PR preview deployments** — useful for reviewing UI changes before merging.

## Platform Comparison

### Cloudflare Pages

- **Free tier**: Unlimited requests, **no bandwidth cap**, 500 builds/month, unlimited sites
- **CDN**: Cloudflare's global network (300+ PoPs worldwide) — the largest of the four
- **Custom headers**: Yes — via a `_headers` file in the publish directory. Full COOP/COEP support.
- **Custom domains**: Yes, free, with automatic HTTPS
- **PR previews**: Yes — every push to a non-production branch gets a unique preview URL
- **Rust in build**: Not pre-installed. Must install via build command: `curl https://sh.rustup.rs -sSf | sh -s -- -y && ...`
- **WASM MIME type**: Correct (`application/wasm`) out of the box
- **Analytics**: Basic web analytics included free (page views, visitors — no JS required on the visitor side)
- **Best for**: High-traffic static sites; projects where bandwidth cost on other platforms would be a concern; projects needing COOP/COEP headers

**`_headers` example for COOP/COEP (if needed in future):**
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Vercel

- **Free tier (Hobby)**: 100 GB bandwidth/month, 6,000 build minutes/month, unlimited deployments
- **CDN**: Vercel Edge Network (~100 PoPs)
- **Custom headers**: Yes — via `vercel.json`. Full COOP/COEP support.
- **Custom domains**: Yes, free, with automatic HTTPS
- **PR previews**: Yes — automatic preview URL per pull request
- **Rust in build**: Not pre-installed by default. Can install via build script or use a custom Docker image (Pro plan). Workaround: pre-build WASM locally and commit the `pkg/` output, then only run `parcel build` on the platform.
- **WASM MIME type**: Correct out of the box
- **Analytics**: Paid add-on (Vercel Analytics)
- **Best for**: Next.js/React projects (first-class support); teams already in the Vercel ecosystem

**`vercel.json` example for COOP/COEP (if needed in future):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Netlify

- **Free tier**: 100 GB bandwidth/month, 300 build minutes/month, unlimited sites
- **CDN**: Netlify ADN (~100 PoPs)
- **Custom headers**: Yes — via `netlify.toml` or a `_headers` file. Full COOP/COEP support.
- **Custom domains**: Yes, free, with automatic HTTPS
- **PR previews**: Yes — deploy preview per pull request
- **Rust in build**: Pre-installed on Netlify's build image (`stable` channel). `wasm-pack` is not pre-installed but can be added: `cargo install wasm-pack`. This makes Netlify the easiest platform to run the full build pipeline without workarounds.
- **WASM MIME type**: Correct out of the box
- **Analytics**: Paid add-on (Netlify Analytics — server-side, no JS on visitor side)
- **Best for**: Projects that need the full Rust + wasm-pack build to run on the platform without pre-committing build artifacts

**`netlify.toml` example:**
```toml
[build]
  command = "cargo install wasm-pack && wasm-pack build crates/image-converter --target web --release && cd web && npx parcel build src/index.html"
  publish = "web/dist"

[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### GitHub Pages

- **Free tier**: 1 GB storage, ~100 GB bandwidth/month (soft limit, not enforced strictly), unlimited for public repos
- **CDN**: Fastly — limited PoPs compared to the others, primarily US/EU focused
- **Custom headers**: **Not supported.** There is no mechanism to set arbitrary response headers. COOP/COEP cannot be set, meaning `SharedArrayBuffer` cannot be used if it becomes necessary.
- **Custom domains**: Yes, free, with automatic HTTPS via Let's Encrypt
- **PR previews**: No native support. Requires a third-party action (e.g., `peaceiris/actions-gh-pages` with branch-per-PR workarounds) or an external service.
- **Rust in build**: Via GitHub Actions — full control over the runner environment. Can install Rust and wasm-pack with standard Actions steps.
- **WASM MIME type**: Correct out of the box
- **Analytics**: None built-in
- **Best for**: Open-source projects that live on GitHub and want zero external dependencies; simple sites that won't need custom headers

## Summary Table

| | Cloudflare Pages | Vercel | Netlify | GitHub Pages |
|---|---|---|---|---|
| Free bandwidth | **Unlimited** | 100 GB/mo | 100 GB/mo | ~100 GB/mo |
| CDN PoPs | **300+** | ~100 | ~100 | Limited |
| Custom headers | Yes | Yes | Yes | **No** |
| Rust pre-installed | No | No | **Yes** | Via Actions |
| wasm-pack pre-installed | No | No | No | Via Actions |
| PR previews | Yes | Yes | Yes | No (workaround needed) |
| Free analytics | Basic | No | No | No |

## Recommendation for This Project

**Cloudflare Pages** is the strongest fit:

1. No bandwidth cap is the most important differentiator — image conversion traffic is I/O-heavy
2. Largest CDN means fastest delivery globally
3. Custom headers supported if `SharedArrayBuffer` is needed in future
4. The missing Rust toolchain can be worked around by committing the pre-built `crates/image-converter/pkg/` directory (it is already gitignored — would need to change that) and only running `parcel build` on the platform

**Netlify** is the best fit if running the full build pipeline on the platform (Rust + wasm-pack + Parcel) without committing build artifacts is a priority — it is the only one with Rust pre-installed.

**GitHub Pages** is the weakest fit due to no custom headers and no PR previews, and should be avoided if COOP/COEP headers may be needed.

## References

- [Cloudflare Pages docs](https://developers.cloudflare.com/pages/)
- [Vercel docs](https://vercel.com/docs)
- [Netlify docs](https://docs.netlify.com/)
- [GitHub Pages docs](https://docs.github.com/en/pages)
- [MDN: COOP and COEP](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)
