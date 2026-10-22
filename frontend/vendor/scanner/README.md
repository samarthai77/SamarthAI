# Scanner browser dependencies

These version-pinned browser bundles are served locally and lazy-loaded by
`../../scanner.js`. No CDN request is made by the Scanner, and the libraries
receive only in-memory canvases / image bytes. Do not replace with `latest` URLs.

| File | Upstream | License | SHA-256 |
| --- | --- | --- | --- |
| `zxing-browser-0.2.1.min.js` | https://www.npmjs.com/package/@zxing/browser/v/0.2.1 | MIT; bundled ZXing library Apache-2.0 | `066bc34edfcdd4a33f0964aeec967752a0dea1ccaf36e58e319ac9fcb5070f6a` |
| `jspdf-4.2.1.umd.min.js` | https://www.npmjs.com/package/jspdf/v/4.2.1 | MIT (bundled third-party notices retained) | `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54` |

Downloaded from the corresponding pinned npm distribution on jsDelivr.
Upstream license texts are in `ZXing.LICENSE`, `ZXing-Library.LICENSE` and
`jsPDF.LICENSE`. Bundle license comments are retained. ZXing is used only for
canvas decoding: SamarthAI owns and stops its camera stream. jsPDF receives
only JPEG bytes produced by our canvas, never HTML or untrusted annotations.

## Scanner limits

- 20 pages; 20 MB per imported image; decoded images above 32 megapixels rejected.
- Pages downsampled to a 2400 px longest edge; 48 MB total encoded page budget.
- Rectangular crop, 90-degree rotation, contrast and fixed-threshold B&W.
  No automatic edge detection, perspective correction or OCR.
- PDFs are A4 image pages. Preview and native file share depend on the browser.
- Live camera requires HTTPS and camera permission. The native phone camera
  file input and Gallery remain alternatives. Live QR scanning stops after 60s.
- Scans remain in page memory. Refresh/close clears them. Download, OS Share,
  Copy, and confirmed HTTP(S) navigation happen only through explicit actions.
- Supported barcode decoding depends on image clarity and ZXing's format support.
  HEIC works only if the browser's image decoder supports it.
