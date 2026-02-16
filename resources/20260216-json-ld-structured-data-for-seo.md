# JSON-LD Structured Data for SEO

JSON-LD (JSON for Linking Data) is a method of embedding structured metadata into HTML pages using `<script type="application/ld+json">` tags. It uses the [Schema.org](https://schema.org/) vocabulary — a collaborative standard maintained by Google, Bing, Yahoo, and Yandex.

Unlike older approaches (Microdata, RDFa) that interleave metadata with HTML attributes, JSON-LD is a standalone JSON block in the `<head>` or `<body>`. This makes it:
- **Easy to maintain** — separated from the HTML markup, so UI changes don't break it
- **Easy to generate** — can be built server-side or statically without touching templates
- **Google's recommended format** — explicitly preferred over Microdata/RDFa in Google's docs

## How Search Engines Use It

1. Googlebot crawls the page and parses any `<script type="application/ld+json">` blocks
2. The JSON is validated against Schema.org types (e.g., `WebApplication`, `FAQPage`)
3. If valid and relevant, Google may render **rich results** — enhanced search listings with extra visual elements (star ratings, FAQ dropdowns, price info, etc.)
4. Rich results increase **click-through rate (CTR)** by taking up more space on the results page and providing answers directly

## Not a Ranking Factor

Structured data does **not** directly improve search rankings. It improves how the result is *displayed*, which indirectly improves CTR. A page with FAQ rich snippets showing expandable Q&A answers will get more clicks than a plain blue link, all else being equal.

## Alternatives to JSON-LD

| Approach | How it works | Downsides |
|----------|-------------|-----------|
| **Microdata** | Inline `itemscope`/`itemprop` attributes on HTML elements | Clutters markup, harder to maintain, not Google's preferred format |
| **RDFa** | Inline `vocab`/`typeof`/`property` attributes on HTML elements | Same clutter problem as Microdata, more complex syntax |
| **No structured data** | Rely on Google's auto-extraction | Misses rich result opportunities entirely |

## Schemas We Use in This Project

### 1. WebApplication (`@type: "WebApplication"`)

Tells search engines this page is a web-based software application.

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Image Converter",
  "description": "Convert images between PNG, JPEG, WebP, GIF, and BMP formats...",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Any (browser-based)",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "browserRequirements": "Requires WebAssembly support"
}
```

**What it enables:**
- Google can display this as a "Software Application" in search results
- The `"price": "0"` signals it's free, which may show a "Free" label
- `applicationCategory` helps Google classify what kind of tool it is

### 2. FAQPage (`@type: "FAQPage"`)

Maps the page's FAQ content to a structured format Google can render as expandable Q&A directly in search results.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I convert a PNG to JPEG?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Drop your PNG file onto the converter..."
      }
    }
  ]
}
```

**What it enables:**
- Google renders FAQ rich snippets — expandable question/answer dropdowns directly in search results
- Takes up significantly more vertical space on the results page vs. a standard listing
- Users can get answers without clicking through, building trust and brand awareness

**Important:** The FAQ content in JSON-LD **must match** visible content on the page. Google penalizes hidden or mismatched FAQ data.

## Key Gotchas

- **Content must match** — JSON-LD FAQ answers must be visible somewhere on the page. Don't put content only in JSON-LD.
- **No ranking boost** — structured data only affects display, not position in results.
- **Validation** — use [Google's Rich Results Test](https://search.google.com/test/rich-results) to verify your markup before deploying.
- **Not guaranteed** — Google may choose not to show rich results even with valid structured data, depending on the query and context.

## References

- [Google: Intro to Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google: FAQ Structured Data](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
- [Google: Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org: WebApplication](https://schema.org/WebApplication)
- [Schema.org: FAQPage](https://schema.org/FAQPage)
- Project file: `PLANNING.md` — SEO Strategy section
- Project file: `web/src/index.html` — implementation
