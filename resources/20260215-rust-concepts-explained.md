# Rust Concepts Explained

Notes from building the image-converter WASM crate.

---

## Crate Structure & Modules

### `lib.rs` naming

`lib.rs` is the **mandatory entry point** for a library crate. Cargo looks for specific filenames:

- `src/lib.rs` → library (used by other code)
- `src/main.rs` → executable (runs directly)

It's a thin entry point — declares modules and exposes the public API, while actual logic lives in descriptively-named files like `formats.rs`.

### Rust vs Node.js concept mapping

| Rust | Node.js |
|------|---------|
| Crate | npm package |
| `Cargo.toml` | `package.json` |
| `lib.rs` | `index.js` / `main.js` |
| `mod formats;` | `require('./formats')` |
| `pub fn detect_format` | `module.exports = { detectFormat }` |
| `pub(crate)` | not exported from `index.js`, but used internally between files |
| `crates.io` | npm registry |

### `pub(crate) mod formats;`

- `mod formats;` — tells Rust "there's a module called `formats`, find it in `src/formats.rs`." Rust doesn't auto-discover files like Python or Node.
- `pub(crate)` — visible within this crate but not to outside consumers.

Visibility levels:

- `mod formats;` — private, only `lib.rs` can use it
- `pub(crate) mod formats;` — any file in this crate can use it
- `pub mod formats;` — anyone, including external code, can use it

### `use` imports

```rust
use wasm_bindgen::prelude::*;    // import everything from the prelude module
use formats::ImageFormat;        // import a specific type from our module
```

A "prelude" is a Rust convention — a module that re-exports the most commonly needed items.

---

## Enums

```rust
pub enum ImageFormat {
    Png, Jpeg, WebP, Gif, Bmp,
}
```

A type that can be one of several variants — like a TypeScript union type: `"png" | "jpeg" | "webp" | "gif" | "bmp"`.

Enum variants can carry data:

```rust
pub enum FormatError {
    EmptyInput,                          // no data
    Unrecognized,                        // no data
    Unsupported(image::ImageFormat),     // carries the unsupported format value
}
```

`Unsupported(image::ImageFormat)` is like a TypeScript type `{ kind: "unsupported", format: ImageFormat }`.

---

## `#[derive(...)]` and Traits

A **trait** is like a TypeScript interface — it defines behavior a type must implement. `#[derive(...)]` auto-generates the implementation. It applies only to the type **directly below it**, not the whole file.

Works on enums and structs:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]  // applies to ImageFormat only
pub enum ImageFormat { ... }

#[derive(Debug)]  // applies to FormatError only
pub enum FormatError { ... }
```

### What each derived trait enables

**`Debug`** — enables `{:?}` formatting:
```rust
println!("{:?}", ImageFormat::Png);  // prints "Png"
// Without: compiler error
```

**`Clone`** — enables `.clone()`:
```rust
let b = a.clone();  // explicit duplication
// Without: compiler error
```

**`Copy`** — enables implicit duplication (requires `Clone`):
```rust
// With Copy:
let a = ImageFormat::Png;
let b = a;     // copied
let c = a;     // still works

// Without Copy:
let a = ImageFormat::Png;
let b = a;     // MOVED
let c = a;     // compiler error: "value used after move"
```

Only for cheap-to-copy types (numbers, booleans, simple enums). Can't derive `Copy` on types with heap data like `String`.

**`PartialEq`** — enables `==` and `!=`:
```rust
assert_eq!(format, ImageFormat::Png);
// Without: compiler error
```

**`Eq`** — marker that equality is total (`a == a` is always true). Required for `HashMap` keys. `PartialEq` alone allows `a != a` (like `NaN != NaN` in floats).

### Requirement

All fields/variants inside the type must also implement the trait being derived:

```rust
#[derive(Copy, Clone)]  // fails — String doesn't implement Copy
struct Name { value: String }

