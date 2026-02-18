# Criterion: Rust Benchmarking Framework

Criterion is the standard benchmarking framework for Rust. It provides statistically rigorous performance measurements with warmup, outlier detection, and HTML reports — far more reliable than hand-rolled timing with `std::time::Instant`.

## Why It Matters for This Project

The image converter needs performance baselines to:
- Catch regressions when changing codec logic
- Calibrate the frontend's estimated progress bar (which uses `base_ms` and `ms_per_mp` values per format pair)
- Compare conversion costs across format pairs and image sizes

## How It Works

### Setup

Add to `Cargo.toml`:

```toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "conversion_bench"
harness = false  # Use Criterion's own main function
```

### Writing Benchmarks

Benchmarks live in `benches/` (outside `src/`), so they compile as a separate crate. This means any modules they need must be `pub`, not `pub(crate)`.

```rust
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

fn my_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("group_name");

    // bench_with_input lets you pass pre-generated data that isn't timed
    let input = generate_test_data();
    group.bench_with_input(
        BenchmarkId::new("label", "parameter"),
        &input,
        |b, input| {
            b.iter(|| do_something(input));
        },
    );

    group.finish();
}

criterion_group!(benches, my_benchmark);
criterion_main!(benches);
```

### Running

```bash
# Run all benchmarks
cargo bench

# Filter by name
cargo bench -- 'convert_100x100'

# Reduce sample count for faster iteration
cargo bench -- --sample-size 10
```

### Output

- Console output shows mean time with confidence intervals
- HTML reports are generated in `target/criterion/` (add to `.gitignore`)
- On subsequent runs, Criterion compares against previous results and reports regressions/improvements

## Gotchas

- **Benchmark crates are external** — they can't access `pub(crate)` items. You may need to widen visibility to `pub`.
- **Workspace lint rules apply** — if your workspace denies `unwrap_used`/`expect_used`, add `#![allow(...)]` at the top of the bench file (benchmarks are analogous to tests where panicking on failure is acceptable).
- **Fixture generation is not timed** — generate test data outside the `b.iter()` closure so setup cost doesn't affect measurements.
- **Clone inside `b.iter()`** — if your function consumes input (takes `Vec<u8>` not `&[u8]`), clone inside the iteration closure. Criterion accounts for this.

## References

- [Criterion.rs docs](https://bheisler.github.io/criterion.rs/book/)
- [Criterion GitHub](https://github.com/bheisler/criterion.rs)
- Project benchmark: `crates/image-converter/benches/conversion_bench.rs`
