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
    use std::time::Instant;

    use super::*;

    // ===== Fixture Generation Helpers =====

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

    fn make_patterned_rgba(width: u32, height: u32) -> image::RgbaImage {
        let mut img = image::RgbaImage::new(width, height);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = image::Rgba([
                (x.wrapping_mul(37) % 256) as u8,
                (y.wrapping_mul(53) % 256) as u8,
                (x.wrapping_add(y).wrapping_mul(17) % 256) as u8,
                255,
            ]);
        }
        img
    }

    fn make_patterned_png(width: u32, height: u32) -> (image::RgbaImage, Vec<u8>) {
        let img = make_patterned_rgba(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img.clone())
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        (img, buf)
    }

    fn make_alpha_png(width: u32, height: u32) -> Vec<u8> {
        let mut img = image::RgbaImage::new(width, height);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            let alpha = if (x + y) % 2 == 0 { 255 } else { 0 };
            *pixel = image::Rgba([255, 0, 0, alpha]);
        }
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    // ===== Assertion Helpers =====

    fn assert_conversion(input: &[u8], target: ImageFormat, width: u32, height: u32) {
        let start = Instant::now();
        let result = convert(input.to_vec(), target).unwrap();
        let elapsed = start.elapsed();
        println!(
            "  → {target}: {elapsed:.2?} ({} bytes in, {} bytes out)",
            input.len(),
            result.len()
        );
        image::load_from_memory(&result).expect("Output should be decodable");
        let detected = ImageFormat::detect_from_bytes(&result).unwrap();
        assert_eq!(detected, target, "Output format should be {target}");
        let dims = dimensions(&result).unwrap();
        assert_eq!(dims.width, width, "Width should be preserved");
        assert_eq!(dims.height, height, "Height should be preserved");
    }

    // ===== Conversion Matrix Tests =====
    //
    // All 16 input→output combinations (excluding same-format and WebP as output).
    // Each verifies: output is re-decodable, format matches target, dimensions preserved.

    // --- PNG → * ---

    #[test]
    fn convert_png_to_jpeg() {
        let png = make_png(50, 40);
        assert_conversion(&png, ImageFormat::Jpeg, 50, 40);
    }

    #[test]
    fn convert_png_to_gif() {
        let png = make_png(50, 40);
        assert_conversion(&png, ImageFormat::Gif, 50, 40);
    }

    #[test]
    fn convert_png_to_bmp() {
        let png = make_png(50, 40);
        assert_conversion(&png, ImageFormat::Bmp, 50, 40);
    }

    // --- JPEG → * ---

    #[test]
    fn convert_jpeg_to_png() {
        let jpeg = make_jpeg(50, 40);
        assert_conversion(&jpeg, ImageFormat::Png, 50, 40);
    }

    #[test]
    fn convert_jpeg_to_gif() {
        let jpeg = make_jpeg(50, 40);
        assert_conversion(&jpeg, ImageFormat::Gif, 50, 40);
    }

    #[test]
    fn convert_jpeg_to_bmp() {
        let jpeg = make_jpeg(50, 40);
        assert_conversion(&jpeg, ImageFormat::Bmp, 50, 40);
    }

    // --- WebP → * ---

    #[test]
    fn convert_webp_to_png() {
        let webp = make_webp(50, 40);
        assert_conversion(&webp, ImageFormat::Png, 50, 40);
    }

    #[test]
    fn convert_webp_to_jpeg() {
        let webp = make_webp(50, 40);
        assert_conversion(&webp, ImageFormat::Jpeg, 50, 40);
    }

    #[test]
    fn convert_webp_to_gif() {
        let webp = make_webp(50, 40);
        assert_conversion(&webp, ImageFormat::Gif, 50, 40);
    }

    #[test]
    fn convert_webp_to_bmp() {
        let webp = make_webp(50, 40);
        assert_conversion(&webp, ImageFormat::Bmp, 50, 40);
    }

    // --- GIF → * ---

    #[test]
    fn convert_gif_to_png() {
        let gif = make_gif(50, 40);
        assert_conversion(&gif, ImageFormat::Png, 50, 40);
    }

    #[test]
    fn convert_gif_to_jpeg() {
        let gif = make_gif(50, 40);
        assert_conversion(&gif, ImageFormat::Jpeg, 50, 40);
    }

    #[test]
    fn convert_gif_to_bmp() {
        let gif = make_gif(50, 40);
        assert_conversion(&gif, ImageFormat::Bmp, 50, 40);
    }

    // --- BMP → * ---

    #[test]
    fn convert_bmp_to_png() {
        let bmp = make_bmp(50, 40);
        assert_conversion(&bmp, ImageFormat::Png, 50, 40);
    }

    #[test]
    fn convert_bmp_to_jpeg() {
        let bmp = make_bmp(50, 40);
        assert_conversion(&bmp, ImageFormat::Jpeg, 50, 40);
    }

    #[test]
    fn convert_bmp_to_gif() {
        let bmp = make_bmp(50, 40);
        assert_conversion(&bmp, ImageFormat::Gif, 50, 40);
    }

    // --- Encode-unsupported target ---

    #[test]
    fn convert_to_webp_fails() {
        let png = make_png(2, 2);
        let result = convert(png, ImageFormat::WebP);
        assert!(result.is_err());
    }

    // ===== Size Variant Tests =====
    //
    // Tests key conversion paths at each size point to verify handling of
    // edge-case dimensions and large images.

    fn test_size_variant(width: u32, height: u32) {
        let png = make_png(width, height);
        assert_conversion(&png, ImageFormat::Jpeg, width, height);

        let webp = make_webp(width, height);
        assert_conversion(&webp, ImageFormat::Png, width, height);

        let bmp = make_bmp(width, height);
        assert_conversion(&bmp, ImageFormat::Gif, width, height);
    }

    #[test]
    fn size_tiny() {
        test_size_variant(1, 1);
    }

    #[test]
    fn size_small() {
        test_size_variant(100, 100);
    }

    #[test]
    fn size_medium() {
        test_size_variant(1920, 1080);
    }

    #[test]
    fn size_large() {
        test_size_variant(4000, 3000);
    }

    #[test]
    fn size_wide() {
        test_size_variant(10000, 100);
    }

    #[test]
    fn size_tall() {
        test_size_variant(100, 10000);
    }

    // --- Square max (10000x10000 / 100 MP) ---
    //
    // Each input format gets its own #[ignore] test so they can run independently.
    // Run all: `cargo test -- --ignored --nocapture size_square_max`

    #[test]
    #[ignore]
    fn size_square_max_png() {
        let png = make_png(10000, 10000);
        assert_conversion(&png, ImageFormat::Jpeg, 10000, 10000);
    }

    #[test]
    #[ignore]
    fn size_square_max_jpeg() {
        let jpeg = make_jpeg(10000, 10000);
        assert_conversion(&jpeg, ImageFormat::Png, 10000, 10000);
    }

    #[test]
    #[ignore]
    fn size_square_max_webp() {
        let webp = make_webp(10000, 10000);
        assert_conversion(&webp, ImageFormat::Png, 10000, 10000);
    }

    #[test]
    #[ignore]
    fn size_square_max_gif() {
        let gif = make_gif(10000, 10000);
        assert_conversion(&gif, ImageFormat::Png, 10000, 10000);
    }

    #[test]
    #[ignore]
    fn size_square_max_bmp() {
        let bmp = make_bmp(10000, 10000);
        assert_conversion(&bmp, ImageFormat::Png, 10000, 10000);
    }

    // ===== Error Case Tests =====

    #[test]
    fn convert_empty_input() {
        let result = convert(vec![], ImageFormat::Png);
        assert!(result.is_err());
    }

    #[test]
    fn convert_truncated_file() {
        let png = make_png(100, 100);
        let truncated = png[..100].to_vec();
        let result = convert(truncated, ImageFormat::Png);
        assert!(result.is_err());
    }

    #[test]
    fn convert_random_bytes() {
        let random: Vec<u8> = (0..1024u16)
            .map(|i| (i.wrapping_mul(137).wrapping_add(43) % 256) as u8)
            .collect();
        let result = convert(random, ImageFormat::Png);
        assert!(result.is_err());
    }

    // ===== Pixel Fidelity Tests =====

    #[test]
    fn fidelity_png_round_trip() {
        let (original, png_data) = make_patterned_png(50, 50);
        let result = convert(png_data, ImageFormat::Png).unwrap();
        let decoded = image::load_from_memory(&result).unwrap().into_rgba8();
        assert_eq!(original.dimensions(), decoded.dimensions());
        assert_eq!(
            original.as_raw(),
            decoded.as_raw(),
            "PNG→PNG round-trip should be pixel-perfect"
        );
    }

    #[test]
    fn fidelity_bmp_to_png() {
        let original_rgba = make_patterned_rgba(50, 50);
        let original_rgb = image::DynamicImage::ImageRgba8(original_rgba).into_rgb8();
        let mut bmp_data = Vec::new();
        image::DynamicImage::ImageRgb8(original_rgb.clone())
            .write_to(&mut Cursor::new(&mut bmp_data), image::ImageFormat::Bmp)
            .unwrap();

        let result = convert(bmp_data, ImageFormat::Png).unwrap();
        let decoded = image::load_from_memory(&result).unwrap().into_rgb8();
        assert_eq!(original_rgb.dimensions(), decoded.dimensions());
        assert_eq!(
            original_rgb.as_raw(),
            decoded.as_raw(),
            "BMP→PNG should be pixel-perfect for RGB data"
        );
    }

    #[test]
    fn fidelity_jpeg_to_png_dimensions() {
        let jpeg = make_jpeg(200, 150);
        let result = convert(jpeg, ImageFormat::Png).unwrap();
        let dims = dimensions(&result).unwrap();
        assert_eq!(dims.width, 200);
        assert_eq!(dims.height, 150);
    }

    #[test]
    fn fidelity_alpha_png_round_trip() {
        let alpha_png = make_alpha_png(50, 50);
        let original = image::load_from_memory(&alpha_png).unwrap().into_rgba8();

        let result = convert(alpha_png, ImageFormat::Png).unwrap();
        let decoded = image::load_from_memory(&result).unwrap().into_rgba8();
        assert_eq!(original.dimensions(), decoded.dimensions());
        assert_eq!(
            original.as_raw(),
            decoded.as_raw(),
            "Alpha channel should be preserved in PNG→PNG round-trip"
        );
    }

    #[test]
    fn fidelity_alpha_png_to_gif() {
        let alpha_png = make_alpha_png(10, 10);
        let original = image::load_from_memory(&alpha_png).unwrap().into_rgba8();

        let result = convert(alpha_png, ImageFormat::Gif).unwrap();
        let decoded = image::load_from_memory(&result).unwrap().into_rgba8();
        assert_eq!(original.dimensions(), decoded.dimensions());

        // GIF has 1-bit alpha: verify transparent pixels stay transparent,
        // opaque pixels stay opaque.
        for (orig_px, dec_px) in original.pixels().zip(decoded.pixels()) {
            if orig_px.0[3] == 0 {
                assert_eq!(
                    dec_px.0[3], 0,
                    "Transparent pixels should remain transparent in GIF"
                );
            } else {
                assert!(dec_px.0[3] > 0, "Opaque pixels should remain opaque in GIF");
            }
        }
    }

    // ===== Dimension Reading Tests =====

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
    fn dimensions_wide() {
        let png = make_png(10000, 100);
        let dims = dimensions(&png).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 10000,
                height: 100
            }
        );
    }

    #[test]
    fn dimensions_tall() {
        let png = make_png(100, 10000);
        let dims = dimensions(&png).unwrap();
        assert_eq!(
            dims,
            Dimensions {
                width: 100,
                height: 10000
            }
        );
    }

    #[test]
    fn dimensions_empty_input() {
        let result = dimensions(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn dimensions_random_bytes() {
        let garbage = [0xDE, 0xAD, 0xBE, 0xEF];
        let result = dimensions(&garbage);
        assert!(result.is_err());
    }

    #[test]
    fn dimensions_truncated_header() {
        let png = make_png(10, 10);
        // PNG signature is 8 bytes; truncate mid-header so dimensions can't be read
        let truncated = &png[..10.min(png.len())];
        let result = dimensions(truncated);
        assert!(result.is_err());
    }
}
