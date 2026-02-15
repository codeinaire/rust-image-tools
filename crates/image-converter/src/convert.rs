use std::io::Cursor;

use image::ImageReader;

use crate::formats::ImageFormat;

/// Result of reading image dimensions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct Dimensions {
    pub width: u32,
    pub height: u32,
}

/// Decodes the input image bytes and re-encodes them in the target format.
///
/// The input buffer is dropped after decoding to free memory before encoding,
/// which is important for WASM's constrained linear memory.
///
/// Returns the encoded image as a byte vector.
pub fn convert(input: Vec<u8>, target: ImageFormat) -> Result<Vec<u8>, ConvertError> {
    let output_format = target
        .to_image_format()
        .map_err(|e| ConvertError::UnsupportedTarget(e.to_string()))?;

    let decoded = image::load_from_memory(&input).map_err(ConvertError::Decode)?;

    // Drop the input buffer now that decoding is complete — frees memory before encoding.
    drop(input);

    let mut output_buf = Vec::new();
    decoded
        .write_to(&mut Cursor::new(&mut output_buf), output_format)
        .map_err(ConvertError::Encode)?;

    Ok(output_buf)
}

/// Reads image dimensions from the raw bytes without fully decoding the pixel data.
///
/// Uses the image reader to extract width and height from headers.
pub fn dimensions(input: &[u8]) -> Result<Dimensions, ConvertError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| ConvertError::Decode(image::ImageError::IoError(e)))?;

    let (width, height) = reader.into_dimensions().map_err(ConvertError::Decode)?;

    Ok(Dimensions { width, height })
}

/// Errors that can occur during image conversion or dimension reading.
#[derive(Debug)]
pub enum ConvertError {
    /// Failed to decode the input image.
    Decode(image::ImageError),
    /// Failed to encode the output image.
    Encode(image::ImageError),
    /// The target format is not supported for encoding.
    UnsupportedTarget(String),
}

impl std::fmt::Display for ConvertError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Decode(e) => write!(f, "Failed to decode image: {e}"),
            Self::Encode(e) => write!(f, "Failed to encode image: {e}"),
            Self::UnsupportedTarget(msg) => write!(f, "{msg}"),
        }
    }
}

impl std::error::Error for ConvertError {}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Test image helpers ---

    fn make_png(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbaImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    fn make_jpeg(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
            .unwrap();
        buf
    }

    fn make_gif(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbaImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Gif)
            .unwrap();
        buf
    }

    fn make_bmp(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Bmp)
            .unwrap();
        buf
    }

    fn make_webp(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbaImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::WebP)
            .unwrap();
        buf
    }

    // --- Conversion tests ---

    #[test]
    fn convert_png_to_jpeg() {
        let png = make_png(2, 2);
        let result = convert(png, ImageFormat::Jpeg).unwrap();
        // Verify the output is valid JPEG by detecting its format
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, ImageFormat::Jpeg);
    }

    #[test]
    fn convert_jpeg_to_png() {
        let jpeg = make_jpeg(2, 2);
        let result = convert(jpeg, ImageFormat::Png).unwrap();
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, ImageFormat::Png);
    }

    #[test]
    fn convert_png_to_gif() {
        let png = make_png(2, 2);
        let result = convert(png, ImageFormat::Gif).unwrap();
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, ImageFormat::Gif);
    }

    #[test]
    fn convert_png_to_bmp() {
        let png = make_png(2, 2);
        let result = convert(png, ImageFormat::Bmp).unwrap();
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, ImageFormat::Bmp);
    }

    #[test]
    fn convert_webp_to_png() {
        let webp = make_webp(2, 2);
        let result = convert(webp, ImageFormat::Png).unwrap();
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, ImageFormat::Png);
    }

    #[test]
    fn convert_to_webp_fails() {
        let png = make_png(2, 2);
        let result = convert(png, ImageFormat::WebP);
        assert!(result.is_err());
    }

    #[test]
    fn convert_invalid_input() {
        let garbage = vec![0xDE, 0xAD, 0xBE, 0xEF];
        let result = convert(garbage, ImageFormat::Png);
        assert!(result.is_err());
    }

    // --- Dimension tests ---

    #[test]
    fn dimensions_png() {
        let png = make_png(10, 20);
        let dims = dimensions(&png).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 10,
                height: 20
            }
        );
    }

    #[test]
    fn dimensions_jpeg() {
        let jpeg = make_jpeg(15, 25);
        let dims = dimensions(&jpeg).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 15,
                height: 25
            }
        );
    }

    #[test]
    fn dimensions_gif() {
        let gif = make_gif(8, 12);
        let dims = dimensions(&gif).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 8,
                height: 12
            }
        );
    }

    #[test]
    fn dimensions_bmp() {
        let bmp = make_bmp(5, 7);
        let dims = dimensions(&bmp).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 5,
                height: 7
            }
        );
    }

    #[test]
    fn dimensions_webp() {
        let webp = make_webp(3, 4);
        let dims = dimensions(&webp).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 3,
                height: 4
            }
        );
    }

    #[test]
    fn dimensions_invalid_input() {
        let garbage = [0xDE, 0xAD, 0xBE, 0xEF];
        let result = dimensions(&garbage);
        assert!(result.is_err());
    }
}
