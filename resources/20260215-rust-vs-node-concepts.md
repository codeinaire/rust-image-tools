# Rust vs Node.js — Concept Mapping

| Rust | Node.js |
|------|---------|
| Crate | npm package |
| `Cargo.toml` | `package.json` |
| `lib.rs` | `index.js` / `main.js` |
| `mod formats;` | `require('./formats')` |
| `pub fn detect_format` | `module.exports = { detectFormat }` |
| `pub(crate)` | not exported from `index.js`, but used internally between files |
| `crates.io` | npm registry |

Only what's `pub` in `lib.rs` is available to consumers of the crate — everything else is internal. Same as how only what you export from `index.js` is available to consumers of an npm package.
