// Benchmarks are analogous to tests — unwrap/expect are acceptable here.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::io::Cursor;

use std::time::Duration;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

use image_converter::convert::convert;
use image_converter::formats::ImageFormat;

// ===== Fixture Generation =====
//
// These mirror the helpers in convert.rs tests. Fixtures are generated once per
// benchmark group (not measured) so setup cost doesn't affect timings.

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

// ===== Format Pair Definitions =====

struct FormatPair {
    name: &'static str,
    source_format: &'static str,
    target: ImageFormat,
    make_input: fn(u32, u32) -> Vec<u8>,
}

const FORMAT_PAIRS: &[FormatPair] = &[
    // PNG → *
    FormatPair {
        name: "PNG_to_JPEG",
        source_format: "PNG",
        target: ImageFormat::Jpeg,
        make_input: make_png,
    },
    FormatPair {
        name: "PNG_to_GIF",
        source_format: "PNG",
        target: ImageFormat::Gif,
        make_input: make_png,
    },
    FormatPair {
        name: "PNG_to_BMP",
        source_format: "PNG",
        target: ImageFormat::Bmp,
        make_input: make_png,
    },
    // JPEG → *
    FormatPair {
        name: "JPEG_to_PNG",
        source_format: "JPEG",
        target: ImageFormat::Png,
        make_input: make_jpeg,
    },
    FormatPair {
        name: "JPEG_to_GIF",
        source_format: "JPEG",
        target: ImageFormat::Gif,
        make_input: make_jpeg,
    },
    FormatPair {
        name: "JPEG_to_BMP",
        source_format: "JPEG",
        target: ImageFormat::Bmp,
        make_input: make_jpeg,
    },
    // WebP → *
    FormatPair {
        name: "WebP_to_PNG",
        source_format: "WebP",
        target: ImageFormat::Png,
        make_input: make_webp,
    },
    FormatPair {
        name: "WebP_to_JPEG",
        source_format: "WebP",
        target: ImageFormat::Jpeg,
        make_input: make_webp,
    },
    FormatPair {
        name: "WebP_to_GIF",
        source_format: "WebP",
        target: ImageFormat::Gif,
        make_input: make_webp,
    },
    FormatPair {
        name: "WebP_to_BMP",
        source_format: "WebP",
        target: ImageFormat::Bmp,
        make_input: make_webp,
    },
    // GIF → *
    FormatPair {
        name: "GIF_to_PNG",
        source_format: "GIF",
        target: ImageFormat::Png,
        make_input: make_gif,
    },
    FormatPair {
        name: "GIF_to_JPEG",
        source_format: "GIF",
        target: ImageFormat::Jpeg,
        make_input: make_gif,
    },
    FormatPair {
        name: "GIF_to_BMP",
        source_format: "GIF",
        target: ImageFormat::Bmp,
        make_input: make_gif,
    },
    // BMP → *
    FormatPair {
        name: "BMP_to_PNG",
        source_format: "BMP",
        target: ImageFormat::Png,
        make_input: make_bmp,
    },
    FormatPair {
        name: "BMP_to_JPEG",
        source_format: "BMP",
        target: ImageFormat::Jpeg,
        make_input: make_bmp,
    },
    FormatPair {
        name: "BMP_to_GIF",
        source_format: "BMP",
        target: ImageFormat::Gif,
        make_input: make_bmp,
    },
];

// ===== Size Definitions =====

struct SizeVariant {
    label: &'static str,
    width: u32,
    height: u32,
}

const SIZES: &[SizeVariant] = &[
    SizeVariant {
        label: "100x100",
        width: 100,
        height: 100,
    },
    SizeVariant {
        label: "1920x1080",
        width: 1920,
        height: 1080,
    },
    SizeVariant {
        label: "4000x3000",
        width: 4000,
        height: 3000,
    },
];

// ===== Benchmark Groups =====

