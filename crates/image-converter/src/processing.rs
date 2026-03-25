use std::fmt;

use image::imageops::FilterType;
use image::DynamicImage;

/// Supported resize filter algorithms.
///
/// Each variant maps to an `image::imageops::FilterType` used during resize operations.
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResizeFilter {
    /// Nearest-neighbor interpolation (fastest, pixelated).
    Nearest,
    /// Bilinear interpolation.
    Triangle,
    /// Catmull-Rom bicubic interpolation.
    CatmullRom,
    /// Gaussian interpolation.
    Gaussian,
    /// Lanczos with window 3 (sharpest, slowest).
    Lanczos3,
}

impl ResizeFilter {
    /// Converts this filter to the corresponding `image::imageops::FilterType`.
    pub fn to_filter_type(self) -> FilterType {
        match self {
            Self::Nearest => FilterType::Nearest,
            Self::Triangle => FilterType::Triangle,
            Self::CatmullRom => FilterType::CatmullRom,
            Self::Gaussian => FilterType::Gaussian,
            Self::Lanczos3 => FilterType::Lanczos3,
        }
    }
}

/// A single image processing operation with its parameters.
///
/// Operations are applied in sequence. The `type` field is used as the serde tag
/// for JSON deserialization from JavaScript.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProcessingOperation {
    /// Resize preserving aspect ratio to fit within the given dimensions.
    Resize {
        width: u32,
        height: u32,
        filter: ResizeFilter,
    },
    /// Resize to exact dimensions (may distort aspect ratio).
    ResizeExact {
        width: u32,
        height: u32,
        filter: ResizeFilter,
    },
    /// Generate a thumbnail that fits within the given max dimensions.
    Thumbnail { max_width: u32, max_height: u32 },
    /// Crop a rectangular region from the image.
    Crop {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    /// Apply Gaussian blur with the given sigma.
    Blur { sigma: f32 },
    /// Apply fast (box) blur with the given sigma.
    FastBlur { sigma: f32 },
    /// Apply unsharpen mask with the given sigma and threshold.
    Unsharpen { sigma: f32, threshold: i32 },
    /// Adjust brightness by the given amount (-255 to 255).
    Brighten { value: i32 },
    /// Adjust contrast by the given amount (-100.0 to 100.0).
    Contrast { value: f32 },
    /// Rotate the hue by the given degrees (0 to 360).
    HueRotate { degrees: i32 },
}

impl ProcessingOperation {
    /// Applies this operation to the given image.
    ///
    /// # Errors
    ///
    /// Returns a `ProcessingError` if the operation parameters are invalid
    /// (e.g., zero dimensions, crop exceeding image bounds, out-of-range values).
    #[allow(clippy::needless_pass_by_value)]
    pub fn apply(self, img: &DynamicImage) -> Result<DynamicImage, ProcessingError> {
        match self {
            Self::Resize {
                width,
                height,
                filter,
            } => {
                if width == 0 || height == 0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Resize dimensions must be greater than 0".to_owned(),
                    ));
                }
                Ok(img.resize(width, height, filter.to_filter_type()))
            }
            Self::ResizeExact {
                width,
                height,
                filter,
            } => {
                if width == 0 || height == 0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Resize dimensions must be greater than 0".to_owned(),
                    ));
                }
                Ok(img.resize_exact(width, height, filter.to_filter_type()))
            }
            Self::Thumbnail {
                max_width,
                max_height,
            } => {
                if max_width == 0 || max_height == 0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Thumbnail dimensions must be greater than 0".to_owned(),
                    ));
                }
                Ok(img.thumbnail(max_width, max_height))
            }
            Self::Crop {
                x,
                y,
                width,
                height,
            } => {
                if width == 0 || height == 0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Crop dimensions must be greater than 0".to_owned(),
                    ));
                }
                let img_width = img.width();
                let img_height = img.height();
                if x.saturating_add(width) > img_width || y.saturating_add(height) > img_height {
                    return Err(ProcessingError::InvalidParameter(format!(
                        "Crop region (x={x}, y={y}, w={width}, h={height}) exceeds image bounds ({img_width}x{img_height})"
                    )));
                }
                Ok(img.crop_imm(x, y, width, height))
            }
            Self::Blur { sigma } => {
                if sigma <= 0.0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Blur sigma must be greater than 0".to_owned(),
                    ));
                }
                Ok(img.blur(sigma))
            }
            Self::FastBlur { sigma } => {
                if sigma <= 0.0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Fast blur sigma must be greater than 0".to_owned(),
                    ));
                }
                // image::imageops::blur uses a fast approximation when called via
                // DynamicImage::blur, but for an explicit "fast blur" we use the
                // same function — the `image` crate's blur IS a fast Gaussian
                // approximation. We keep the variant for API clarity.
                Ok(img.blur(sigma))
            }
            Self::Unsharpen { sigma, threshold } => {
                if sigma <= 0.0 {
                    return Err(ProcessingError::InvalidParameter(
                        "Unsharpen sigma must be greater than 0".to_owned(),
                    ));
                }
                Ok(img.unsharpen(sigma, threshold))
            }
            Self::Brighten { value } => {
                if !(-255..=255).contains(&value) {
                    return Err(ProcessingError::InvalidParameter(format!(
                        "Brighten value must be between -255 and 255, got {value}"
                    )));
                }
                Ok(img.brighten(value))
            }
            Self::Contrast { value } => {
                if !(-100.0..=100.0).contains(&value) {
                    return Err(ProcessingError::InvalidParameter(format!(
                        "Contrast value must be between -100.0 and 100.0, got {value}"
                    )));
                }
                Ok(img.adjust_contrast(value))
            }
            Self::HueRotate { degrees } => {
                if !(0..=360).contains(&degrees) {
                    return Err(ProcessingError::InvalidParameter(format!(
                        "Hue rotation must be between 0 and 360 degrees, got {degrees}"
                    )));
                }
                Ok(img.huerotate(degrees))
            }
        }
    }
}

