use std::io::Cursor;

use image::ImageDecoder;
use image::ImageReader;
use serde::Serialize;

/// Metadata extracted from an image file.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub color_type: String,
    pub bits_per_pixel: u16,
    pub has_alpha: bool,
    pub has_icc_profile: bool,
    pub exif: ExifData,
    pub png_text_chunks: Vec<TextChunk>,
}

/// Parsed EXIF data with curated fields and optional full field list.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub date_time: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
    pub orientation: Option<String>,
    pub software: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub has_gps: bool,
    pub all_fields: Vec<ExifField>,
}

/// A single EXIF tag/value pair for the "all fields" view.
#[derive(Debug, Clone, Serialize)]
pub struct ExifField {
    pub tag: String,
    pub value: String,
    pub group: String,
}

/// A PNG text chunk (tEXt, zTXt, or iTXt).
#[derive(Debug, Clone, Serialize)]
pub struct TextChunk {
    pub keyword: String,
    pub text: String,
}

/// Errors that can occur during metadata extraction.
#[derive(Debug)]
pub enum MetadataError {
    /// An I/O error occurred.
    Io(std::io::Error),
    /// Failed to decode the image.
    Decode(image::ImageError),
    /// Failed to parse EXIF data.
    ExifParse(String),
    /// Failed to parse PNG data.
    PngParse(String),
}

impl std::fmt::Display for MetadataError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(e) => write!(f, "I/O error reading image: {e}"),
            Self::Decode(e) => write!(f, "Failed to decode image: {e}"),
            Self::ExifParse(msg) => write!(f, "Failed to parse EXIF data: {msg}"),
            Self::PngParse(msg) => write!(f, "Failed to parse PNG data: {msg}"),
        }
    }
}

impl std::error::Error for MetadataError {}

/// Extract metadata from an image without fully decoding pixel data.
///
/// Reads dimensions, color type, ICC profile presence, EXIF data (for formats
/// that support it), and PNG text chunks (for PNG files).
///
/// # Errors
///
/// Returns a `MetadataError` if the format cannot be detected or the image
/// headers cannot be read.
pub fn extract(input: &[u8]) -> Result<ImageMetadata, MetadataError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(MetadataError::Io)?;

    let format_name = reader.format().map(format_to_string).unwrap_or_default();

    let mut decoder = reader.into_decoder().map_err(MetadataError::Decode)?;

    let (width, height) = decoder.dimensions();
    let color_type = decoder.color_type();
    let original_color = decoder.original_color_type();

    // Note: bytes_per_pixel reflects the decoded color type, not the original
    // stored encoding (e.g. a 1-bit BMP decoded to RGB8 reports 24 bits).
    // We use the decoded value because it matches what the `image` crate works with.
    // bytes_per_pixel returns u8, which always fits in u16
    let bits_per_pixel = u16::from(color_type.bytes_per_pixel()) * 8;
    let has_alpha = color_type.has_alpha();
    let has_icc_profile = decoder.icc_profile().ok().flatten().is_some();

    // Extract EXIF data if available
    let exif_bytes = decoder.exif_metadata().ok().flatten();
    let exif = match exif_bytes {
        Some(raw) => parse_exif(raw),
        None => ExifData::default(),
    };

    // Extract PNG text chunks if format is PNG
    let png_text_chunks = if format_name == "png" {
        extract_png_text(input).unwrap_or_default()
    } else {
        Vec::new()
    };

    Ok(ImageMetadata {
        width,
        height,
        format: format_name,
        color_type: format!("{original_color:?}"),
        bits_per_pixel,
        has_alpha,
        has_icc_profile,
        exif,
        png_text_chunks,
    })
}

/// Convert an `image::ImageFormat` to a lowercase string name.
fn format_to_string(format: image::ImageFormat) -> String {
    match format {
        image::ImageFormat::Png => "png".to_owned(),
        image::ImageFormat::Jpeg => "jpeg".to_owned(),
        image::ImageFormat::Gif => "gif".to_owned(),
        image::ImageFormat::WebP => "webp".to_owned(),
        image::ImageFormat::Bmp => "bmp".to_owned(),
        image::ImageFormat::Tiff => "tiff".to_owned(),
        image::ImageFormat::Ico => "ico".to_owned(),
        image::ImageFormat::Tga => "tga".to_owned(),
        image::ImageFormat::Qoi => "qoi".to_owned(),
        // ImageFormat is #[non_exhaustive], so a wildcard is required to handle
        // any future variants added by the `image` crate.
        _ => format!("{format:?}").to_lowercase(),
    }
}

