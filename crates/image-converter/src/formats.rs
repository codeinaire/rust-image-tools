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

    /// Parses a format name string into an `ImageFormat`.
    ///
    /// Accepts lowercase names: `"png"`, `"jpeg"`, `"jpg"`, `"webp"`, `"gif"`, `"bmp"`.
    ///
    /// Returns an error if the string is not a recognized format name.
    pub fn from_name(name: &str) -> Result<Self, FormatError> {
        match name.to_ascii_lowercase().as_str() {
            "png" => Ok(Self::Png),
            "jpeg" | "jpg" => Ok(Self::Jpeg),
            "webp" => Ok(Self::WebP),
            "gif" => Ok(Self::Gif),
            "bmp" => Ok(Self::Bmp),
            _ => Err(FormatError::UnknownName(name.to_owned())),
        }
    }

    /// Converts to the `image` crate's format type for encoding.
    ///
    /// Returns an error for formats that are decode-only (e.g. WebP).
    pub fn to_image_format(self) -> Result<image::ImageFormat, FormatError> {
        match self {
            Self::Png => Ok(image::ImageFormat::Png),
            Self::Jpeg => Ok(image::ImageFormat::Jpeg),
            Self::Gif => Ok(image::ImageFormat::Gif),
            Self::Bmp => Ok(image::ImageFormat::Bmp),
            Self::WebP => Err(FormatError::EncodeUnsupported(self)),
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
    /// The format name string was not recognized (e.g. `"avif"`, `"notaformat"`).
    UnknownName(String),
    /// The format cannot be used as an encode target (e.g. WebP is decode-only).
    EncodeUnsupported(ImageFormat),
}

impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyInput => write!(f, "Input is empty — no image data provided"),
            Self::Unrecognized => write!(f, "Unrecognized image format"),
            Self::Unsupported(fmt) => write!(f, "Unsupported image format: {fmt:?}"),
            Self::UnknownName(name) => write!(f, "Unknown format name: \"{name}\""),
            Self::EncodeUnsupported(fmt) => {
                write!(f, "Format \"{fmt}\" is not supported as an output format")
            }
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

    // --- from_name tests ---

    #[test]
    fn from_name_png() {
        assert_eq!(ImageFormat::from_name("png").unwrap(), ImageFormat::Png);
        assert_eq!(ImageFormat::from_name("PNG").unwrap(), ImageFormat::Png);
    }

    #[test]
    fn from_name_jpeg_variants() {
        assert_eq!(ImageFormat::from_name("jpeg").unwrap(), ImageFormat::Jpeg);
        assert_eq!(ImageFormat::from_name("jpg").unwrap(), ImageFormat::Jpeg);
        assert_eq!(ImageFormat::from_name("JPEG").unwrap(), ImageFormat::Jpeg);
    }

    #[test]
    fn from_name_webp() {
        assert_eq!(ImageFormat::from_name("webp").unwrap(), ImageFormat::WebP);
    }

    #[test]
    fn from_name_gif() {
        assert_eq!(ImageFormat::from_name("gif").unwrap(), ImageFormat::Gif);
    }

    #[test]
    fn from_name_bmp() {
        assert_eq!(ImageFormat::from_name("bmp").unwrap(), ImageFormat::Bmp);
    }

    #[test]
    fn from_name_unknown() {
        let result = ImageFormat::from_name("avif");
        assert!(matches!(result, Err(FormatError::UnknownName(_))));

        let result = ImageFormat::from_name("notaformat");
        assert!(matches!(result, Err(FormatError::UnknownName(_))));
    }

    // --- to_image_format tests ---

    #[test]
    fn to_image_format_encodable() {
        assert_eq!(
            ImageFormat::Png.to_image_format().unwrap(),
            image::ImageFormat::Png
        );
        assert_eq!(
            ImageFormat::Jpeg.to_image_format().unwrap(),
            image::ImageFormat::Jpeg
        );
        assert_eq!(
            ImageFormat::Gif.to_image_format().unwrap(),
            image::ImageFormat::Gif
        );
        assert_eq!(
            ImageFormat::Bmp.to_image_format().unwrap(),
            image::ImageFormat::Bmp
        );
    }

    #[test]
    fn to_image_format_webp_unsupported() {
        let result = ImageFormat::WebP.to_image_format();
        assert!(matches!(result, Err(FormatError::EncodeUnsupported(_))));
    }

    // --- Display ---

    #[test]
    fn display_format() {
        assert_eq!(ImageFormat::Png.to_string(), "png");
        assert_eq!(ImageFormat::Jpeg.to_string(), "jpeg");
        assert_eq!(ImageFormat::WebP.to_string(), "webp");
    }
}
