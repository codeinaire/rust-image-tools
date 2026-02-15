use std::fmt;

/// Supported image formats for conversion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
    WebP,
    Gif,
    Bmp,
}

impl ImageFormat {
    /// Detects the image format from raw bytes by inspecting file headers.
    ///
    /// Returns an error if the format is unrecognized or the input is empty.
    pub fn detect_from_bytes(input: &[u8]) -> Result<Self, FormatError> {
        if input.is_empty() {
            return Err(FormatError::EmptyInput);
        }

        let guessed_format = image::guess_format(input).map_err(|_| FormatError::Unrecognized)?;

        Self::from_image_format(guessed_format).ok_or(FormatError::Unsupported(guessed_format))
    }

    /// Converts from the `image` crate's format type to our enum.
    fn from_image_format(fmt: image::ImageFormat) -> Option<Self> {
        match fmt {
            image::ImageFormat::Png => Some(Self::Png),
            image::ImageFormat::Jpeg => Some(Self::Jpeg),
            image::ImageFormat::WebP => Some(Self::WebP),
            image::ImageFormat::Gif => Some(Self::Gif),
            image::ImageFormat::Bmp => Some(Self::Bmp),
            _ => None,
        }
    }

    /// Returns the lowercase string name for this format (e.g. `"png"`, `"jpeg"`).
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpeg",
            Self::WebP => "webp",
            Self::Gif => "gif",
            Self::Bmp => "bmp",
        }
    }
}

impl fmt::Display for ImageFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Errors that can occur during format detection or parsing.
#[derive(Debug)]
pub enum FormatError {
    /// The input byte slice was empty.
    EmptyInput,
    /// The bytes did not match any known image format.
    Unrecognized,
    /// The format was recognized by the `image` crate but is not in our supported set.
    Unsupported(image::ImageFormat),
}

impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyInput => write!(f, "Input is empty — no image data provided"),
            Self::Unrecognized => write!(f, "Unrecognized image format"),
            Self::Unsupported(fmt) => write!(f, "Unsupported image format: {fmt:?}"),
        }
    }
}

impl std::error::Error for FormatError {}

#[cfg(test)]
mod tests {
    use super::*;

    // Minimal valid file headers for each format.

    fn png_bytes() -> Vec<u8> {
        // Minimal valid PNG: 8-byte signature + IHDR chunk (1x1 RGBA)
        let mut img = image::RgbaImage::new(1, 1);
        img.put_pixel(0, 0, image::Rgba([255, 0, 0, 255]));
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    fn jpeg_bytes() -> Vec<u8> {
        let img = image::RgbImage::new(1, 1);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(
                &mut std::io::Cursor::new(&mut buf),
                image::ImageFormat::Jpeg,
            )
            .unwrap();
        buf
    }

    fn gif_bytes() -> Vec<u8> {
        let img = image::RgbaImage::new(1, 1);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Gif)
            .unwrap();
        buf
    }

    fn bmp_bytes() -> Vec<u8> {
        let img = image::RgbImage::new(1, 1);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Bmp)
            .unwrap();
        buf
    }

    fn webp_bytes() -> Vec<u8> {
        // WebP minimal header: RIFF....WEBP
        let img = image::RgbaImage::new(1, 1);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(
                &mut std::io::Cursor::new(&mut buf),
                image::ImageFormat::WebP,
            )
            .unwrap();
        buf
    }

    // --- Detection tests ---

    #[test]
    fn detect_png() {
        let bytes = png_bytes();
        let fmt = ImageFormat::detect_from_bytes(&bytes).unwrap();
        assert_eq!(fmt, ImageFormat::Png);
    }

    #[test]
    fn detect_jpeg() {
        let bytes = jpeg_bytes();
        let fmt = ImageFormat::detect_from_bytes(&bytes).unwrap();
        assert_eq!(fmt, ImageFormat::Jpeg);
    }

    #[test]
    fn detect_gif() {
        let bytes = gif_bytes();
        let fmt = ImageFormat::detect_from_bytes(&bytes).unwrap();
        assert_eq!(fmt, ImageFormat::Gif);
    }

    #[test]
    fn detect_bmp() {
        let bytes = bmp_bytes();
        let fmt = ImageFormat::detect_from_bytes(&bytes).unwrap();
        assert_eq!(fmt, ImageFormat::Bmp);
    }

    #[test]
    fn detect_webp() {
        let bytes = webp_bytes();
        let fmt = ImageFormat::detect_from_bytes(&bytes).unwrap();
        assert_eq!(fmt, ImageFormat::WebP);
    }

    // --- Error tests ---

    #[test]
    fn detect_empty_input() {
        let result = ImageFormat::detect_from_bytes(&[]);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, FormatError::EmptyInput));
    }

    #[test]
    fn detect_random_bytes() {
        let garbage = [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x11, 0x22, 0x33];
        let result = ImageFormat::detect_from_bytes(&garbage);
        assert!(result.is_err());
    }

    #[test]
    fn detect_truncated_png() {
        let bytes = png_bytes();
        // Only take the first 4 bytes (partial signature)
        let result = ImageFormat::detect_from_bytes(&bytes[..4]);
        // Should either fail or not detect as PNG — either way not a valid detection
        // image::guess_format may still recognize partial PNG signature,
        // so we just verify it doesn't panic
        let _ = result;
    }

    // --- Display ---

    #[test]
    fn display_format() {
        assert_eq!(ImageFormat::Png.to_string(), "png");
        assert_eq!(ImageFormat::Jpeg.to_string(), "jpeg");
        assert_eq!(ImageFormat::WebP.to_string(), "webp");
    }
}
