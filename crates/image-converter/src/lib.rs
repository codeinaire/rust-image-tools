pub(crate) mod formats;

use wasm_bindgen::prelude::*;

use formats::ImageFormat;

/// Detect the format of an image from its raw bytes.
///
/// Returns a lowercase format name string (e.g. `"png"`, `"jpeg"`, `"webp"`, `"gif"`, `"bmp"`).
///
/// # Errors
///
/// Returns a `JsError` if the input is empty or the format is unrecognized.
#[wasm_bindgen]
pub fn detect_format(input: &[u8]) -> Result<String, JsError> {
    let format = ImageFormat::detect_from_bytes(input)
        .map_err(|e| JsError::new(&format!("Failed to detect image format: {e}")))?;

    Ok(format.to_string())
}
