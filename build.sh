#!/usr/bin/env bash
set -euo pipefail

# Install Rust if not present (Cloudflare Pages does not pre-install it)
if ! command -v cargo &>/dev/null; then
  echo "Rust not found — installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
fi

rustup target add wasm32-unknown-unknown

# Install frontend dependencies (includes wasm-pack as a devDependency)
npm install --prefix web

# Build WASM (uses wasm-pack installed by npm above)
web/node_modules/.bin/wasm-pack build crates/image-converter --target web --release

# Build frontend — output goes to web/dist/
web/node_modules/.bin/parcel build web/src/index.html --dist-dir web/dist
