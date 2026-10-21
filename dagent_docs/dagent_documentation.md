# Dark Pattern Detector — Project Documentation

## 1. Overview

A system to automatically detect **dark patterns** (manipulative UI/UX and copy tricks) on websites — not just e-commerce sites like Flipkart/Amazon, but any website. The system scrapes visible page text via a browser extension, classifies it using a custom-trained model, and surfaces flagged manipulative content back to the user in real time.

**Primary goals (in order of priority, as defined by the project owner):**
1. **Career impact** — a strong, demonstrable portfolio project showing end-to-end ML systems design (data → model → cascading inference architecture → API → extension).
2. **Real-world usefulness** — genuinely helps users recognize when they're being manipulated while shopping/browsing.

---

## 2. Problem Statement

Websites frequently use manipulative design patterns — fake urgency ("Sale ends in 5 minutes!"), false scarcity ("Only 2 left!"), fabricated social proof ("14 people viewing this"), confirmshaming, hidden costs, forced continuity, and misdirection — to influence user behavior without the user's full awareness or consent.

There is no lightweight, real-time, user-facing tool that:
- Scrapes a page as the user actually browses/scrolls it (not just a one-time static snapshot),
- Classifies text at both **sentence level and paragraph level**,
- Returns **which exact sentence** triggered the detection (not just "this page has dark patterns"),
- Does this cheaply enough to run continuously without excessive LLM API cost,
- Can optionally run **fully offline/on-device** for users who don't want their browsing data sent to a cloud service.

---

## 3. Proposed Solution — Architecture Options Considered

Three architectural approaches were proposed and evaluated:

