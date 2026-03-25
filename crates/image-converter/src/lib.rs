pub mod convert;
pub mod formats;
pub mod metadata;
pub mod processing;
pub mod transforms;

use wasm_bindgen::prelude::*;

use formats::ImageFormat;
use processing::ProcessingOperation;

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

    let result = convert::convert(input.to_vec(), target, quality, &[])
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(result)
}

/// Convert an image with optional transforms applied before encoding.
///
/// Takes raw image bytes, a target format name, an optional quality value (1-100),
/// and a comma-separated string of transform names to apply before encoding.
///
/// Supported transforms: `"flip_horizontal"`, `"flip_vertical"`, `"rotate_90"`,
/// `"rotate_180"`, `"rotate_270"`, `"grayscale"`, `"invert"`.
///
/// # Errors
///
/// Returns a `JsError` if:
/// - The target format name is not recognized
/// - The target format is not supported for encoding (e.g. `"webp"`)
/// - The quality value is outside the 1-100 range
/// - A transform name is not recognized
/// - The input image cannot be decoded
/// - Encoding to the target format fails
#[wasm_bindgen]
pub fn convert_image_with_transforms(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
    transforms_csv: &str,
) -> Result<Vec<u8>, JsError> {
    if let Some(q) = quality {
        if q == 0 || q > 100 {
            return Err(JsError::new("Quality must be between 1 and 100"));
        }
    }

    let target = ImageFormat::from_name(target_format)
        .map_err(|e| JsError::new(&format!("Invalid target format: {e}")))?;

    let transform_list = transforms::parse_transforms(transforms_csv)
        .map_err(|e| JsError::new(&format!("Invalid transform: {e}")))?;

    let result = convert::convert(input.to_vec(), target, quality, &transform_list)
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

/// Decode an image, apply transforms, and return raw RGBA8 pixel bytes.
///
/// Returns a `JsValue` object with `rgba` (Uint8Array), `width` (u32), and `height` (u32).
/// Transforms may change dimensions (e.g. 90° rotation swaps width/height), so the
/// post-transform dimensions are included in the result.
///
/// # Errors
///
/// Returns a `JsError` if the input cannot be decoded, the format is unrecognized,
/// or a transform name is invalid.
#[wasm_bindgen]
pub fn decode_to_rgba_with_transforms(
    input: &[u8],
    transforms_csv: &str,
) -> Result<JsValue, JsError> {
    let transform_list = transforms::parse_transforms(transforms_csv)
        .map_err(|e| JsError::new(&format!("Invalid transform: {e}")))?;

    let (rgba, dims) = convert::decode_rgba_with_transforms(input, &transform_list)
        .map_err(|e| JsError::new(&format!("Failed to decode image with transforms: {e}")))?;

    let obj = js_sys::Object::new();
    let rgba_array = js_sys::Uint8Array::from(rgba.as_slice());
    js_sys::Reflect::set(&obj, &"rgba".into(), &rgba_array)
        .map_err(|_| JsError::new("Failed to set rgba property"))?;
    js_sys::Reflect::set(&obj, &"width".into(), &dims.width.into())
        .map_err(|_| JsError::new("Failed to set width property"))?;
    js_sys::Reflect::set(&obj, &"height".into(), &dims.height.into())
        .map_err(|_| JsError::new("Failed to set height property"))?;

    Ok(obj.into())
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

/// Extract metadata from an image without fully decoding pixel data.
///
/// Returns a JavaScript object containing image dimensions, format, color info,
/// EXIF data (if present), and PNG text chunks (if applicable).
///
/// # Errors
///
/// Returns a `JsError` if the image format cannot be detected or metadata extraction fails.
#[wasm_bindgen]
pub fn get_image_metadata(input: &[u8]) -> Result<JsValue, JsError> {
    let meta =
        metadata::extract(input).map_err(|e| JsError::new(&format!("Metadata error: {e}")))?;
    serde_wasm_bindgen::to_value(&meta)
        .map_err(|e| JsError::new(&format!("Failed to serialize metadata: {e}")))
}

/// Convert an image with both transforms and processing operations applied.
///
/// Applies transforms (flip, rotate, grayscale) first, then processing operations
/// (resize, crop, blur, brightness, etc.), then encodes to the target format.
///
/// The `operations` parameter is a JavaScript array of operation objects, each with
/// a `type` field and operation-specific parameters (e.g. `{ type: "blur", sigma: 2.0 }`).
///
/// # Errors
///
/// Returns a `JsError` if:
/// - The target format name is not recognized
/// - The quality value is outside the 1-100 range
/// - A transform name is not recognized
/// - An operation has invalid parameters
/// - The input image cannot be decoded
/// - Encoding to the target format fails
#[wasm_bindgen]
pub fn process_and_convert(
    input: &[u8],
    target_format: &str,
    quality: Option<u8>,
    transforms_csv: &str,
    operations: JsValue,
) -> Result<Vec<u8>, JsError> {
    if let Some(q) = quality {
        if q == 0 || q > 100 {
            return Err(JsError::new("Quality must be between 1 and 100"));
        }
    }

    let target = ImageFormat::from_name(target_format)
        .map_err(|e| JsError::new(&format!("Invalid target format: {e}")))?;

    let transform_list = transforms::parse_transforms(transforms_csv)
        .map_err(|e| JsError::new(&format!("Invalid transform: {e}")))?;

    let ops: Vec<ProcessingOperation> = serde_wasm_bindgen::from_value(operations)
        .map_err(|e| JsError::new(&format!("Invalid processing operations: {e}")))?;

    let result =
        convert::convert_with_processing(input.to_vec(), target, quality, &transform_list, &ops)
            .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(result)
}

/// Decode an image, apply transforms and processing operations, and return raw RGBA8 pixels.
///
/// Returns a `JsValue` object with `rgba` (Uint8Array), `width` (u32), and `height` (u32).
/// Used for the WebP encoding path where Canvas handles the final encoding.
///
/// # Errors
///
/// Returns a `JsError` if the input cannot be decoded, transforms are invalid,
/// or a processing operation has invalid parameters.
#[wasm_bindgen]
pub fn decode_rgba_with_processing(
    input: &[u8],
    transforms_csv: &str,
    operations: JsValue,
) -> Result<JsValue, JsError> {
    let transform_list = transforms::parse_transforms(transforms_csv)
        .map_err(|e| JsError::new(&format!("Invalid transform: {e}")))?;

    let ops: Vec<ProcessingOperation> = serde_wasm_bindgen::from_value(operations)
        .map_err(|e| JsError::new(&format!("Invalid processing operations: {e}")))?;

    let (rgba, dims) = convert::decode_rgba_with_processing(input, &transform_list, &ops)
        .map_err(|e| JsError::new(&format!("Failed to process image: {e}")))?;

    let obj = js_sys::Object::new();
    let rgba_array = js_sys::Uint8Array::from(rgba.as_slice());
    js_sys::Reflect::set(&obj, &"rgba".into(), &rgba_array)
        .map_err(|_| JsError::new("Failed to set rgba property"))?;
    js_sys::Reflect::set(&obj, &"width".into(), &dims.width.into())
        .map_err(|_| JsError::new("Failed to set width property"))?;
    js_sys::Reflect::set(&obj, &"height".into(), &dims.height.into())
        .map_err(|_| JsError::new("Failed to set height property"))?;

    Ok(obj.into())
}

/// Generate a low-resolution preview with processing operations applied.
///
/// Thumbnails the input to fit within `max_width` (preserving aspect ratio),
/// then applies all processing operations. Returns RGBA pixels and dimensions.
///
/// Used for interactive preview during parameter adjustment.
///
/// # Errors
///
/// Returns a `JsError` if decoding fails or a processing operation has invalid parameters.
#[wasm_bindgen]
pub fn preview_operations(
    input: &[u8],
    operations: JsValue,
    max_width: u32,
) -> Result<JsValue, JsError> {
    let ops: Vec<ProcessingOperation> = serde_wasm_bindgen::from_value(operations)
        .map_err(|e| JsError::new(&format!("Invalid processing operations: {e}")))?;

    let decoded =
        image::load_from_memory(input).map_err(|e| JsError::new(&format!("Decode error: {e}")))?;

    // Thumbnail to max_width for fast preview
    let thumb = decoded.thumbnail(max_width, max_width);

    let processed = processing::apply_operations(thumb, &ops)
        .map_err(|e| JsError::new(&format!("Processing error: {e}")))?;

    let width = processed.width();
    let height = processed.height();
    let rgba = processed.into_rgba8().into_raw();

    let obj = js_sys::Object::new();
    let rgba_array = js_sys::Uint8Array::from(rgba.as_slice());
    js_sys::Reflect::set(&obj, &"rgba".into(), &rgba_array)
        .map_err(|_| JsError::new("Failed to set rgba property"))?;
    js_sys::Reflect::set(&obj, &"width".into(), &width.into())
        .map_err(|_| JsError::new("Failed to set width property"))?;
    js_sys::Reflect::set(&obj, &"height".into(), &height.into())
        .map_err(|_| JsError::new("Failed to set height property"))?;

    Ok(obj.into())
}
