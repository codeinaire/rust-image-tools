# Decision: Unit test placement — in-file #[cfg(test)] modules vs separate test files

**Date:** 2026-02-15
**Status:** Accepted

## Context

Needed to decide where to place unit tests in the Rust codebase: co-located inside each source file (the Rust convention) or in separate dedicated test files. The project is starting with the conventional approach but may revisit as the codebase grows.

## Options Considered

### In-file `#[cfg(test)]` modules (chosen for now)

**Pros:**
- Standard Rust convention — familiar to any Rust developer
- Tests live next to the code they test, making it easy to keep them in sync
- `use super::*` gives access to private functions and internals
- Conditionally compiled (`#[cfg(test)]`) so test code is excluded from release builds
- No extra file/directory structure to manage

**Cons:**
- Source files grow longer as tests accumulate, making navigation harder
- Mixing production and test code in one file can feel cluttered in large modules
- Harder to get a quick overview of test coverage across the project
- Merge conflicts are more likely when multiple people edit both code and tests in the same file

### Separate test files (e.g., `convert_tests.rs` or `tests/` subdirectory within `src/`)

**Pros:**
- Keeps source files focused on production logic only
- Easier to navigate large test suites independently
- Cleaner separation of concerns — reviewers can look at code and tests separately
- Scales better for modules with extensive test cases

**Cons:**
- Not the Rust convention — may surprise contributors
- Cannot access private functions/internals without making them `pub(crate)` or adding test-only visibility, which leaks implementation details
- Requires extra `mod` declarations and file structure to wire up
- Slightly more boilerplate to set up imports

### Integration tests in `tests/` directory (crate root)

**Pros:**
- Built-in Rust support — each file in `tests/` is compiled as a separate crate
- Tests the public API as an external consumer would
- Good for end-to-end and cross-module tests

**Cons:**
- Can only test the public API — no access to internals
- Not a replacement for unit tests, more of a complement
- Each test file is a separate compilation unit, which can slow down `cargo test`

## Decision

Use in-file `#[cfg(test)]` modules for now, following the standard Rust convention. This is the right starting point for a small/medium project and keeps tests close to the code they verify. If individual files become unwieldy (e.g., tests exceed ~200 lines or the module itself is large), revisit and consider extracting tests into sibling files. Integration tests in `tests/` at the crate root can be added later for public API testing.

## Resources

- [The Rust Programming Language — How to Write Tests](https://doc.rust-lang.org/book/ch11-01-writing-tests.html)
- [The Rust Programming Language — Test Organization](https://doc.rust-lang.org/book/ch11-03-test-organization.html)
- [Rust By Example — Unit Testing](https://doc.rust-lang.org/rust-by-example/testing/unit_testing.html)