### Approach A — Extension → LLM directly
- Content script scrapes text, sends it straight to an LLM (e.g. via a backend proxy, since API keys can't be safely embedded in extension code) for classification.
- **Pros:** Fastest to prototype, no training needed, highest raw accuracy/explainability out of the box.
- **Cons:** Every scrape = an LLM call = real per-request cost + latency. Not viable at scale/continuous use.
- **Verdict:** Useful only as a week-1 proof of concept, not a production path.

### Approach B — Extension → own deployed ML model → LLM only if flagged (cascade)
- A lightweight, self-trained model does the first-pass classification (cheap, fast, runs on every scraped block).
- Only text the model flags as a likely dark pattern is forwarded to an LLM as a second-opinion / explanation / category-confirmation layer.
- **Pros:** Filters out the vast majority of LLM calls (cost savings), fast enough for real-time use, still gets LLM-quality judgment on the genuinely ambiguous cases.
- **Verdict:** ✅ **Selected as the primary path.** This is the core of the current build.

### Approach C — Fully on-device / offline (containerized or in-browser)
- Ships the trained model alongside the extension so scraping + inference both happen locally — no user browsing data ever leaves the device.
- Originally proposed as a Docker container bundled with the extension; refined during discussion to **in-browser WASM inference** (e.g. `transformers.js` / `onnxruntime-web`) as the more realistic delivery method, since most users won't install a container just for a browser extension.
- **Verdict:** Strong differentiator (genuine privacy story) — planned as a **v2 / stretch goal**, built by exporting the same trained models to ONNX once Approach B is working.

**Sequencing decided:** Baseline validation → Approach B end-to-end (MVP) → Approach A folded in as the cascade's second stage → Approach C as a later privacy-focused offline mode.

---

## 4. Dataset

**File:** `dataset.csv` (cleaned & merged by project owner)

**Columns:**
| Column | Type | Description |
|---|---|---|
| `page_id` | int | Identifies which source page a text snippet came from |
| `text` | string | The scraped sentence/phrase/paragraph |
| `label` | int (0/1) | Binary — 1 = dark pattern, 0 = not |
| `Pattern Category` | string | Category of dark pattern (only meaningful when `label == 1`) |

**Stats:**
- 2,356 total rows, 1,248 unique `page_id`s (some pages contribute up to 41 rows — important for split strategy, see §5).
- **Perfectly balanced binary labels:** 1,178 positive / 1,178 negative.
- **Category distribution is imbalanced:**

| Category | Count |
|---|---|
| Scarcity | 418 |
| Social Proof | 312 |
| Urgency | 210 |
| Misdirection | 195 |
| Obstruction | 27 |
| Sneaking | 12 |
| Forced Action | 4 |

- Text length: median 5 words, up to 143 words (so the model must handle both short phrases and full paragraphs).
- No missing values.

**Known limitation flagged early:** Obstruction, Sneaking, and Forced Action have very little data (43 examples combined). Multi-class category accuracy on these three will be unreliable until more labeled data is collected — this is treated as a known, explainable limitation, not a bug.

---

## 5. Model — Two-Stage DistilBERT Classifier

**Design (as specified by project owner):** the model must handle both single sentences and large paragraphs, and — when a paragraph contains multiple dark patterns — return **multiple detections as a list**, each with its own category, confidence score, and the exact triggering sentence.

### Stage 1 — Binary classifier
- Fine-tuned `distilbert-base-uncased` on the `label` column (dark pattern y/n).
- Acts as the cheap, fast first-pass filter in the cascade — every scraped sentence goes through this.

### Stage 2 — Category classifier
- Fine-tuned separately, **only on rows where `label == 1`**, predicting `Pattern Category`.
- Only run on sentences Stage 1 already flagged as positive (saves compute — this mirrors the ML→LLM cascade concept, but one level down: binary→category).
- Trained with **class-weighted loss** (inverse frequency weighting) to counteract the severe imbalance in Obstruction/Sneaking/Forced Action, rather than letting the model ignore them entirely.

### Data splitting
- Split **by `page_id`, not by row** (grouped split, 70/15/15 train/val/test), because many rows share a `page_id`. A naive random row split would leak sentences from the same page across train and test, inflating validation accuracy.

### Inference pipeline
1. Take a scraped block of text (could be one `<h2>` sentence or a full `<p>` paragraph).
2. **Sentence-segment it** using spaCy (not naive `.split('.')`, which breaks on "Dr.", "$19.99", "e.g.", etc. — a real problem given e-commerce pricing text).
3. Run **Stage 1** on every sentence.
4. For sentences Stage 1 flags positive, run **Stage 2** to get the category.
5. Assemble a JSON response with one detection object per flagged sentence, including character offsets so the extension can highlight the exact text on the live page.

**Response contract:**
```json
{
  "source_text": "the raw block sent in",
  "detections": [
    {
      "sentence": "Only 2 left in stock!",
      "category": "Scarcity",
      "confidence": 0.94,
      "binary_confidence": 0.97,
      "start_offset": 0,
      "end_offset": 22
    }
  ]
}
```
Empty `detections: []` = clean text, no dark pattern found. Multiple entries = multiple dark patterns found in the same block, exactly as required.

### Training environment
- Training run in **Google Colab** (GPU runtime) using a custom-built notebook (`dark_pattern_training.ipynb`).
- Notebook covers: dependency install → data load → grouped split → Stage 1 training + evaluation (precision/recall/F1/confusion matrix) → Stage 2 training + evaluation (with class weighting) → save & zip both models → local inference smoke test.
- **Known compatibility fix applied:** current `transformers` versions renamed the `Trainer`'s `tokenizer=` argument to `processing_class=`; notebook was patched accordingly.

---

## 6. Backend — FastAPI Service

A FastAPI service (`dark_pattern_api/`) was built to wrap the two trained models and expose them over HTTP for the browser extension to call.

**Key design decisions:**
- Models are loaded **once at process startup** (via FastAPI's `lifespan` handler), not per-request — reloading DistilBERT per request would be far too slow.
- The `/detect` endpoint accepts a **batch of blocks per request** (`page_url`, `viewport_width`, `viewport_height`, then a list of `{block_id, text, tag}`), matching how the extension will actually work: scrape a whole page (or a whole scroll-event's worth of `<p>/<h1>/<h2>/<h3>` tags) and send it in one call, rather than firing a request per tag.
- CORS is configurable via `ALLOWED_ORIGINS` env var — should be locked to the extension's actual origin in production, not left as `*`.
- All thresholds (`BINARY_THRESHOLD`, `CATEGORY_THRESHOLD`) and model paths are environment-variable configurable, not hardcoded.
- Dockerfile included for containerized deployment (cloud deployment for Approach B now, and a stepping stone toward Approach C later).

**Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Reports whether both models are loaded and which device (cpu/cuda) is in use |
| `/detect` | POST | Takes a batch of scraped text blocks, returns detections per block |

---

## 7. What's Been Built So Far (Deliverables)

| Deliverable | Status | File |
|---|---|---|
| Cleaned dataset explored & validated | ✅ Done | `dataset.csv` (provided by project owner) |
| Two-stage DistilBERT training notebook | ✅ Done, ready to run in Colab | `dark_pattern_training.ipynb` |
| Trained Stage 1 (binary) + Stage 2 (category) models | ✅ Trained by project owner in Colab | `dark_pattern_models.zip` (stage1 + stage2 folders) |
| FastAPI backend wrapping both models | ✅ Done, scaffolded and ready for models | `dark_pattern_api.zip` |
| Browser extension (scraping + UI) | 🔲 Not started — next step |
| Frontend/UI for displaying detections | 🔲 Not started — next step |
| LLM tie-breaker/explanation layer | 🔲 Not started — planned as cascade's 3rd stage |
| On-device / offline mode (Approach C) | 🔲 Not started — planned as v2, via ONNX export |

---

## 8. Recommended Project Folder Structure

This is the structure to use as the project grows to include the extension and UI:

```
dark-pattern-detector/
│
├── README.md                          # top-level project overview
├── docs/
│   └── project-documentation.md       # this document
│
├── data/
│   └── dataset.csv                    # cleaned/merged training data
│
├── model-training/
│   └── dark_pattern_training.ipynb    # Colab notebook: two-stage DistilBERT training
│
├── backend/                            # dark_pattern_api/ (FastAPI service)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # routes, CORS, startup model loading
│   │   ├── config.py                  # thresholds, model paths, env settings
│   │   ├── schemas.py                 # Pydantic request/response models
│   │   └── inference.py               # DarkPatternDetector: two-stage pipeline
│   ├── models/                        # trained model weights go here (gitignored)
│   │   ├── dark_pattern_stage1_binary/
│   │   └── dark_pattern_stage2_category/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore
│   └── README.md
│
├── extension/                          # 🔲 to be built next
│   ├── manifest.json                  # MV3 manifest
│   ├── content-script.js              # scrapes DOM (p/h1/h2/h3), tracks scroll/viewport
│   ├── background.js                  # service worker: batches requests to backend
│   ├── popup/                         # extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── content-styles.css             # highlight styling for flagged sentences on page
│
├── ui/                                  # 🔲 to be built next (if a separate dashboard is planned)
│   └── ...                             # e.g. a React dashboard showing detection history/stats
│
└── deployment/
    ├── docker-compose.yml              # backend + any future services
    └── notes.md                        # cloud deployment steps (Render/Fly.io/AWS/etc.)
```

**Notes on this structure:**
- `models/` inside `backend/` is intentionally **not committed to git** (add to `.gitignore`) — model weight files are large; distribute via the zip or a proper model registry/artifact store instead.
- `docs/` is where this document lives for future reference (and where subsequent design docs — extension architecture, LLM cascade prompt design, etc. — should go as the project grows).
- The `extension/` and `ui/` folders are scaffolds for the next phase, not yet built.

---

## 9. Next Steps (Planned)

1. **Browser extension** — content script scraping `<p>/<h1>/<h2>/<h3>` text, tracking `window.innerWidth/innerHeight` and re-scraping on scroll (via `MutationObserver`/`IntersectionObserver`, debounced), batching scraped blocks into one `/detect` call per page/scroll-event.
2. **UI layer** — likely a popup + in-page highlight overlay using the `start_offset`/`end_offset` already returned by the API to visually mark flagged sentences directly on the page.
3. **LLM tie-breaker layer** — call an external LLM only for low-confidence Stage 2 results, or to generate a human-readable explanation of *why* something was flagged, using it to explain rather than to gatekeep every request (keeps cost low, matches the cascade design).
4. **Threshold tuning** — tune `BINARY_THRESHOLD` against the validation set (not test) once real classification reports are available.
5. **Approach C (offline mode)** — export both models to ONNX and run via `transformers.js`/`onnxruntime-web` directly in the browser, as a privacy-preserving alternative to the cloud-hosted API.
6. **Tail-class data collection** — Obstruction, Sneaking, and Forced Action need more labeled examples before Stage 2 can be trusted on them in production.
