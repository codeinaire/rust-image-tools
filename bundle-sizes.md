# Bundle Size Log

Run `npm run bundle-size` from `web/` to append a new entry.
Use `npm run bundle-size:build` to clean, rebuild, and then measure.

> **Raw** = uncompressed file size on disk.
> **Gzip** = over-the-wire transfer size (what browsers download on first visit).
> WASM top contributors are grouped by section type (function code / static data / custom sections)
> because function names are stripped in the release build.
> JS/CSS contributors are the largest files from the most recent Astro build in `dist/`.

| Date       | Branch       | Asset     | Raw          | Gzip         | Top Contributor #1                                   | Top Contributor #2                                  | Top Contributor #3                                |
|------------|--------------|-----------|--------------|--------------|------------------------------------------------------|-----------------------------------------------------|---------------------------------------------------|
| 2026-03-06 | heic-support | WASM      | 1.02 MB      | 343.8 KB     | Fn code (3720 fns): 1.02 MB (73.5%)                  | Custom: \_\_wasm_bindgen_unstable: 164.1 KB (11.6%) | Static data (2 segs): 136.3 KB (9.6%)             |
| 2026-03-06 | heic-support | JS        | 2.82 MB      | 735.1 KB     | \_astro/heic-to.DIRPI3VF.js: 657.9 KB (89.5%)        | \_astro/ImageConverter.B0eTjFO\_.js: 64.9 KB (8.8%) | \_astro/preload-helper.C3igGt72.js: 4.9 KB (0.7%) |
| 2026-03-06 | heic-support | CSS       | 17.8 KB      | 4.6 KB       | \_astro/index.C7w5X18Y.css: 4.6 KB (100.0%)          | —                                                   | —                                                 |
| 2026-03-06 | heic-support | **Total** | **3.86 MB**  | **1.06 MB**  |                                                      |                                                     |                                                   |
| 2026-02-28 | —            | WASM      | 708.4 KB     | 250.6 KB     | Fn code (2558 fns): 693.9 KB (74.3%)                 | Static data (2 segs): 105.2 KB (11.3%)              | Custom: \_\_wasm_bindgen_unstable: 85.5 KB (9.2%) |
| 2026-02-28 | —            | JS        | 211.8 KB     | 72.4 KB      | \_astro/ImageConverter.Crskg7Rz.js: 60.2 KB (83.2%)  | \_astro/preact.module.IsPPbktY.js: 4.4 KB (6.0%)   | \_astro/signals.module.wuEmy14B.js: 2.8 KB (3.9%) |
| 2026-02-28 | —            | CSS       | 16.5 KB      | 4.3 KB       | \_astro/index.Dh1xlKfq.css: 4.3 KB (100.0%)          | —                                                   | —                                                 |
| 2026-02-28 | —            | **Total** | **936.7 KB** | **327.3 KB** |                                                      |                                                     |                                                   |
| 2026-02-25 | —            | WASM      | 708.4 KB     | 250.6 KB     | Fn code (2558 fns): 693.9 KB (74.3%)                 | Static data (2 segs): 105.2 KB (11.3%)              | Custom: \_\_wasm_bindgen_unstable: 85.5 KB (9.2%) |
| 2026-02-25 | —            | JS        | 353.6 KB     | 89.5 KB      | web.js: 77.0 KB (86.1%)                              | worker.js: 12.5 KB (13.9%)                          | —                                                 |
| 2026-02-25 | —            | CSS       | 17.5 KB      | 3.9 KB       | web.css: 3.9 KB (100.0%)                             | —                                                   | —                                                 |
| 2026-02-25 | —            | **Total** | **1.05 MB**  | **344.0 KB** |                                                      |                                                     |                                                   |
