pub mod convert;
pub mod formats;

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

/// Convert an image from one format to another.
///
/// Takes raw image bytes, a target format name (e.g. `"png"`, `"jpeg"`, `"gif"`, `"bmp"`),
/// and an optional quality value (1-100) for formats that support it.
/// Returns the re-encoded image as a byte vector.
///
/// # Errors
///
/// Returns a `JsError` if:
/// - The target format name is not recognized
/// - The target format is not supported for encoding (e.g. `"webp"`)
/// - The quality value is outside the 1-100 range
/// - The input image cannot be decoded
/// - Encoding to the target format fails
#[wasm_bindgen]
pub fn convert_image(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
) -> Result<Vec<u8>, JsError> {
    // Validate at the WASM boundary for a clear JS-friendly error message.
    // convert() also validates internally for non-WASM callers (defense in depth).
    if let Some(q) = quality {
        if q == 0 || q > 100 {
            return Err(JsError::new("Quality must be between 1 and 100"));
        }
    }

    let target = ImageFormat::from_name(target_format)
        .map_err(|e| JsError::new(&format!("Invalid target format: {e}")))?;

    let result = convert::convert(input.to_vec(), target, quality)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(result)
}

/// Decode an image from any supported format to raw RGBA8 pixel bytes.
///
/// Returns a flat `Vec<u8>` of pixels in RGBA order (4 bytes per pixel, row-major).
/// Use `get_dimensions` first to obtain the width and height needed to interpret the data.
///
/// # Errors
///
/// Returns a `JsError` if the input cannot be decoded or the format is unrecognized.
#[wasm_bindgen]
pub fn decode_to_rgba(input: &[u8]) -> Result<Vec<u8>, JsError> {
    convert::decode_rgba(input)
        .map_err(|e| JsError::new(&format!("Failed to decode image to RGBA: {e}")))
}

/// Read the dimensions of an image without fully decoding its pixel data.
///
/// Returns a JavaScript object with `width` and `height` properties (both `u32`).
///
/// # Errors
///
/// Returns a `JsError` if the image format cannot be guessed or the dimensions cannot be read.
#[wasm_bindgen]
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError> {
    let dims = convert::dimensions(input).map_err(|e| JsError::new(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&dims)
        .map_err(|e| JsError::new(&format!("Failed to serialize dimensions: {e}")))
}