/// Returns true if the conversion involves BMP or GIF (as source or target),
/// which are significantly slower at large resolutions.
fn is_slow_format_pair(pair: &FormatPair) -> bool {
    matches!(pair.target, ImageFormat::Gif | ImageFormat::Bmp)
        || matches!(pair.source_format, "GIF" | "BMP")
}

/// Benchmarks grouped by image size. Each group benchmarks all 16 format pairs
/// at a single resolution, making it easy to compare conversion costs across formats.
///
/// BMP and GIF conversions at large sizes get extra measurement time (30s) because
/// they are significantly slower than PNG/JPEG/WebP conversions.
fn bench_by_size(c: &mut Criterion) {
    for size in SIZES {
        let pixels = size.width as u64 * size.height as u64;
        let is_large = pixels >= 2_000_000;

        // Split into fast and slow groups so each gets appropriate timing.
        // Criterion sets measurement_time per group, not per benchmark.
        let group_name_fast = format!("convert_{}", size.label);
        let group_name_slow = format!("convert_{}_slow", size.label);

        // --- Fast format pairs (PNG, JPEG, WebP sources/targets) ---
        {
            let mut group = c.benchmark_group(&group_name_fast);
            if is_large {
                group.measurement_time(Duration::from_secs(15));
                group.warm_up_time(Duration::from_secs(5));
                group.sample_size(20);
            }

            for pair in FORMAT_PAIRS.iter().filter(|p| !is_slow_format_pair(p)) {
                let input = (pair.make_input)(size.width, size.height);
                group.bench_with_input(
                    BenchmarkId::new(pair.name, size.label),
                    &input,
                    |b, input| {
                        b.iter(|| {
                            convert(input.clone(), pair.target).expect("conversion should succeed")
                        });
                    },
                );
            }
            group.finish();
        }

        // --- Slow format pairs (BMP/GIF as source or target) ---
        {
            let mut group = c.benchmark_group(&group_name_slow);
            if is_large {
                group.measurement_time(Duration::from_secs(30));
                group.warm_up_time(Duration::from_secs(10));
                group.sample_size(10);
            }

            for pair in FORMAT_PAIRS.iter().filter(|p| is_slow_format_pair(p)) {
                let input = (pair.make_input)(size.width, size.height);
                group.bench_with_input(
                    BenchmarkId::new(pair.name, size.label),
                    &input,
                    |b, input| {
                        b.iter(|| {
                            convert(input.clone(), pair.target).expect("conversion should succeed")
                        });
                    },
                );
            }
            group.finish();
        }
    }
}

/// Benchmarks grouped by source format. Each group benchmarks all output targets
/// for a single source format across all sizes, showing how decode cost scales.
///
/// BMP and GIF sources/targets get a separate group with longer measurement time.
fn bench_by_source_format(c: &mut Criterion) {
    let source_formats = ["PNG", "JPEG", "WebP", "GIF", "BMP"];

    for source in &source_formats {
        let pairs: Vec<&FormatPair> = FORMAT_PAIRS
            .iter()
            .filter(|p| p.source_format == *source)
            .collect();

        let is_slow_source = matches!(*source, "GIF" | "BMP");

        let mut group = c.benchmark_group(format!("from_{source}"));
        if is_slow_source {
            group.measurement_time(Duration::from_secs(30));
            group.warm_up_time(Duration::from_secs(10));
            group.sample_size(10);
        } else {
            group.measurement_time(Duration::from_secs(15));
            group.warm_up_time(Duration::from_secs(5));
            group.sample_size(20);
        }

        for size in SIZES {
            for pair in &pairs {
                let input = (pair.make_input)(size.width, size.height);
                let id = format!("{}_{}", pair.name, size.label);

                group.bench_with_input(BenchmarkId::new(&id, size.label), &input, |b, input| {
                    b.iter(|| {
                        convert(input.clone(), pair.target).expect("conversion should succeed")
                    });
                });
            }
        }

        group.finish();
    }
}

criterion_group!(benches, bench_by_size, bench_by_source_format);
criterion_main!(benches);