/// Parse raw EXIF bytes into our curated `ExifData` struct.
fn parse_exif(raw: Vec<u8>) -> ExifData {
    let Ok(exif) = exif::Reader::new().read_raw(raw) else {
        return ExifData::default();
    };

    let get_field_str = |tag: exif::Tag| -> Option<String> {
        exif.get_field(tag, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string())
    };

    let camera_make = get_field_str(exif::Tag::Make);
    let camera_model = get_field_str(exif::Tag::Model);
    let date_time =
        get_field_str(exif::Tag::DateTimeOriginal).or_else(|| get_field_str(exif::Tag::DateTime));
    let exposure_time = get_field_str(exif::Tag::ExposureTime);
    let f_number = get_field_str(exif::Tag::FNumber);
    let iso = get_field_str(exif::Tag::PhotographicSensitivity);
    let focal_length = get_field_str(exif::Tag::FocalLength);
    let orientation = get_field_str(exif::Tag::Orientation);
    let software = get_field_str(exif::Tag::Software);

    // GPS coordinates
    let gps_latitude =
        extract_gps_coordinate(&exif, exif::Tag::GPSLatitude, exif::Tag::GPSLatitudeRef);
    let gps_longitude =
        extract_gps_coordinate(&exif, exif::Tag::GPSLongitude, exif::Tag::GPSLongitudeRef);
    let has_gps = gps_latitude.is_some() && gps_longitude.is_some();

    // All fields
    let all_fields = exif
        .fields()
        .map(|f| ExifField {
            tag: f.tag.to_string(),
            value: f.display_value().to_string(),
            group: format!("{:?}", f.ifd_num),
        })
        .collect();

    ExifData {
        camera_make,
        camera_model,
        date_time,
        exposure_time,
        f_number,
        iso,
        focal_length,
        orientation,
        software,
        gps_latitude,
        gps_longitude,
        has_gps,
        all_fields,
    }
}

/// Extract a GPS coordinate (latitude or longitude) from EXIF data.
///
/// Reads the DMS (degrees/minutes/seconds) rational values and the reference
/// direction (N/S or E/W), converting to signed decimal degrees.
fn extract_gps_coordinate(
    exif: &exif::Exif,
    coord_tag: exif::Tag,
    ref_tag: exif::Tag,
) -> Option<f64> {
    let field = exif.get_field(coord_tag, exif::In::PRIMARY)?;
    let degrees = rational_to_decimal_degrees(field)?;

    let ref_field = exif.get_field(ref_tag, exif::In::PRIMARY)?;
    let ref_str = ref_field.display_value().to_string();

    // South and West are negative
    let sign = if ref_str.contains('S') || ref_str.contains('W') {
        -1.0
    } else {
        1.0
    };

    Some(degrees * sign)
}

/// Convert EXIF GPS Rational DMS values to decimal degrees.
///
/// Expects `field.value` to be `Value::Rational` with exactly 3 elements:
/// degrees, minutes, seconds.
fn rational_to_decimal_degrees(field: &exif::Field) -> Option<f64> {
    if let exif::Value::Rational(ref rationals) = field.value {
        if rationals.len() < 3 {
            return None;
        }
        let deg = rationals.first()?;
        let min = rationals.get(1)?;
        let sec = rationals.get(2)?;

        if deg.denom == 0 || min.denom == 0 || sec.denom == 0 {
            return None;
        }

        let degrees = f64::from(deg.num) / f64::from(deg.denom);
        let minutes = f64::from(min.num) / f64::from(min.denom);
        let seconds = f64::from(sec.num) / f64::from(sec.denom);

        Some(degrees + minutes / 60.0 + seconds / 3600.0)
    } else {
        None
    }
}

