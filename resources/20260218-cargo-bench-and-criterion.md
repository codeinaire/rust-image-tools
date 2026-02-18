# Cargo Bench and Criterion

`cargo bench` is Rust's built-in command for running benchmarks. Combined with Criterion, it provides statistically rigorous performance measurement with automatic comparison across runs.

## How cargo bench Works

1. Compiles your code with the `bench` profile (optimized, like `--release`)
2. Runs the lib test harness first — all `#[test]` functions show as "ignored" (this is normal, not an error)
3. Runs benchmark binaries from `benches/`

To skip the "ignored" test noise, target just the bench file:

```bash
cargo bench --bench conversion_bench
```

## Criterion Measurement Process

For each benchmark, Criterion:

1. **Warmup** (3s default) — runs the code to warm CPU caches and trigger JIT
2. **Sampling** (5s default, 100 samples) — runs the closure many times per sample
3. **Statistical analysis** — calculates mean, median, standard deviation, confidence intervals
4. **Outlier detection** — flags anomalous measurements

## Comparing Results Across Runs

### Automatic (default)

Criterion saves results to `target/criterion/` and automatically compares against the previous run:

```
convert_100x100/PNG_to_JPEG/100x100
    time:   [148.53 µs 148.95 µs 149.68 µs]
    change: [-2.1032% -0.9847% +0.1338%] (p = 0.08 > 0.05)
    No change in performance detected.
```

The three time values are the lower bound, best estimate, and upper bound of the 95% confidence interval.

### Named Baselines

Save a named snapshot to compare against later (e.g., before and after a refactor):

```bash
# Save current results with a name
cargo bench --bench conversion_bench -- --save-baseline before-refactor

# Later, compare new results against the saved baseline
cargo bench --bench conversion_bench -- --baseline before-refactor
```

### HTML Reports

Criterion generates detailed HTML reports with violin plots and regression analysis:

```
target/criterion/report/index.html
```

Open in a browser after running benchmarks. Each benchmark group gets its own sub-report.

## Tuning Measurement Time

The defaults (5s measurement, 100 samples) work well for fast operations. For slow benchmarks (e.g., converting a 4000x3000 image), you need to adjust:

```rust
use std::time::Duration;
use criterion::Criterion;

fn slow_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("large_images");

    // More time per benchmark, fewer samples (each takes longer)
    group.measurement_time(Duration::from_secs(15));
    group.warm_up_time(Duration::from_secs(5));
    group.sample_size(20);  // Minimum is 10

    group.bench_function("my_bench", |b| {
        b.iter(|| expensive_operation());
    });

    group.finish();
}
```

**Rule of thumb**: if Criterion warns about not enough samples or the confidence interval is very wide, increase `measurement_time` or decrease `sample_size`.

## Common CLI Options

```bash
# Run all benchmarks
cargo bench

# Run only a specific bench file
cargo bench --bench conversion_bench

# Filter benchmarks by name (regex)
cargo bench --bench conversion_bench -- 'convert_100x100'

# Save a named baseline
cargo bench --bench conversion_bench -- --save-baseline my-baseline

# Compare against a named baseline
cargo bench --bench conversion_bench -- --baseline my-baseline

# Skip warmup and use fewer samples (quick iteration, less stable)
cargo bench --bench conversion_bench -- --sample-size 10

# List benchmarks without running them
cargo bench --bench conversion_bench -- --list
```

## Cargo.toml Setup

```toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "conversion_bench"
harness = false  # Required — tells Cargo to use Criterion's main, not the default test harness
```

## Gotchas

- **`harness = false` is required** — without it, Cargo uses the default test harness which doesn't know about Criterion benchmarks
- **Bench files are external crates** — they can only access `pub` items, not `pub(crate)`. You may need to widen module visibility.
- **Don't measure setup** — generate fixtures outside `b.iter()`. Only the closure passed to `b.iter()` is timed.
- **Clone consumed inputs inside `b.iter()`** — if your function takes ownership (e.g., `Vec<u8>`), clone inside the closure. Criterion handles this correctly.
- **"Ignored" tests during `cargo bench`** — this is normal. `cargo bench` runs the lib test binary first, where all `#[test]` functions are skipped. The actual benchmarks run after.
- **Results aren't portable** — `target/criterion/` data is specific to the machine. Different hardware gives different results.
- **Add `target/criterion/` to `.gitignore`** — the reports are generated artifacts, not source.

## CI / Long-Term Tracking

Criterion's built-in comparison only tracks the last run and named baselines on a single machine. For tracking performance over time across commits, use external tools:

- **[Bencher](https://bencher.dev/)** — SaaS for continuous benchmarking, integrates with GitHub
- **[github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark)** — GitHub Action that stores results in gh-pages and comments on PRs with regressions
- **[Criterion custom output](https://bheisler.github.io/criterion.rs/book/user_guide/custom_output.html)** — Export raw JSON data for custom dashboards

## References

- [Criterion.rs User Guide](https://bheisler.github.io/criterion.rs/book/)
- [Criterion.rs GitHub](https://github.com/bheisler/criterion.rs)
- [Criterion.rs FAQ](https://bheisler.github.io/criterion.rs/book/faq.html)
- [cargo bench documentation](https://doc.rust-lang.org/cargo/commands/cargo-bench.html)
- [The Rust Performance Book](https://nnethercote.github.io/perf-book/)
- Project benchmark file: `crates/image-converter/benches/conversion_bench.rs`
