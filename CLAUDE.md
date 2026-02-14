# Project: Rust + WASM Image Converter

## Overview

Client-side web app that converts images between formats using Rust compiled to WebAssembly. See PLANNING.md for architecture details.

## Tech Stack

- **Rust** (WASM library): `image` crate, `wasm-bindgen`, `wasm-pack`
- **TypeScript** (frontend): Vanilla TS, Parcel bundler
- **Styling**: Tailwind CSS v4

## Rust Coding Conventions

### Naming

- `snake_case` for functions, methods, variables, modules, and file names
- `CamelCase` for types, traits, and enums
- `SCREAMING_SNAKE_CASE` for constants and statics
- Prefix unused variables with `_` (e.g., `_unused`)
- Use descriptive names — avoid single-letter variables except in short closures or iterators

### Error Handling

- Use `Result<T, E>` for all fallible operations — never `unwrap()` or `expect()` in library code
- `unwrap()` is only acceptable in tests and examples
- For WASM-exported functions, return `Result<T, JsError>` so errors propagate to JavaScript
- Use the `?` operator for error propagation
- Provide meaningful error messages: `map_err(|e| JsError::new(&format!("Failed to decode image: {e}")))`

### Structure & Organization

- One public type or concept per module where practical
- Keep `lib.rs` as a thin entry point — delegate logic to submodules (`convert.rs`, `formats.rs`)
- Group related `use` imports: std first, then external crates, then local modules, separated by blank lines
- All `#[wasm_bindgen]` exports live in `lib.rs` — internal logic stays in submodules

### Documentation

- Add doc comments (`///`) to all public functions and types
- Include a brief description and note any panics, errors, or safety considerations
- Do not add doc comments to private functions unless the logic is non-obvious

### Idioms

- Prefer iterators and combinators over manual loops where they improve clarity
- Use `match` exhaustively — avoid wildcard `_` catch-alls on enums (so the compiler catches new variants)
- Prefer `&str` over `String` for function parameters when ownership isn't needed
- Use `impl Into<T>` or generics sparingly — prefer concrete types for WASM boundary functions
- Prefer `Vec<u8>` for byte buffers, `&[u8]` for borrowed byte slices

### WASM-Specific

- Always set `default-features = false` on the `image` crate (avoids `rayon` which breaks WASM)
- Only enable the format features actually needed in `Cargo.toml`
- Keep WASM-exported function signatures simple — `&[u8]`, `Vec<u8>`, `String`, `JsValue`, `JsError`
- Minimize the number of JS↔WASM boundary crossings
- Drop large allocations explicitly when done (e.g., `drop(input_buffer)` before encoding output)

### Testing

- Write unit tests in a `#[cfg(test)]` module at the bottom of each file
- Use `wasm-pack test --headless --chrome` for WASM-specific tests
- Test error paths, not just happy paths

## TypeScript Coding Conventions

- Use strict TypeScript (`"strict": true` in tsconfig)
- Prefer `const` over `let`; never use `var`
- Use explicit types for function signatures; allow inference for local variables
- Use `async/await` over raw Promises

## Linting & Formatting

- **Rust**: Run `cargo fmt` before committing. Run `cargo clippy` and fix all warnings.
- **TypeScript**: Use standard Parcel/TS defaults.
- Treat all compiler warnings as errors — do not leave warnings unaddressed.

## Build Commands

```bash
# Build WASM
wasm-pack build crates/image-converter --target web --release

# Run Rust tests
cargo test --manifest-path crates/image-converter/Cargo.toml

# Frontend dev
cd web && npx parcel src/index.html

# Production build
cd web && npx parcel build src/index.html
```
