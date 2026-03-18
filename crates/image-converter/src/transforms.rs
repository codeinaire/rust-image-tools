use std::fmt;

use image::DynamicImage;

/// Supported image transforms that can be applied before format conversion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transform {
    /// Mirror the image along the vertical axis (left becomes right).
    FlipHorizontal,
    /// Mirror the image along the horizontal axis (top becomes bottom).
    FlipVertical,
    /// Rotate the image 90 degrees clockwise. Swaps width and height.
    Rotate90,
    /// Rotate the image 180 degrees.
    Rotate180,
    /// Rotate the image 270 degrees clockwise (90 degrees counter-clockwise). Swaps width and height.
    Rotate270,
    /// Convert the image to grayscale.
    Grayscale,
    /// Invert all color channels.
    Invert,
}

impl Transform {
    /// Parses a transform name string into a `Transform`.
    ///
    /// Accepts: `"flip_horizontal"`, `"flip_vertical"`, `"rotate_90"`, `"rotate_180"`,
    /// `"rotate_270"`, `"grayscale"`, `"invert"`.
    ///
    /// Returns an error if the string is not a recognized transform name.
    pub fn from_name(name: &str) -> Result<Self, TransformError> {
        match name {
            "flip_horizontal" => Ok(Self::FlipHorizontal),
            "flip_vertical" => Ok(Self::FlipVertical),
            "rotate_90" => Ok(Self::Rotate90),
            "rotate_180" => Ok(Self::Rotate180),
            "rotate_270" => Ok(Self::Rotate270),
            "grayscale" => Ok(Self::Grayscale),
            "invert" => Ok(Self::Invert),
            _ => Err(TransformError::UnknownTransform(name.to_owned())),
        }
    }

    /// Applies this transform to the given image, returning the transformed result.
    pub fn apply(self, img: DynamicImage) -> DynamicImage {
        match self {
            Self::FlipHorizontal => img.fliph(),
            Self::FlipVertical => img.flipv(),
            Self::Rotate90 => img.rotate90(),
            Self::Rotate180 => img.rotate180(),
            Self::Rotate270 => img.rotate270(),
            Self::Grayscale => img.grayscale(),
            Self::Invert => {
                let mut img = img;
                img.invert();
                img
            }
        }
    }
}

/// Applies a sequence of transforms to an image in order.
///
/// Each transform is applied to the result of the previous one. An empty slice
/// returns the image unchanged.
pub fn apply_transforms(img: DynamicImage, transforms: &[Transform]) -> DynamicImage {
    transforms
        .iter()
        .fold(img, |acc, transform| transform.apply(acc))
}

/// Parses a comma-separated string of transform names into a `Vec<Transform>`.
///
/// An empty string returns an empty vector. Whitespace around names is trimmed.
///
/// # Errors
///
/// Returns a `TransformError::UnknownTransform` if any name is not recognized.
pub fn parse_transforms(input: &str) -> Result<Vec<Transform>, TransformError> {
    if input.is_empty() {
        return Ok(Vec::new());
    }

    input
        .split(',')
        .map(|name| Transform::from_name(name.trim()))
        .collect()
}

/// Errors that can occur during transform parsing.
#[derive(Debug)]
pub enum TransformError {
    /// The transform name was not recognized.
    UnknownTransform(String),
}

impl fmt::Display for TransformError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownTransform(name) => write!(f, "Unknown transform: \"{name}\""),
        }
    }
}

