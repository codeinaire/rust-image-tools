# Decision: Use pedantic clippy with default rustfmt

**Date:** 2026-02-14
**Status:** Accepted

## Context

Needed to establish linting and formatting conventions for the project before writing code.

## Options Considered

### Clippy: Defaults only (correctness, suspicious, complexity, perf, style)

**Pros:**
- Zero configuration, works out of the box
- No false positives to manage

**Cons:**
- Misses stricter idiomatic checks that catch real issues early

### Clippy: Defaults + pedantic (chosen)

**Pros:**
- Catches more non-idiomatic patterns and potential issues
- Standard for well-maintained Rust crates
- Can selectively `#[allow]` noisy lints on a case-by-case basis

**Cons:**
- Occasionally opinionated — may need to allow some lints

### Clippy: Defaults + pedantic + restriction/nursery

**Pros:**
- Maximum strictness

**Cons:**
- `restriction` bans valid language features — should only be cherry-picked
- `nursery` is experimental with false positives
- Not recommended to enable as full groups

### Rustfmt: Custom config vs defaults

- Default rustfmt style **is** the Rust community convention
- No `rustfmt.toml` needed — it reads `edition` from `Cargo.toml`
- Most projects don't customize it at all

## Decision

- **Clippy:** Add `#![warn(clippy::pedantic)]` to `lib.rs`. Use defaults plus pedantic. Cherry-pick from `restriction`/`nursery` only if specific lints are needed later.
- **Rustfmt:** No config file. Use defaults — they are the convention.
- **No `clippy.toml` or `rustfmt.toml`** needed at this stage.

## Resources

- [Clippy's Lints - Official Documentation](https://doc.rust-lang.org/stable/clippy/lints.html)
- [Clippy Lint Configuration](https://doc.rust-lang.org/clippy/lint_configuration.html)
- [rust-lang/rust-clippy - GitHub](https://github.com/rust-lang/rust-clippy)
