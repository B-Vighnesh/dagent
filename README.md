<p align="center">
  <img src="assets/logo.png" alt="Dagent logo" width="140">
</p>

<h1 align="center">Dagent</h1>
<p align="center"><b>The web has secrets. We find them.</b><br>
A privacy-first browser agent that spots dark patterns on any website, down to the exact sentence, without your browsing ever leaving your device.</p>

---

## Contents

1. [The idea](#1-the-idea)
2. [Privacy is the product](#2-privacy-is-the-product)
3. [Project status](#3-project-status)
4. [How Dagent works (version 1)](#4-how-dagent-works-version-1)
5. [Dark pattern categories and dataset](#5-dark-pattern-categories-and-dataset)
6. [Models and training](#6-models-and-training)
7. [Detection service (FastAPI)](#7-detection-service-fastapi)
8. [Browser extension](#8-browser-extension)
9. [Website](#9-website)
10. [Repository map](#10-repository-map)
11. [Getting started](#11-getting-started)
12. [Privacy audit of the current prototype](#12-privacy-audit-of-the-current-prototype)
13. [Known issues and limitations](#13-known-issues-and-limitations)
14. [Roadmap](#14-roadmap)
15. [Further reading](#15-further-reading)

---

## 1. The idea

Websites often steer people into choices they did not mean to make: fake urgency ("Sale ends in 5 minutes!"), false scarcity ("Only 2 left!"), fabricated social proof ("14 people are viewing this"), guilt-trip opt-outs, hidden costs, and subscriptions that are one click to join and a phone call to leave.

Dagent is a **product idea** for a browser extension that reads the page you are actually looking at, flags manipulative wording as you scroll, and names:

- **the exact sentence** that triggered the flag,
- **the tactic** (Scarcity, Urgency, Social Proof, and so on),
- **a confidence score**, so you can see why and not just that something was flagged.

It is built for the **whole web**, not just shopping carts: a streaming trial that quietly auto-renews, a newsletter popup that returns no matter how often you close it, and a signup that buries "continue without an account" are all read the same way.

---

## 2. Privacy is the product

Dagent reads what you read. That is only acceptable if what it reads never leaves your hands. So this is a design rule, not a feature:

> **Page content, URLs and detection results must never be sent to an LLM, an online API, or any other remote service.**

What this means for how Dagent is built:

| Rule | What it means in practice |
|---|---|
| **All inference is local** | Scraping, sentence splitting, classification and display all run on the user's own machine. |
| **No third-party AI calls** | No hosted LLM (Groq, OpenAI or otherwise) is part of the product. Verification must be done by something that runs locally. |
| **No telemetry, no analytics** | The extension makes no network calls other than to the local detector. |
| **Minimal storage** | Results live in the browser tab's memory and per-tab `chrome.storage.local`, and are cleared on navigation or tab close. Nothing is written to a server. |
| **Nothing is retained by default** | No scraped text is saved to disk unless an operator explicitly turns that on for development. |
| **The end state needs no server at all** | The target is the same models running inside the browser (ONNX with `transformers.js` / `onnxruntime-web`), so there is nothing to send data to. |

Because of this rule, the optional cloud LLM review stage found in the prototype code is **not part of the product** (see [section 4](#stage-3-is-not-part-of-the-product) and [section 12](#12-privacy-audit-of-the-current-prototype)).

---

## 3. Project status

Dagent is a **product concept with a complete first-version design and a working local prototype**. The live, hosted detector has deliberately not been deployed: hosting the models would mean running a server that receives users' page text, which conflicts with the privacy rule above. The models are also large, and there is no funding to host them.

| Component | Status |
|---|---|
| Dataset (2,356 labelled examples, 7 categories) | Done |
| Two-stage DistilBERT training notebook | Done |
| FastAPI detection service (`/health`, `/detect`) | Working prototype, runs locally with model files |
| Chrome (Manifest V3) extension | Working prototype, talks to `localhost` |
| Website (home, scan demo, download, feedback) | Demo of the idea; scan preview is simulated |
| Cloud LLM verification (Groq) | Experimental code, **off by default, not part of the product** |
| On-device model (ONNX, in-browser) | Planned; the main goal for a shippable version |
| Hosted / deployed model | Not deployed, by design |

The website's scan page uses prepared examples. It does not scan the site you are visiting and does not call the detection service.

---

## 4. How Dagent works (version 1)

Version 1 is a two-stage cascade that runs entirely on the user's side. The second stage only ever sees what the first stage flagged, which keeps it fast enough to run continuously.

<p align="center">
  <img src="assets/extension-flow.png" alt="Dagent flow: triggers fire, scrape and hash visible text, cached results replay locally, new text goes to the background worker, popup renders the result" width="680">
</p>

```
Page you are viewing
   |  scroll / DOM change / mouse idle
   v
Extension scrapes visible text, hashes it
   |-- already classified? ---------> replay from in-memory cache (no processing)
   |
   v new text
Local detector
   1. spaCy splits text into sentences
   2. Stage 1  "The Lookout"    binary DistilBERT: dark pattern or not?   (every sentence)
   3. Stage 2  "The Profiler"   category DistilBERT: which tactic?        (flagged sentences only)
   |
   v
Popup in the page: red = flagged (sentence, category, confidence), green = clean (first time only)
Toolbar badge + popup panel: per-tab count and the last five detections
```

### Stage by stage

| Stage | Model | Question it answers | Runs on |
|---|---|---|---|
| 1 | `distilbert-base-uncased`, fine-tuned | Is this sentence a dark-pattern candidate? | Every sentence |
| 2 | `distilbert-base-uncased`, fine-tuned (class-weighted) | Which category is it? | Stage 1 positives only |

Both use `MAX_SEQ_LENGTH = 128` and softmax probabilities. A sentence is flagged when its Stage 1 probability is at or above `BINARY_THRESHOLD` (default 0.5). Stage 2 reports the top category with its confidence.

### Stage 3 is not part of the product

The prototype contains an optional third stage that sends flagged sentences to a Groq-hosted LLM for a second opinion (`confirmed`, `partial`, `rejected`). **That stage sends page text to a third party, so it breaks Dagent's privacy rule and is excluded from the product.** It is kept in the code only as an experiment, is disabled unless a `GROQ_API_KEY` is set, and should never be enabled in anything shipped to users.

Without it, every detection is returned as `unverified` and shown in red. If a verification layer is wanted later, it has to run **locally** (for example a small on-device model, or confidence bands from Stage 2 itself).

### Architecture options that were considered

| Approach | Idea | Verdict |
|---|---|---|
| A. Extension sends text to an LLM | Fastest to prototype, but costly, slow, and sends page text to a third party | Rejected (privacy and cost) |
| B. Own model, then LLM for flagged text | Cheap first pass, LLM only for ambiguous cases | Prototype only; the LLM step is dropped for privacy |
| C. Fully on-device | The same models exported to ONNX and run in the browser | **The target for a shippable version** |

---

## 5. Dark pattern categories and dataset

| Category | Example | Labelled examples |
|---|---|---|
| Scarcity | "Only 2 left in stock!" | 418 |
| Social Proof | "14 people are viewing this item." | 312 |
| Urgency | "Offer ends in 04:59." | 210 |
| Misdirection | "No thanks, I like paying full price." | 195 |
| Obstruction | "To cancel, call support 9-5 on weekdays." | 27 |
| Sneaking | "Priority insurance has been added to your cart." | 12 |
| Forced Action | "Create an account to continue checkout." | 4 |

**File:** `dagent_dataset.csv`

| Column | Type | Description |
|---|---|---|
| `page_id` | int | Source page the snippet came from |
| `text` | string | The scraped sentence, phrase or paragraph |
| `label` | int (0/1) | 1 = dark pattern, 0 = not |
| `Pattern Category` | string | Category (`Not Dark Pattern` when `label` is 0) |

- **2,356 rows** from **1,248 unique pages** (some pages contribute up to 41 rows).
- **Balanced binary labels:** 1,178 positive and 1,178 negative.
- **Imbalanced categories**, as shown above.
- Median text length is 5 words, up to 143, so the models handle both short phrases and full paragraphs.

---

## 6. Models and training

Training is in `dagent_training.ipynb`, written for **Google Colab** (a T4 GPU is enough). Run all cells top to bottom and upload the dataset when prompted.

- **Grouped split by `page_id`** (70 / 15 / 15 train / val / test). Many rows share a page, so a plain random split would leak a page's style across train and test and inflate scores.
- **Stage 1:** fine-tunes `distilbert-base-uncased` on `label`, 4 epochs, learning rate 2e-5, batch size 16, best model chosen by F1.
- **Stage 2:** trains only on `label == 1` rows, 8 epochs, with **inverse-frequency class weights** through a custom `WeightedTrainer` so rare classes are not ignored.
- **Inference helper:** spaCy sentence segmentation (naive `.split('.')` breaks on "Dr.", "$19.99", "e.g."), Stage 1, then Stage 2, returning detections with character offsets.
- **Output:** both models plus Stage 2's `label_map.json`, zipped as `dark_pattern_models.zip`.

Tune `BINARY_THRESHOLD` on the validation set, not the test set. Raise it to cut false positives, lower it to catch more.

**Model files** are too large for Git. Download them from the [shared Google Drive folder](https://drive.google.com/drive/folders/1RJFFZU4_VKOmU0d6JxKUz0t0DvrIS4ou?usp=sharing).

### Technology cheat sheet

| Technology | Role |
|---|---|
| DistilBERT | Model architecture for both stages |
| PyTorch | Runs the models today (TensorFlow is not used) |
| Transformers (Hugging Face) | Loads the tokenizer and models |
| SafeTensors | File format that stores the learned weights |
| Tokenizer | Turns sentences into token IDs |
| spaCy | Sentence splitting |
| Softmax | Turns raw logits into probabilities |
| ONNX | Planned export format for the on-device build |

A full walk-through is in the [backend learning documentation](dagent_docs/dagents_backend_docs.docx).

---

## 7. Detection service (FastAPI)

A local service that wraps the two models. Models load **once at startup** (FastAPI `lifespan`), not per request.

```
dagent_api/
├── app/
│   ├── main.py          # app, CORS, /health, /detect
│   ├── inference.py     # DarkPatternDetector: spaCy, tokenizer, Stage 1 + 2, softmax, thresholds
│   ├── config.py        # model paths, thresholds, MAX_SEQ_LENGTH, DEVICE, CORS, optional Groq settings
│   ├── schemas.py       # Pydantic request/response models
│   └── llm_verifier.py  # experimental, off by default, NOT part of the product
├── models/              # model weights (ignored by Git)
│   ├── dark_pattern_stage1_binary/
│   └── dark_pattern_stage2_category/
├── .env.example
└── requirements.txt
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Whether both models are loaded, and which device is in use |
| `/detect` | POST | Up to 200 blocks, 50,000 combined characters, 5,000 per block |

**Request**

```json
{
  "page_url": "https://example.com/product/123",
  "viewport_width": 1440,
  "viewport_height": 900,
  "blocks": [
    { "block_id": "dagent-7", "text": "Only 2 left in stock!", "tag": "p" }
  ]
}
```

**Response**

```json
{
  "results": [
    {
      "block_id": "dagent-7",
      "source_text": "Only 2 left in stock!",
      "detections": [
        {
          "sentence": "Only 2 left in stock!",
          "category": "Scarcity",
          "confidence": 0.94,
          "binary_confidence": 0.97,
          "start_offset": 0,
          "end_offset": 22,
          "llm_verdict": "unverified",
          "llm_reasoning": null,
          "display_color": "red"
        }
      ]
    }
  ],
  "total_detections": 1
}
```

An empty `detections` list means clean text. The `start_offset` and `end_offset` values locate the sentence inside the original block.

**Privacy behaviour of the service:** it logs only counts and timings (never page text or URLs), and `page_url` is accepted but not used or stored.

**Configuration** (environment variables or `dagent_api/.env`, defaults in `.env.example`): `STAGE1_MODEL_DIR`, `STAGE2_MODEL_DIR`, `BINARY_THRESHOLD`, `CATEGORY_THRESHOLD`, `MAX_SEQ_LENGTH`, `DEVICE` (`cpu` or `cuda`), `ALLOWED_ORIGINS` (use explicit origins, not `*`, outside local development).

> The `GROQ_*` and `REJECTED_LOG_PATH` settings exist only for the experimental review stage. **Leave them unset.**

---

## 8. Browser extension

A Chrome Manifest V3 extension in `dagent_extension/`.

| Piece | Role |
|---|---|
| `content/content-script.js` | Scrapes visible text, hashes it, keeps the in-memory cache, draws the popup |
| `background.js` | Batches blocks (200ms window) and calls the local detector; sets the toolbar badge; keeps per-tab detections |
| `popup/` | Toolbar panel: service status, detection count, confirmed vs unconfirmed, the last five detections |

**Scraping.** Elements matching `p, h1, h2, h3, h4, span, div, li, a, label`. Text under 3 characters is skipped, and an element is scraped only if at least **50% of it is visible in the viewport** (non-zero size, not `display:none`, `visibility:hidden` or `opacity:0`). Each block is hashed for caching and given a stable `block_id`.

**Triggers.**

| Trigger | Debounce |
|---|---|
| DOM change (`MutationObserver`) | 400ms |
| Scroll | 300ms |
| Mouse idle | 500ms |
| Page load | 500ms after load |

**Cache.** The cache is an in-memory `Map` in the content script. It lives on the user's device, is per tab and per page load, is never persisted, and is wiped on refresh or navigation.

| Scenario | Popup |
|---|---|
| New text, flagged | Red: sentence, category, confidence % |
| New text, clean | Green "No dark pattern detected" (once) |
| Seen before, flagged, past the 600ms cooldown | Red, replayed locally, no processing |
| Seen before, flagged, inside cooldown | Suppressed |
| Seen before, clean | Never shown |

Several flagged sentences cycle one at a time (4 seconds each). The popup is drawn in a **shadow DOM** so the host page's CSS cannot affect it.

**Timing.** A first-time classification takes roughly 500 to 550ms from scroll-stop to popup (300ms scroll debounce, 200ms batch window, about 120ms measured inference). A replay takes about 300ms, bounded only by the trigger's debounce.

| Constant | Value | File |
|---|---|---|
| `MUTATION_DEBOUNCE_MS` | 400ms | `content-script.js` |
| `SCROLL_DEBOUNCE_MS` | 300ms | `content-script.js` |
| `MOUSE_IDLE_MS` | 500ms | `content-script.js` |
| `REPLAY_COOLDOWN_MS` | 600ms | `content-script.js` |
| `TOAST_DISPLAY_MS` | 4000ms | `content-script.js` |
| `MIN_TEXT_LENGTH` | 3 chars | `content-script.js` |
| `MIN_VISIBLE_RATIO` | 0.5 | `content-script.js` |
| `BATCH_WINDOW_MS` | 200ms | `background.js` |

Full detail is in the [extension architecture notes](dagent_docs/dagent_architecture_1).

---

## 9. Website

`dagent_frontend_ui/` is a React and Vite site with four pages: **Home** (the problem, the categories, the pipeline), **Scan** (a simulated shopping page that shows sample alerts as you scroll), **Download**, and **Feedback**. It supports light and dark themes and is responsive.

It is a demonstration of the product idea. The scan examples are written into the frontend and are **not live model predictions**.

---

## 10. Repository map

| Folder | What you will find |
|---|---|
| `dagent_api/` | FastAPI detection service |
| `dagent_extension/` | Chrome Manifest V3 extension |
| `dagent_frontend_ui/` | React and Vite website with the simulated scan demo |
| `dagnet_training/` | Training notebook and dataset |
| `dagent_docs/` | Documentation, architecture notes, design materials, copies of training resources |
| `assets/` | Logo and diagrams used in this README |
| `dagent_models/` | Reserved for model files; ignored by Git |

---

## 11. Getting started

### Run the website

```powershell
cd dagent_frontend_ui
npm install
npm run dev
```

`npm run lint` and `npm run build` are available for checks and a production build. The site needs neither the service nor the model files.

### Run the detection service locally

1. Download the model files from the [Google Drive folder](https://drive.google.com/drive/folders/1RJFFZU4_VKOmU0d6JxKUz0t0DvrIS4ou?usp=sharing) and place them in `dagent_api/models/dark_pattern_stage1_binary/` and `dagent_api/models/dark_pattern_stage2_category/`. Stage 2 must include `label_map.json`.
2. From `dagent_api/`:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   Copy-Item .env.example .env
   uvicorn app.main:app --reload --port 8000
   ```

3. Check `http://localhost:8000/health`, or open `http://localhost:8000/docs`.

**Keep `GROQ_API_KEY` empty.** With it empty, nothing leaves your machine. Never commit `.env`.

### Load the extension

Open your browser's extensions page, enable developer mode, and load `dagent_extension/` unpacked. It sends blocks to `http://localhost:8000`. Start the service first.

### Retrain the models

Open `dagnet_training/dagent_training.ipynb` in Google Colab, use a GPU runtime, run all cells, upload `dagent_dataset.csv` when asked, then copy the two output folders into `dagent_api/models/`.

---

## 12. Privacy audit of the current prototype

With the default setup (local service, `GROQ_API_KEY` empty), **page text stays on the user's machine**. The things that would change that are listed here so they can be removed before anything ships.

| Item | Where | Risk | Action |
|---|---|---|---|
| Groq review stage | `app/llm_verifier.py`, `GROQ_API_KEY` | Sends each flagged **sentence, its category and confidence** to Groq (page URL is not included) | Keep disabled; remove from the product |
| Remote hosts in the extension | `manifest.json` `host_permissions` includes `*.ngrok-free.app`, `*.ngrok-free.dev`, `*.ngrok.io` | Would let the extension send page text to a tunnelled or hosted server | Remove for any release build; keep `localhost` only |
| Rejected-sentence log | `REJECTED_LOG_PATH` | Writes visited-page text to disk | Leave unset; only relevant to the Groq stage |
| Wide CORS | `ALLOWED_ORIGINS=*` | Any web page could call a local service | Set to the extension origin |
| Debug logging | `console.debug` in `content-script.js` prints scraped results | Page text appears in the dev console | Remove or gate behind a dev flag |
| Website wording | Home and Download pages describe a "deployed model" and an "LLM reasoning engine" | Contradicts the privacy promise | Reword to match this README |
| Feedback form | `FeedbackPage` collects an email address | Personal data; currently not wired to a backend | Decide whether to keep; if so, state clearly what is stored |

---

## 13. Known issues and limitations

- **Port mismatch.** `popup/popup.js` checks health on `http://localhost:8080` while `background.js` and the service use `8000`, so the popup status dot can show "offline" while detection works.
- **Stale extension README.** `dagent_extension/README.md` is a copy of an old API README and does not describe the extension.
- **Rare categories.** Obstruction (27), Sneaking (12) and Forced Action (4) have very little data, so Stage 2 is unreliable on them until more labelled examples exist.
- **Text only.** Visual tricks (pre-ticked boxes, hidden buttons, colour and size manipulation) are not covered; the extension reads text.
- **Broad scraping.** Matching `span`, `div`, `a` and similar elements catches more text but can also send repeated or nested text; this is a precision and performance trade-off still to tune.
- **128-token limit.** Longer sentences are truncated and the model never sees the excess.
- **No verification stage.** Without Stage 3, borderline calls are shown in red with no second opinion.
- **Not a shippable download yet.** Users would currently have to run the local service themselves.

---

## 14. Roadmap

1. **On-device build.** Export both models to ONNX (`optimum`) and run them in the browser with `transformers.js` or `onnxruntime-web`, so no service is needed. Shrink the models (distillation, quantization) to make this practical.
2. **Local-only verification.** Replace the cloud LLM idea with something that runs on the device, or drop it.
3. **Privacy hardening.** Remove remote hosts and debug logging, lock CORS, and reword the website.
4. **More data** for Obstruction, Sneaking and Forced Action, and threshold tuning on the validation set.
5. **Feedback loop without surveillance.** If user reports feed retraining, make it explicit opt-in, per report, with the user choosing what to share.
6. **Wire up the website's Download page** once there is a build to download.

---

## 15. Further reading

- [Detection service notes](dagent_api/README.md)
- [Website notes](dagent_frontend_ui/README.md)
- [Project documentation](dagent_docs/dagent_documentation.md): problem statement, architecture options, dataset and model design
- [Extension architecture notes](dagent_docs/dagent_architecture_1): trigger-to-popup flow, cache logic, timing
- [Backend learning documentation](dagent_docs/dagents_backend_docs.docx): DistilBERT, PyTorch, SafeTensors, ONNX, softmax
- [Training notebook](dagnet_training/dagent_training.ipynb) and [dataset](dagnet_training/dagent_dataset.csv)