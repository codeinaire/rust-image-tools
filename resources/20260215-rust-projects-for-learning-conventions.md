# Rust Projects for Learning Conventions & Best Practices

**Date:** 2026-02-15

## Top Pick: ripgrep

**Repo:** https://github.com/BurntSushi/ripgrep

Written by BurntSushi (Andrew Galloway), widely regarded as writing some of the best Rust code in the ecosystem. Gold standard for:

- Clean module organization and crate structure
- Idiomatic error handling with `Result` and custom error types
- Thorough testing (unit + integration)
- Excellent use of `clippy` and `rustfmt`
- Well-written doc comments
- Performance-conscious but readable code

Medium-sized project — large enough to show real architecture patterns but small enough to actually read through.

## Also Worth Studying

| Project | Why it's useful | Link |
|---|---|---|
| **Rust std library** | The reference for idiomatic APIs, trait design, and naming | https://doc.rust-lang.org/src/std/ |
| **rust-analyzer** | Top-tier project structure and module organization (very large) | https://github.com/rust-lang/rust-analyzer |
| **image** (project dependency) | Directly relevant — see how the crate we're using is built | https://github.com/image-rs/image |

## Recommended Approach

Start with **ripgrep**. Pick one module (e.g., argument parsing or search logic), read through it, and note the patterns — how errors are defined, how modules are split, how tests are structured. Then compare those patterns against what you're building.

## Sources

- [Rust Forum — Open source projects with high quality code](https://users.rust-lang.org/t/open-source-projects-with-high-quality-code/131623)
- [Idiomatic Rust — curated collection](https://github.com/mre/idiomatic-rust)
- [Rust Learning Resources 2025](https://corrode.dev/blog/rust-learning-resources-2025/)