/// Applies a sequence of processing operations to an image in order.
///
/// Each operation is applied to the result of the previous one. An empty slice
/// returns the image unchanged.
///
/// # Errors
///
/// Returns the first `ProcessingError` encountered during processing.
pub fn apply_operations(
    img: DynamicImage,
    operations: &[ProcessingOperation],
) -> Result<DynamicImage, ProcessingError> {
    operations
        .iter()
        .try_fold(img, |acc, op| op.clone().apply(&acc))
}

/// Errors that can occur during image processing operations.
#[derive(Debug)]
pub enum ProcessingError {
    /// An operation parameter was invalid (e.g., zero dimension, out of range).
    InvalidParameter(String),
}

impl fmt::Display for ProcessingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidParameter(msg) => write!(f, "Invalid processing parameter: {msg}"),
        }
    }
}

impl std::error::Error for ProcessingError {}

#[cfg(test)]
mod tests {
    use super::*;

    // ===== Fixture Helpers =====

    fn make_test_image(width: u32, height: u32) -> DynamicImage {
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
        DynamicImage::ImageRgba8(img)
    }

    // ===== Resize Tests =====

    #[test]
    fn resize_changes_dimensions() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Resize {
            width: 50,
            height: 25,
            filter: ResizeFilter::Lanczos3,
        };
        let result = op.apply(&img).unwrap();
        // resize preserves aspect ratio, so output fits within 50x25
        assert!(result.width() <= 50);
        assert!(result.height() <= 25);
    }

    #[test]
    fn resize_exact_forces_dimensions() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::ResizeExact {
            width: 30,
            height: 40,
            filter: ResizeFilter::Nearest,
        };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 30);
        assert_eq!(result.height(), 40);
    }

    #[test]
    fn resize_zero_width_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Resize {
            width: 0,
            height: 25,
            filter: ResizeFilter::Lanczos3,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn resize_zero_height_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Resize {
            width: 50,
            height: 0,
            filter: ResizeFilter::Lanczos3,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn resize_exact_zero_width_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::ResizeExact {
            width: 0,
            height: 25,
            filter: ResizeFilter::Nearest,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Thumbnail Tests =====

    #[test]
    fn thumbnail_preserves_aspect_ratio() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Thumbnail {
            max_width: 30,
            max_height: 30,
        };
        let result = op.apply(&img).unwrap();
        // 100x50 at 2:1 ratio, fitting in 30x30 -> 30x15
        assert_eq!(result.width(), 30);
        assert_eq!(result.height(), 15);
    }

    #[test]
    fn thumbnail_zero_dimension_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Thumbnail {
            max_width: 0,
            max_height: 30,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Crop Tests =====

    #[test]
    fn crop_produces_correct_dimensions() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Crop {
            x: 10,
            y: 10,
            width: 20,
            height: 20,
        };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 20);
        assert_eq!(result.height(), 20);
    }

    #[test]
    fn crop_exceeding_bounds_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Crop {
            x: 90,
            y: 10,
            width: 20,
            height: 20,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn crop_zero_width_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Crop {
            x: 0,
            y: 0,
            width: 0,
            height: 20,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn crop_y_overflow_fails() {
        let img = make_test_image(100, 50);
        let op = ProcessingOperation::Crop {
            x: 0,
            y: 40,
            width: 20,
            height: 20,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Blur Tests =====

    #[test]
    fn blur_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Blur { sigma: 2.0 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn blur_zero_sigma_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Blur { sigma: 0.0 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn blur_negative_sigma_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Blur { sigma: -1.0 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Fast Blur Tests =====

    #[test]
    fn fast_blur_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::FastBlur { sigma: 2.0 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn fast_blur_zero_sigma_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::FastBlur { sigma: 0.0 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Unsharpen Tests =====

    #[test]
    fn unsharpen_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Unsharpen {
            sigma: 2.0,
            threshold: 5,
        };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn unsharpen_zero_sigma_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Unsharpen {
            sigma: 0.0,
            threshold: 5,
        };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    // ===== Brighten Tests =====

    #[test]
    fn brighten_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Brighten { value: 50 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn brighten_negative_works() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Brighten { value: -50 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn brighten_out_of_range_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Brighten { value: 256 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn brighten_negative_out_of_range_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Brighten { value: -256 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn brighten_boundary_255_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::Brighten { value: 255 };
        assert!(op.apply(&img).is_ok());
    }

    #[test]
    fn brighten_boundary_neg255_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::Brighten { value: -255 };
        assert!(op.apply(&img).is_ok());
    }

    // ===== Contrast Tests =====

    #[test]
    fn contrast_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Contrast { value: 25.0 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn contrast_out_of_range_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Contrast { value: 101.0 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn contrast_negative_out_of_range_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::Contrast { value: -101.0 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn contrast_boundary_100_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::Contrast { value: 100.0 };
        assert!(op.apply(&img).is_ok());
    }

    #[test]
    fn contrast_boundary_neg100_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::Contrast { value: -100.0 };
        assert!(op.apply(&img).is_ok());
    }

    // ===== HueRotate Tests =====

    #[test]
    fn hue_rotate_preserves_dimensions() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::HueRotate { degrees: 180 };
        let result = op.apply(&img).unwrap();
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 50);
    }

    #[test]
    fn hue_rotate_out_of_range_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::HueRotate { degrees: 361 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn hue_rotate_negative_fails() {
        let img = make_test_image(50, 50);
        let op = ProcessingOperation::HueRotate { degrees: -1 };
        let result = op.apply(&img);
        assert!(result.is_err());
    }

    #[test]
    fn hue_rotate_boundary_0_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::HueRotate { degrees: 0 };
        assert!(op.apply(&img).is_ok());
    }

    #[test]
    fn hue_rotate_boundary_360_works() {
        let img = make_test_image(10, 10);
        let op = ProcessingOperation::HueRotate { degrees: 360 };
        assert!(op.apply(&img).is_ok());
    }

    // ===== Operation Chaining Tests =====

    #[test]
    fn chained_resize_then_crop() {
        let img = make_test_image(100, 100);
        let ops = vec![
            ProcessingOperation::Resize {
                width: 50,
                height: 50,
                filter: ResizeFilter::Nearest,
            },
            ProcessingOperation::Crop {
                x: 5,
                y: 5,
                width: 20,
                height: 20,
            },
        ];
        let result = apply_operations(img, &ops).unwrap();
        assert_eq!(result.width(), 20);
        assert_eq!(result.height(), 20);
    }

    #[test]
    fn empty_operations_returns_unchanged() {
        let img = make_test_image(50, 50);
        let original_rgba = img.to_rgba8().into_raw();
        let result = apply_operations(img, &[]).unwrap();
        let result_rgba = result.to_rgba8().into_raw();
        assert_eq!(original_rgba, result_rgba);
    }

    #[test]
    fn chained_operation_error_stops_pipeline() {
        let img = make_test_image(50, 50);
        let ops = vec![
            ProcessingOperation::Brighten { value: 10 },
            ProcessingOperation::Blur { sigma: 0.0 }, // invalid
            ProcessingOperation::Contrast { value: 10.0 },
        ];
        let result = apply_operations(img, &ops);
        assert!(result.is_err());
    }

    // ===== All Filters Work =====

    #[test]
    fn all_resize_filters_work() {
        let img = make_test_image(50, 50);
        let filters = [
            ResizeFilter::Nearest,
            ResizeFilter::Triangle,
            ResizeFilter::CatmullRom,
            ResizeFilter::Gaussian,
            ResizeFilter::Lanczos3,
        ];
        for filter in filters {
            let op = ProcessingOperation::Resize {
                width: 25,
                height: 25,
                filter,
            };
            let result = op.apply(&img).unwrap();
            assert!(result.width() <= 25);
            assert!(result.height() <= 25);
        }
    }

    // ===== Error Display =====

    #[test]
    fn processing_error_display() {
        let err = ProcessingError::InvalidParameter("test error".to_owned());
        assert_eq!(err.to_string(), "Invalid processing parameter: test error");
    }
}
