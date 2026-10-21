<p align="center">
  <img src="assets/logo.png" alt="Dagent logo" width="140">
</p>

<h1 align="center">Dagent</h1>
<p align="center"><b>The web has secrets. We find them.</b><br>
A browser extension that spots dark patterns on the page you are reading, down to the exact sentence, and tells you in real time. Making it run fully offline is the current goal.</p>

---

## Contents

1. [The idea](#1-the-idea)
2. [Where the project actually stands](#2-where-the-project-actually-stands)
3. [Privacy: the goal and the gap](#3-privacy-the-goal-and-the-gap)
4. [How Dagent works today](#4-how-dagent-works-today)
5. [Dark pattern categories and dataset](#5-dark-pattern-categories-and-dataset)
6. [Models and training](#6-models-and-training)
7. [Detection service (FastAPI)](#7-detection-service-fastapi)
8. [Browser extension](#8-browser-extension)
9. [Website](#9-website)
10. [Repository map](#10-repository-map)
11. [Getting started](#11-getting-started)
12. [Privacy audit of the current prototype](#12-privacy-audit-of-the-current-prototype)
13. [Known issues and limitations](#13-known-issues-and-limitations)
14. [Roadmap to fully offline](#14-roadmap-to-fully-offline)
15. [Further reading](#15-further-reading)

---

## 1. The idea

Websites often steer people into choices they did not mean to make: fake urgency ("Sale ends in 5 minutes!"), false scarcity ("Only 2 left!"), fabricated social proof ("14 people are viewing this"), guilt-trip opt-outs, hidden costs, and subscriptions that are one click to join and a phone call to leave.

Dagent is a browser extension that reads the page you are looking at, flags manipulative wording as you scroll, and names:

- **the exact sentence** that triggered the flag,
- **the tactic** (Scarcity, Urgency, Social Proof, and so on),
- **a confidence score**, so you can see why and not just that something was flagged.

It is aimed at the **whole web**, not just shopping carts: a streaming trial that quietly auto-renews, a newsletter popup that returns no matter how often you close it, and a signup that buries "continue without an account" are all read the same way.

---

## 2. Where the project actually stands

**In one line:** the detection pipeline and the extension work end to end as a local prototype. The privacy goal, running with no server and no LLM API, is **not built yet**.

| Component | Status | Notes |
|---|---|---|
| Dataset (2,356 labelled rows, 7 categories) | Done | Three categories have very little data (see section 5) |
| Two-stage DistilBERT training notebook | Done | Saved notebook has no recorded outputs, so **no accuracy figures are published** |
| FastAPI detection service (`/health`, `/detect`) | Working prototype | Runs on `localhost:8000` and needs PyTorch, spaCy and the model files |
| Chrome (Manifest V3) extension | Working prototype | Scrapes, caches, calls the service, draws popups and badge. Needs the service running |
| LLM verification stage | Working in code, **optional** | Calls Groq's hosted API. Only active when `GROQ_API_KEY` is set. **This is the step that sends page text off the device** |
| Website (home, scan demo, download, feedback) | Demo only | Scan page uses scripted examples, not live predictions. Some copy is out of date (section 12) |
| Offline / on-device models (ONNX, in-browser) | **Not started** | No export script, no `transformers.js` or `onnxruntime-web` code in the repo. Only planned |
| Local replacement for the LLM verifier | **Not started** | Design decision still open |
| Hosted / deployed detector | Not in this repo | The manifest still allows `ngrok` hosts, left over from testing against a tunnelled backend |
| Packaged, one-click installable extension | Not started | Users currently have to run the Python service themselves |

### What changed compared with earlier descriptions

Earlier summaries of this project said the system was a finished pipeline with an LLM stage that "verifies each candidate" and that detection was moving offline. More precisely:

- **The two DistilBERT stages are real and working.** Stage 1 (binary) and Stage 2 (7-category) run locally in the FastAPI service.
- **The LLM verifier is real but optional and not the default.** Without a Groq key, every detection is shown as `unverified` in red. With a key, flagged sentences go to Groq's API and come back `confirmed`, `partial` or `rejected` with a short reason. 
- **Offline is a plan, not progress.** Exporting to ONNX and running in the browser has not been started. Running the service on `localhost` keeps data on the machine, but that is a developer setup, not an offline product.

---

## 3. Privacy: the goal and the gap

Dagent reads what you read. That is only acceptable if what it reads never leaves your hands. The design goal is:

> **Page content, URLs and detection results must never be sent to an LLM, an online API, or any other remote service.**

The current prototype does not fully meet that goal yet:

| | Today | Target |
|---|---|---|
| Sentence splitting and classification | Local (Python service on `localhost`) | In the browser (ONNX) |
| Verification / reasoning | **Hosted LLM (Groq) when a key is set. Page text leaves the device** | Local only, or dropped |
| Server needed | Yes, a local FastAPI process | None |
| Remote hosts allowed by the extension | `localhost` plus `ngrok` tunnels | None |
| Telemetry / analytics | None | None |
| Stored data | Per-tab `chrome.storage.local` plus an in-memory cache, cleared on navigation or tab close | Same |

**With the defaults (service on `localhost`, `GROQ_API_KEY` empty), nothing leaves the machine.** Turning on the LLM stage is what breaks the privacy goal, and that is the main reason the project is moving to on-device models.

---

## 4. How Dagent works today

A two-stage cascade, with an optional third stage. The second stage only sees what the first flagged, which keeps it fast enough to run continuously.

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
Detector service (localhost:8000)
   1. spaCy splits text into sentences
   2. Stage 1  "The Lookout"    binary DistilBERT: dark pattern or not?   (every sentence)
   3. Stage 2  "The Profiler"   category DistilBERT: which tactic?        (flagged sentences only)
   4. Stage 3  LLM review       OPTIONAL, hosted (Groq), off by default   (flagged sentences only)
   |
   v
Popup in the page: red = flagged (sentence, category, confidence), green = clean (first time only)
Toolbar badge + popup panel: per-tab count and the last five detections
```

### Stage by stage

| Stage | Model | Question it answers | Runs on | Where it runs |
|---|---|---|---|---|
| 1 | `distilbert-base-uncased`, fine-tuned | Is this sentence a dark-pattern candidate? | Every sentence | Local |
| 2 | `distilbert-base-uncased`, fine-tuned (class-weighted) | Which category is it? | Stage 1 positives only | Local |
| 3 | Groq-hosted LLM (`openai/gpt-oss-20b` by default) | Does the sentence fit its claimed category? Verdict plus a short reason | Stage 2 output | **Remote, optional** |

Both DistilBERT stages use `MAX_SEQ_LENGTH = 128` and softmax probabilities. A sentence is flagged when its Stage 1 probability is at or above `BINARY_THRESHOLD` (default 0.5). Stage 2 reports the top category with its confidence.

### About Stage 3

Stage 3 sends each flagged **sentence, its category and confidence** to Groq (not the page URL) and filters or recolours detections by the verdict: `confirmed` stays red, `partial` becomes orange, `rejected` is dropped. If the call fails, detections fall back to `unverified`.

Because this sends page text to a third party, it conflicts with Dagent's privacy goal and **will be removed from the shippable product**. A replacement, if any, has to run on the device (see section 14).

### Architecture options that were considered

| Approach | Idea | Verdict |
|---|---|---|
| A. Extension sends text to an LLM | Fastest to prototype, but costly, slow, and sends page text to a third party | Rejected (privacy and cost) |
| B. Own model, then LLM for flagged text | Cheap first pass, LLM only for ambiguous cases | **What is built today**; the LLM step is optional and is being removed for privacy |
| C. Fully on-device | The same models exported to ONNX and run in the browser | **The target, not started** |

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

**File:** `dagnet_training/dagent_dataset.csv`

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

Training is in `dagnet_training/dagent_training.ipynb`, written for **Google Colab** (a T4 GPU is enough). Run all cells top to bottom and upload the dataset when prompted.

- **Grouped split by `page_id`** (70 / 15 / 15 train / val / test). Many rows share a page, so a plain random split would leak a page's style across train and test and inflate scores.
- **Stage 1:** fine-tunes `distilbert-base-uncased` on `label`, 4 epochs, learning rate 2e-5, batch size 16, best model chosen by F1.
- **Stage 2:** trains only on `label == 1` rows, 8 epochs, with **inverse-frequency class weights** through a custom `WeightedTrainer` so rare classes are not ignored.
- **Inference helper:** spaCy sentence segmentation (naive `.split('.')` breaks on "Dr.", "$19.99", "e.g."), Stage 1, then Stage 2, returning detections with character offsets.
- **Output:** both models plus Stage 2's `label_map.json`, zipped as `dark_pattern_models.zip`.

**Evaluation status:** the notebook computes classification reports, but the saved copy has no outputs, so there are no recorded metrics in the repo. Re-run it and commit the results before making any accuracy claim. `BINARY_THRESHOLD` should be tuned on the validation set, not the test set.

**Model files** are too large for Git. Download them from the [shared Google Drive folder](https://drive.google.com/drive/folders/1RJFFZU4_VKOmU0d6JxKUz0t0DvrIS4ou?usp=sharing).

### Technology cheat sheet

| Technology | Role |
|---|---|
| DistilBERT | Model architecture for both stages |
| PyTorch | Runs the models today (TensorFlow is not used) |
| Transformers (Hugging Face) | Loads the tokenizer and models |
| SafeTensors | File format that stores the learned weights |
| Tokenizer | Turns sentences into token IDs |
| spaCy | Sentence splitting (needs a JS replacement for the in-browser build) |
| Softmax | Turns raw logits into probabilities |
| ONNX | **Planned** export format for the on-device build; not yet used |

A full walk-through is in the [backend learning documentation](dagent_docs/dagents_backend_docs.docx).

---

## 7. Detection service (FastAPI)

A local service that wraps the models. Models load **once at startup** (FastAPI `lifespan`), not per request.

```
dagent_api/
├── app/
│   ├── main.py          # app, CORS, /health, /detect
│   ├── inference.py     # DarkPatternDetector: spaCy, tokenizer, Stage 1 + 2, softmax, thresholds
│   ├── config.py        # model paths, thresholds, MAX_SEQ_LENGTH, DEVICE, CORS, optional Groq settings
│   ├── schemas.py       # Pydantic request/response models
│   └── llm_verifier.py  # optional Groq review stage, sends text off-device, to be removed
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

An empty `detections` list means clean text. `start_offset` and `end_offset` locate the sentence inside the original block. `llm_verdict` is `unverified` unless Stage 3 is enabled, in which case it is `confirmed` or `partial` and `llm_reasoning` carries a short reason.

**Privacy behaviour of the service:** it logs only counts and timings (never page text or URLs), and `page_url` is accepted but not used or stored.

**Configuration** (environment variables or `dagent_api/.env`, defaults in `.env.example`): `STAGE1_MODEL_DIR`, `STAGE2_MODEL_DIR`, `BINARY_THRESHOLD`, `CATEGORY_THRESHOLD`, `MAX_SEQ_LENGTH`, `DEVICE` (`cpu` or `cuda`), `ALLOWED_ORIGINS` (defaults to `*`; use explicit origins outside local development).

> The `GROQ_*` and `REJECTED_LOG_PATH` settings belong to the optional review stage. **Leave them unset** to keep everything on the machine.

---

## 8. Browser extension

A Chrome Manifest V3 extension in `dagent_extension/`.

| Piece | Role |
|---|---|
| `content/content-script.js` | Scrapes visible text, hashes it, keeps the in-memory cache, draws the popup |
| `background.js` | Batches blocks (200ms window) and calls the detector at `http://localhost:8000`; sets the toolbar badge; keeps per-tab detections |
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

**Timing.** A first-time classification takes roughly 500 to 550ms from scroll-stop to popup (300ms scroll debounce, 200ms batch window, about 120ms measured inference on the ML stages, without the LLM stage). A replay takes about 300ms, bounded only by the trigger's debounce. With the Groq stage on, add a network round trip of up to the 8-second timeout.

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

It is a demonstration of the product idea. The scan examples are written into the frontend and are **not live model predictions**. Parts of the copy (a "deployed model", an "LLM reasoning engine") describe an earlier design and no longer match the project (section 12).

---

## 10. Repository map

| Folder | What you will find |
|---|---|
| `dagent_api/` | FastAPI detection service |
| `dagent_extension/` | Chrome Manifest V3 extension |
| `dagent_frontend_ui/` | React and Vite website with the simulated scan demo |
| `dagnet_training/` | Training notebook and dataset |
| `dagent_docs/` | Documentation, architecture notes, design materials, copies of training resources (some are older than the code) |
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

With the default setup (local service, `GROQ_API_KEY` empty), **page text stays on the user's machine**. The items below would change that, or contradict the privacy goal, and need to be fixed before anything ships.

| Item | Where | Risk | Action |
|---|---|---|---|
| Groq review stage | `app/llm_verifier.py`, `GROQ_API_KEY` | Sends each flagged **sentence, its category and confidence** to Groq (page URL is not included) | Keep disabled; remove from the product |
| Remote hosts in the extension | `manifest.json` `host_permissions` includes `*.ngrok-free.app`, `*.ngrok-free.dev`, `*.ngrok.io` | Would let the extension send page text to a tunnelled or hosted server | Remove for any release build; keep `localhost` only |
| Rejected-sentence log | `REJECTED_LOG_PATH` | Writes visited-page text to disk | Leave unset; only relevant to the Groq stage |
| Wide CORS | `ALLOWED_ORIGINS=*` (default) | Any web page could call the local service | Set to the extension origin |
| Debug logging | `console.debug` in `content-script.js` prints scraped results | Page text appears in the dev console | Remove or gate behind a dev flag |
| Website wording | Home and Download pages say detection runs on a "deployed model" and an "LLM reasoning engine" | Describes a design that is being removed and a hosted service that is not in this repo | Reword to match this README |
| Feedback form | `FeedbackPage` collects an email address | Personal data; currently not wired to a backend | Decide whether to keep; if so, state clearly what is stored |

---

## 13. Known issues and limitations

- **Not offline yet.** Detection needs a local Python service with PyTorch and spaCy. There is no in-browser inference.
- **LLM stage is unevaluated and off-device.** It is optional, sends text to a third party, and its effect on false positives has not been measured.
- **No published metrics.** The training notebook has no saved outputs, so there are no accuracy figures to quote.
- **Port mismatch.** `popup/popup.js` checks health on `http://localhost:8080` while `background.js` and the service use `8000`, so the popup status dot can show "offline" while detection works.
- **Stale extension README.** `dagent_extension/README.md` is a copy of an old API README and does not describe the extension.
- **Rare categories.** Obstruction (27), Sneaking (12) and Forced Action (4) have very little data, so Stage 2 is unreliable on them until more labelled examples exist.
- **Text only.** Visual tricks (pre-ticked boxes, hidden buttons, colour and size manipulation) are not covered; the extension reads text.
- **Broad scraping.** Matching `span`, `div`, `a` and similar elements catches more text but can also send repeated or nested text; this is a precision and performance trade-off still to tune.
- **128-token limit.** Longer sentences are truncated and the model never sees the excess.
- **Older docs.** Files in `dagent_docs/` (for example `dagent_documentation.md`) describe the project as it was earlier, such as the extension "not started", and should not be treated as current status.
- **Not a shippable download yet.** Users would currently have to run the local service themselves.

---

## 14. Roadmap to fully offline

None of the items below are done yet. They are listed in the order they are likely to be tackled.

1. **Export to ONNX.** Convert both DistilBERT models with `optimum` (`ORTModelForSequenceClassification`) and check that outputs match the PyTorch models.
2. **Shrink the models.** Quantize (for example int8) and, if needed, distil. The aim is a download and memory footprint that is reasonable for an extension.
3. **Run in the browser.** Load the ONNX models with `transformers.js` or `onnxruntime-web` in a service worker or offscreen document, and replace spaCy sentence splitting with a JavaScript splitter. Measure latency against the current ~120ms server-side figure.
4. **Remove the cloud LLM.** Delete the Groq path from the build. Decide what, if anything, replaces it locally: a small on-device model, or confidence bands from Stage 2 itself.
5. **Privacy hardening.** Remove `ngrok` hosts and debug logging, drop the need for `localhost`, and reword the website.
6. **Evaluate properly.** Re-run training, record precision, recall and F1 per stage and per category, tune `BINARY_THRESHOLD` on the validation set, and compare the offline build against the current one.
7. **More data** for Obstruction, Sneaking and Forced Action.
8. **Feedback loop without surveillance.** If user reports feed retraining, make it explicit opt-in, per report, with the user choosing what to share.
9. **Package and publish** the extension, then wire up the website's Download page.

---

## 15. Further reading

- [Detection service notes](dagent_api/README.md)
- [Website notes](dagent_frontend_ui/README.md)
- [Project documentation](dagent_docs/dagent_documentation.md): problem statement, architecture options, dataset and model design (written earlier; status tables are out of date)
- [Extension architecture notes](dagent_docs/dagent_architecture_1): trigger-to-popup flow, cache logic, timing
- [Backend learning documentation](dagent_docs/dagents_backend_docs.docx): DistilBERT, PyTorch, SafeTensors, ONNX, softmax
- [Training notebook](dagnet_training/dagent_training.ipynb) and [dataset](dagnet_training/dagent_dataset.csv)