impl std::error::Error for TransformError {}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    // ===== Fixture Helpers =====

    fn make_patterned_rgba(width: u32, height: u32) -> image::RgbaImage {
        let mut img = image::RgbaImage::new(width, height);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            #[allow(clippy::as_conversions)]
            // Safe: wrapping_mul and modulo 256 guarantee values fit in u8.
            {
                *pixel = image::Rgba([
                    (x.wrapping_mul(37) % 256) as u8,
                    (y.wrapping_mul(53) % 256) as u8,
                    (x.wrapping_add(y).wrapping_mul(17) % 256) as u8,
                    255,
                ]);
            }
        }
        img
    }

    fn make_dynamic_image(width: u32, height: u32) -> DynamicImage {
        DynamicImage::ImageRgba8(make_patterned_rgba(width, height))
    }

    fn make_solid_rgba(width: u32, height: u32, color: [u8; 4]) -> DynamicImage {
        let mut img = image::RgbaImage::new(width, height);
        for pixel in img.pixels_mut() {
            *pixel = image::Rgba(color);
        }
        DynamicImage::ImageRgba8(img)
    }

    fn encode_png(img: &DynamicImage) -> Vec<u8> {
        let mut buf = Vec::new();
        img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    // ===== from_name Tests =====

    #[test]
    fn from_name_all_transforms() {
        assert_eq!(
            Transform::from_name("flip_horizontal").unwrap(),
            Transform::FlipHorizontal
        );
        assert_eq!(
            Transform::from_name("flip_vertical").unwrap(),
            Transform::FlipVertical
        );
        assert_eq!(
            Transform::from_name("rotate_90").unwrap(),
            Transform::Rotate90
        );
        assert_eq!(
            Transform::from_name("rotate_180").unwrap(),
            Transform::Rotate180
        );
        assert_eq!(
            Transform::from_name("rotate_270").unwrap(),
            Transform::Rotate270
        );
        assert_eq!(
            Transform::from_name("grayscale").unwrap(),
            Transform::Grayscale
        );
        assert_eq!(Transform::from_name("invert").unwrap(), Transform::Invert);
    }

    #[test]
    fn from_name_unknown() {
        let result = Transform::from_name("blur");
        assert!(matches!(result, Err(TransformError::UnknownTransform(_))));
    }

    #[test]
    fn from_name_empty() {
        let result = Transform::from_name("");
        assert!(matches!(result, Err(TransformError::UnknownTransform(_))));
    }

    // ===== parse_transforms Tests =====

    #[test]
    fn parse_empty_string() {
        let transforms = parse_transforms("").unwrap();
        assert!(transforms.is_empty());
    }

    #[test]
    fn parse_single_transform() {
        let transforms = parse_transforms("rotate_90").unwrap();
        assert_eq!(transforms, vec![Transform::Rotate90]);
    }

    #[test]
    fn parse_multiple_transforms() {
        let transforms = parse_transforms("rotate_90,flip_horizontal,grayscale").unwrap();
        assert_eq!(
            transforms,
            vec![
                Transform::Rotate90,
                Transform::FlipHorizontal,
                Transform::Grayscale
            ]
        );
    }

    #[test]
    fn parse_with_whitespace() {
        let transforms = parse_transforms("rotate_90 , flip_horizontal").unwrap();
        assert_eq!(
            transforms,
            vec![Transform::Rotate90, Transform::FlipHorizontal]
        );
    }

    #[test]
    fn parse_unknown_transform_returns_error() {
        let result = parse_transforms("rotate_90,blur");
        assert!(result.is_err());
    }

    // ===== Dimension Tests =====

    #[test]
    fn rotate_90_swaps_dimensions() {
        let img = make_dynamic_image(50, 40);
        let rotated = Transform::Rotate90.apply(img);
        assert_eq!(rotated.width(), 40);
        assert_eq!(rotated.height(), 50);
    }

    #[test]
    fn rotate_180_preserves_dimensions() {
        let img = make_dynamic_image(50, 40);
        let rotated = Transform::Rotate180.apply(img);
        assert_eq!(rotated.width(), 50);
        assert_eq!(rotated.height(), 40);
    }

    #[test]
    fn rotate_270_swaps_dimensions() {
        let img = make_dynamic_image(50, 40);
        let rotated = Transform::Rotate270.apply(img);
        assert_eq!(rotated.width(), 40);
        assert_eq!(rotated.height(), 50);
    }

    #[test]
    fn flip_preserves_dimensions() {
        let img = make_dynamic_image(50, 40);
        let flipped_h = Transform::FlipHorizontal.apply(img.clone());
        assert_eq!(flipped_h.width(), 50);
        assert_eq!(flipped_h.height(), 40);

        let flipped_v = Transform::FlipVertical.apply(img);
        assert_eq!(flipped_v.width(), 50);
        assert_eq!(flipped_v.height(), 40);
    }

    // ===== Pixel Correctness Tests =====

    #[test]
    fn invert_pixel_values() {
        let img = make_solid_rgba(2, 2, [100, 150, 200, 255]);
        let inverted = Transform::Invert.apply(img);
        let rgba = inverted.into_rgba8();
        for pixel in rgba.pixels() {
            assert_eq!(pixel.0[0], 155, "R should be 255 - 100");
            assert_eq!(pixel.0[1], 105, "G should be 255 - 150");
            assert_eq!(pixel.0[2], 55, "B should be 255 - 200");
            assert_eq!(pixel.0[3], 255, "Alpha should be unchanged");
        }
    }

    #[test]
    fn grayscale_produces_equal_rgb() {
        let img = make_dynamic_image(10, 10);
        let gray = Transform::Grayscale.apply(img);
        // Grayscale may produce ImageLuma8 internally; convert to rgba to inspect
        let rgba = gray.into_rgba8();
        for pixel in rgba.pixels() {
            assert_eq!(
                pixel.0[0], pixel.0[1],
                "R and G should be equal in grayscale"
            );
            assert_eq!(
                pixel.0[1], pixel.0[2],
                "G and B should be equal in grayscale"
            );
        }
    }

    #[test]
    fn flip_horizontal_mirrors_pixels() {
        let img = make_dynamic_image(4, 2);
        let original = img.to_rgba8();
        let flipped = Transform::FlipHorizontal.apply(img);
        let flipped_rgba = flipped.to_rgba8();

        for y in 0..2u32 {
            for x in 0..4u32 {
                let orig_pixel = original.get_pixel(x, y);
                let flipped_pixel = flipped_rgba.get_pixel(3 - x, y);
                assert_eq!(
                    orig_pixel,
                    flipped_pixel,
                    "Pixel at ({x},{y}) should match flipped pixel at ({},{})",
                    3 - x,
                    y
                );
            }
        }
    }

    #[test]
    fn flip_vertical_mirrors_pixels() {
        let img = make_dynamic_image(2, 4);
        let original = img.to_rgba8();
        let flipped = Transform::FlipVertical.apply(img);
        let flipped_rgba = flipped.to_rgba8();

        for y in 0..4u32 {
            for x in 0..2u32 {
                let orig_pixel = original.get_pixel(x, y);
                let flipped_pixel = flipped_rgba.get_pixel(x, 3 - y);
                assert_eq!(
                    orig_pixel,
                    flipped_pixel,
                    "Pixel at ({x},{y}) should match flipped pixel at ({x},{})",
                    3 - y
                );
            }
        }
    }

    // ===== Identity / Composition Tests =====

    #[test]
    fn rotate_90_four_times_is_identity() {
        let img = make_dynamic_image(10, 8);
        let original_data = encode_png(&img);

        let rotated = apply_transforms(
            img,
            &[
                Transform::Rotate90,
                Transform::Rotate90,
                Transform::Rotate90,
                Transform::Rotate90,
            ],
        );
        let rotated_data = encode_png(&rotated);

        assert_eq!(
            original_data, rotated_data,
            "4x rotate_90 should produce identical image"
        );
    }

    #[test]
    fn double_invert_is_identity() {
        let img = make_dynamic_image(10, 10);
        let original_rgba = img.to_rgba8().into_raw();

        let double_inverted = apply_transforms(img, &[Transform::Invert, Transform::Invert]);
        let result_rgba = double_inverted.into_rgba8().into_raw();

        assert_eq!(
            original_rgba, result_rgba,
            "Double invert should produce identical image"
        );
    }

    #[test]
    fn double_flip_h_is_identity() {
        let img = make_dynamic_image(10, 10);
        let original_data = encode_png(&img);

        let double_flipped =
            apply_transforms(img, &[Transform::FlipHorizontal, Transform::FlipHorizontal]);
        let result_data = encode_png(&double_flipped);

        assert_eq!(
            original_data, result_data,
            "Double flip horizontal should produce identical image"
        );
    }

    #[test]
    fn empty_transforms_is_identity() {
        let img = make_dynamic_image(10, 10);
        let original_data = encode_png(&img);

        let result = apply_transforms(img, &[]);
        let result_data = encode_png(&result);

        assert_eq!(
            original_data, result_data,
            "Empty transforms should produce identical image"
        );
    }

    #[test]
    fn multiple_transforms_applied_in_order() {
        // Rotate 90, then flip horizontal — order matters
        let img = make_dynamic_image(10, 8);
        let result_a = apply_transforms(
            img.clone(),
            &[Transform::Rotate90, Transform::FlipHorizontal],
        );
        let result_b = apply_transforms(img, &[Transform::FlipHorizontal, Transform::Rotate90]);

        // Different order should produce different results (for non-square images)
        let data_a = encode_png(&result_a);
        let data_b = encode_png(&result_b);
        assert_ne!(
            data_a, data_b,
            "Different transform orders should produce different results"
        );
    }

    // ===== Error Display =====

    #[test]
    fn transform_error_display() {
        let err = TransformError::UnknownTransform("blur".to_owned());
        assert_eq!(err.to_string(), "Unknown transform: \"blur\"");
    }
}