/// Extract text chunks from a PNG file.
fn extract_png_text(input: &[u8]) -> Result<Vec<TextChunk>, MetadataError> {
    let decoder = png::Decoder::new(Cursor::new(input));
    let reader = decoder
        .read_info()
        .map_err(|e| MetadataError::PngParse(e.to_string()))?;
    let info = reader.info();

    let mut chunks = Vec::new();

    for chunk in &info.uncompressed_latin1_text {
        chunks.push(TextChunk {
            keyword: chunk.keyword.clone(),
            text: chunk.text.clone(),
        });
    }

    for chunk in &info.compressed_latin1_text {
        if let Ok(text) = chunk.get_text() {
            chunks.push(TextChunk {
                keyword: chunk.keyword.clone(),
                text,
            });
        }
    }

    for chunk in &info.utf8_text {
        if let Ok(text) = chunk.get_text() {
            chunks.push(TextChunk {
                keyword: chunk.keyword.clone(),
                text,
            });
        }
    }

    Ok(chunks)
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

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

    fn make_bmp(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbImage::new(width, height);
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Bmp)
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

    fn make_png_with_text(width: u32, height: u32, keyword: &str, text: &str) -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut buf, width, height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let text_chunk =
                png::text_metadata::TEXtChunk::new(keyword.to_owned(), text.to_owned());
            encoder
                .add_text_chunk(text_chunk.keyword.clone(), text_chunk.text.clone())
                .unwrap();
            let mut writer = encoder.write_header().unwrap();
            let data = vec![0u8; (width * height * 4) as usize];
            writer.write_image_data(&data).unwrap();
        }
        buf
    }

    #[test]
    fn extract_basic_metadata_from_png() {
        let png = make_png(100, 50);
        let meta = extract(&png).unwrap();
        assert_eq!(meta.width, 100);
        assert_eq!(meta.height, 50);
        assert_eq!(meta.format, "png");
        assert!(meta.has_alpha);
        assert!(meta.bits_per_pixel > 0);
    }

    #[test]
    fn extract_basic_metadata_from_jpeg() {
        let jpeg = make_jpeg(80, 60);
        let meta = extract(&jpeg).unwrap();
        assert_eq!(meta.width, 80);
        assert_eq!(meta.height, 60);
        assert_eq!(meta.format, "jpeg");
        assert!(!meta.has_alpha);
    }

    #[test]
    fn extract_basic_metadata_from_bmp() {
        let bmp = make_bmp(40, 30);
        let meta = extract(&bmp).unwrap();
        assert_eq!(meta.width, 40);
        assert_eq!(meta.height, 30);
        assert_eq!(meta.format, "bmp");
    }

    #[test]
    fn extract_basic_metadata_from_gif() {
        let gif = make_gif(20, 15);
        let meta = extract(&gif).unwrap();
        assert_eq!(meta.width, 20);
        assert_eq!(meta.height, 15);
        assert_eq!(meta.format, "gif");
    }

    #[test]
    fn extract_no_exif_returns_empty() {
        let png = make_png(10, 10);
        let meta = extract(&png).unwrap();
        assert!(meta.exif.camera_make.is_none());
        assert!(meta.exif.camera_model.is_none());
        assert!(meta.exif.all_fields.is_empty());
        assert!(!meta.exif.has_gps);
    }

    #[test]
    fn extract_png_text_chunks() {
        let png = make_png_with_text(4, 4, "Title", "Test Image");
        let meta = extract(&png).unwrap();
        assert!(!meta.png_text_chunks.is_empty());
        let chunk = meta.png_text_chunks.first().unwrap();
        assert_eq!(chunk.keyword, "Title");
        assert_eq!(chunk.text, "Test Image");
    }

    #[test]
    fn extract_non_png_has_no_text_chunks() {
        let jpeg = make_jpeg(10, 10);
        let meta = extract(&jpeg).unwrap();
        assert!(meta.png_text_chunks.is_empty());
    }

    #[test]
    fn extract_empty_input_returns_error() {
        let result = extract(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn extract_invalid_bytes_returns_error() {
        let garbage = [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01, 0x02, 0x03];
        let result = extract(&garbage);
        assert!(result.is_err());
    }

    #[test]
    fn gps_rational_to_decimal() {
        // 37 degrees, 46 minutes, 29.88 seconds = 37.774966...
        let field = exif::Field {
            tag: exif::Tag::GPSLatitude,
            ifd_num: exif::In::PRIMARY,
            value: exif::Value::Rational(vec![
                exif::Rational { num: 37, denom: 1 },
                exif::Rational { num: 46, denom: 1 },
                exif::Rational {
                    num: 2988,
                    denom: 100,
                },
            ]),
        };
        let degrees = rational_to_decimal_degrees(&field).unwrap();
        let expected = 37.0 + 46.0 / 60.0 + 29.88 / 3600.0;
        assert!(
            (degrees - expected).abs() < 0.0001,
            "Expected {expected}, got {degrees}"
        );
    }

    #[test]
    fn gps_rational_zero_denom_returns_none() {
        let field = exif::Field {
            tag: exif::Tag::GPSLatitude,
            ifd_num: exif::In::PRIMARY,
            value: exif::Value::Rational(vec![
                exif::Rational { num: 37, denom: 0 },
                exif::Rational { num: 46, denom: 1 },
                exif::Rational {
                    num: 2988,
                    denom: 100,
                },
            ]),
        };
        assert!(rational_to_decimal_degrees(&field).is_none());
    }

    #[test]
    fn gps_rational_too_few_values_returns_none() {
        let field = exif::Field {
            tag: exif::Tag::GPSLatitude,
            ifd_num: exif::In::PRIMARY,
            value: exif::Value::Rational(vec![exif::Rational { num: 37, denom: 1 }]),
        };
        assert!(rational_to_decimal_degrees(&field).is_none());
    }

    #[test]
    fn gps_non_rational_value_returns_none() {
        let field = exif::Field {
            tag: exif::Tag::GPSLatitude,
            ifd_num: exif::In::PRIMARY,
            value: exif::Value::Short(vec![37, 46, 30]),
        };
        assert!(rational_to_decimal_degrees(&field).is_none());
    }

    #[test]
    fn icc_profile_detection_png() {
        // Standard PNG without embedded ICC profile
        let png = make_png(4, 4);
        let meta = extract(&png).unwrap();
        assert!(!meta.has_icc_profile);
    }

    #[test]
    fn format_string_correctness() {
        assert_eq!(format_to_string(image::ImageFormat::Png), "png");
        assert_eq!(format_to_string(image::ImageFormat::Jpeg), "jpeg");
        assert_eq!(format_to_string(image::ImageFormat::Gif), "gif");
        assert_eq!(format_to_string(image::ImageFormat::WebP), "webp");
        assert_eq!(format_to_string(image::ImageFormat::Bmp), "bmp");
        assert_eq!(format_to_string(image::ImageFormat::Tiff), "tiff");
    }
}