#[derive(Copy, Clone)]  // works — u32 implements Copy
struct Dimensions { width: u32, height: u32 }
```

---

## `impl Display` — Human-Readable String Conversion

`Display` defines how a type converts to a string. Unlike `Debug`, it can't be derived — you must write it manually since human-readable messages are a design choice.

```rust
impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyInput => write!(f, "Input is empty — no image data provided"),
            Self::Unrecognized => write!(f, "Unrecognized image format"),
            Self::Unsupported(fmt) => write!(f, "Unsupported image format: {fmt:?}"),
        }
    }
}
```

Enables:
```rust
err.to_string()        // "Input is empty — no image data provided"
format!("{err}")       // same
println!("{err}");     // prints it
```

---

## `impl std::error::Error for FormatError {}`

Marks a type as a standard Rust error. The empty `{}` accepts the default implementation (which uses the `Display` impl for the error message). Required so it can be used with `?` and other error-handling patterns.

---

## Return Values — No `return` Keyword Needed

The **last expression** in a function is automatically the return value — as long as it has no semicolon:

```rust
fn as_str(&self) -> &'static str {
    match self {
        Self::Png => "png",    // no semicolon — returned
    }
}
```

The semicolon matters:
```rust
"png"    // expression — returns this value
"png";   // statement — discards the value
```

`return` is used only for early exits:
```rust
if input.is_empty() {
    return Err(FormatError::EmptyInput);  // early exit needs `return`
}

Self::from_image_format(guessed_format)
    .ok_or(FormatError::Unsupported(guessed_format))  // last expression, no `return`
```

---

## `Option` vs `Result`

```rust
Option<T>     →  Some(value)  or  None          // might not have a value
Result<T, E>  →  Ok(value)    or  Err(reason)   // has a value, or a reason why not
```

`Option` is for uncertainty — "I might have a value, I might not." No explanation.

`Result` is a concrete outcome — "Here's the value, or here's *why* you don't have one."

### `.ok_or()` — bridging Option to Result

Converts `Option` into `Result` by providing the error for the `None` case:

- `Some(value)` → `Ok(value)`
- `None` → `Err(the_error_you_provide)`

```rust
Self::from_image_format(guessed_format)            // returns Option<ImageFormat>
    .ok_or(FormatError::Unsupported(guessed_format))  // converts to Result<ImageFormat, FormatError>
```

The error variant is chosen manually — the compiler doesn't know which is semantically correct. That's our job.

### `.map_err()` — converting one error type to another

```rust
image::guess_format(input)               // returns Result<_, ImageError>
    .map_err(|_| FormatError::Unrecognized)  // converts ImageError → FormatError
```

`|_|` means "I don't care about the original error value."

### `?` operator — early return on error

```rust
let guessed = image::guess_format(input).map_err(|_| FormatError::Unrecognized)?;
```

If the result is `Ok`, unwrap the value and continue. If `Err`, return early from the function with that error.

---

## Slices — `&[u8]`

```rust
u8       // one byte (0–255)
[u8]     // a sequence of bytes, length unknown at compile time
&[u8]    // a borrowed reference to that sequence
[u8; 4]  // exactly 4 bytes, length known at compile time
```

Slices carry their length at runtime (pointer + length), so a function can accept any number of bytes.

---

## `JsError` — Crossing the WASM Boundary

`JsError` comes from `wasm_bindgen::prelude::*`. It's a Rust type that maps to a JavaScript `Error`.

When our function returns `Err(JsError::new("message"))`, JavaScript sees a thrown error:

```js
try {
    const format = detect_format(bytes);
} catch (e) {
    // e.message === "Failed to detect image format: ..."
}
```

Internal Rust error types (like `FormatError`) are converted to `JsError` at the WASM boundary because JavaScript doesn't understand Rust types.

---

## Why Wrap External Types

We convert the `image` crate's `ImageFormat` enum to our own because:

1. **Control** — the `image` crate has ~20 formats; we support 5. Our enum makes "unsupported format" a compile-time impossibility.
2. **Stable API** — if the `image` crate changes, only our mapping function updates, not our public API.
3. **Custom behavior** — we control string representation, error types, and can add methods like `can_encode()`.
4. **WASM boundary** — `wasm_bindgen` can't export third-party types; we'd need to convert anyway.

---

## Proc Macros

A **procedural macro** is a Rust function that runs at compile time and transforms code. Three kinds:

1. **Derive macros** — auto-implement traits: `#[derive(Debug, Clone)]`
2. **Attribute macros** — transform items: `#[wasm_bindgen]`
3. **Function-like macros** — `sql!(SELECT * FROM users)`

`#[wasm_bindgen]` reads your function signature at compile time and generates the FFI boilerplate for JavaScript to call your Rust function across the WASM boundary.

Proc macros compile to native `.dylib` files (they run on your machine, not in WASM).

---

## FFI (Foreign Function Interface)

A mechanism that lets code in one language call functions in another. In this project, the FFI boundary is JavaScript ↔ Rust (via WASM). `wasm_bindgen` handles:

- **Type conversion** — JS `Uint8Array` → Rust `&[u8]`, Rust `String` → JS `string`
- **Memory management** — marshalling data between WASM linear memory and JS garbage collector
- **Error propagation** — Rust `Result::Err` → JS `throw`
