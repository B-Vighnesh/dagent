// background.js (MV3 service worker)
// IMPORTANT: you must copy ort-wasm.js / ort-wasm.wasm and tokenizer wasm/js into extension assets.
// See packaging instructions below.

let ORT = null;
let session = null;
let tokenizer = null;
let modelLoaded = false;

// Configuration
const MODEL_PATH = "model/model_inlined.onnx"; // if you bundle model inside extension
// Alternative: set MODEL_DOWNLOAD_URL to let extension download model once and cache in IndexedDB
const MODEL_DOWNLOAD_URL = null; // e.g. "https://your.cdn.com/onnx/model_inlined.onnx"

// Threshold for showing alert
const ALERT_THRESHOLD = 0.6;

// Utility: load onnxruntime-web
async function loadOrt() {
  if (ORT) return ORT;
  // The file ort-wasm.js should have been copied into extension under ort/
  importScripts(chrome.runtime.getURL("ort/ort-wasm.js"));
  // ort should be exposed as global `ort`
  ORT = self.ort || (typeof window !== "undefined" && window.ort);
  if (!ORT) throw new Error("onnxruntime-web (ort) not found. Make sure ort/ort-wasm.js is included.");
  return ORT;
}

// Utility: fetch model bytes (either from packaged file or from download+cache)
async function fetchModelBytes() {
  if (MODEL_DOWNLOAD_URL) {
    // download and cache approach (recommended if extension store size is an issue)
    const cacheKey = "onnx_model_cached";
    const modelFromStorage = await getFromIndexedDB(cacheKey);
    if (modelFromStorage) {
      return modelFromStorage;
    } else {
      const res = await fetch(MODEL_DOWNLOAD_URL);
      const ab = await res.arrayBuffer();
      await saveToIndexedDB(cacheKey, ab);
      return ab;
    }
  } else {
    // load packaged model asset via chrome.runtime.getURL
    const url = chrome.runtime.getURL(MODEL_PATH);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch packaged model: " + res.status);
    return await res.arrayBuffer();
  }
}

// IndexedDB helpers for caching large model (binary ArrayBuffer)
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("dpguard_db_v1", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function saveToIndexedDB(key, arrayBuffer) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(arrayBuffer, key);
    tx.oncomplete = () => res(true);
    tx.onerror = e => rej(e.target.error);
  });
}
async function getFromIndexedDB(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readonly");
    const r = tx.objectStore("files").get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = e => rej(e.target.error);
  });
}

// Load model into ONNX Runtime session
async function loadModel() {
  if (session) return session;
  await loadOrt();
  const modelBytes = await fetchModelBytes();
  session = await ORT.InferenceSession.create(modelBytes, { executionProviders: ["wasm"] });
  modelLoaded = true;
  return session;
}

// -------- Tokenizer handling --------
// Two methods:
//  - Preferred: bundle @huggingface/tokenizers WASM and use tokenizer.encode(text) which returns ids, attention_mask.
//  - Fallback: load tokenizer.json (if it has a simple vocab map) and do whitespace tokenization + mapping.

// Try to initialize HF tokenizers WASM if present
async function tryLoadHFTokenizer() {
  if (tokenizer) return tokenizer;
  try {
    // You must copy tokenizers' browser bundle (tokenizers.js + tokenizers.wasm) into tokenizer/
    importScripts(chrome.runtime.getURL("tokenizer/tokenizers.js")); // this is the bundle created by bundling @huggingface/tokenizers
    // The bundle should expose a global `Tokenizers` or similar API. This depends on how you package it.
    if (typeof Tokenizers !== "undefined" && Tokenizers) {
      // Example: Tokenizers.fromString - actual API depends on bundle; adapt as needed.
      const tokJson = await (await fetch(chrome.runtime.getURL("tokenizer/tokenizer.json"))).text();
      // Some tokenizers libs expose a `Tokenizer` class with fromString(json)
      tokenizer = Tokenizers.fromString ? Tokenizers.fromString(tokJson) : null;
      if (!tokenizer && Tokenizers.Tokenizer && Tokenizers.Tokenizer.fromString) {
        tokenizer = await Tokenizers.Tokenizer.fromString(tokJson);
      }
      if (!tokenizer) throw new Error("Tokenizers wasm bundle found but API didn't initialize. Check packaging.");
      return tokenizer;
    } else {
      console.warn("Tokenizers WASM bundle not found or didn't expose Tokenizers.");
      return null;
    }
  } catch (e) {
    console.warn("HF Tokenizers WASM not available or failed:", e);
    tokenizer = null;
    return null;
  }
}

// Fallback tokenizer: attempt to load a simple vocab map from tokenizer.json and do whitespace token mapping
async function loadFallbackTokenizer() {
  if (tokenizer) return tokenizer;
  try {
    const resp = await fetch(chrome.runtime.getURL("tokenizer/tokenizer.json"));
    if (!resp.ok) throw new Error("tokenizer.json not found");
    const tok = await resp.json();
    // If tokenizer.json contains a direct 'model' -> 'vocab' map (BPE-less), we can use it
    // Many tokenizers.json files are complex; this fallback is naive.
    const vocab = tok?.model?.vocab || tok?.vocab || null;
    const unk = tok?.unk_token_id ?? tok?.unk_id ?? (vocab ? (vocab["[UNK]"] ?? vocab["<unk>"] ?? 0) : 0);
    if (!vocab) {
      console.warn("tokenizer.json doesn't contain a simple vocab mapping; fallback will be whitespace-only and use unknown ids.");
      tokenizer = { type: "fallback_whitespace", vocab: null, unk };
      return tokenizer;
    }
    tokenizer = { type: "vocab_map", vocab, unk };
    return tokenizer;
  } catch (e) {
    console.warn("Fallback tokenizer not available:", e);
    tokenizer = { type: "fallback_whitespace", vocab: null, unk: 0 };
    return tokenizer;
  }
}

function encodeWithFallback(tokObj, text, maxLen = 256) {
  // simple whitespace split -> map tokens to vocab ids if available; otherwise unknown
  let toks = text.split(/\s+/).slice(0, maxLen);
  let input_ids = new Array(maxLen).fill(0);
  let attention_mask = new Array(maxLen).fill(0);
  for (let i = 0; i < toks.length && i < maxLen; i++) {
    let w = toks[i].toLowerCase();
    let id = tokObj.vocab && tokObj.vocab[w] !== undefined ? tokObj.vocab[w] : tokObj.unk || 0;
    input_ids[i] = id;
    attention_mask[i] = 1;
  }
  return { input_ids, attention_mask };
}

// Unified encode function: tries HF wasm tokenizer first, then fallback
async function encodeText(text, maxLen = 256) {
  // try real tokenizer
  const hf = await tryLoadHFTokenizer();
  if (hf && hf.encode) {
    // Many HF wasm tokenizers offer encode(text) -> { ids, attention_mask }
    const enc = hf.encode(text);
    // normalize to arrays of length maxLen
    let ids = Array.from(enc.ids).slice(0, maxLen);
    let am = Array.from(enc.attentionMask || enc.attention_mask || new Array(ids.length).fill(1));
    // pad
    while (ids.length < maxLen) { ids.push(0); am.push(0); }
    return { input_ids: ids, attention_mask: am };
  }

  // fallback to vocab mapping or whitespace
  const fb = await loadFallbackTokenizer();
  return encodeWithFallback(fb, text, maxLen);
}

// Run inference for a given text (returns probability of 'dark')
async function analyzeText(text) {
  if (!modelLoaded) {
    try {
      await loadModel();
    } catch (e) {
      return { error: "model_load_failed", detail: String(e) };
    }
  }
  // quick heuristics to avoid heavy tokenization for trivial pages
  if (/auto-?renew|confirm.*subscription|hidden.*checkbox|pre-?checked|opt-?out/i.test(text)) {
    return { probDark: 0.8, by: "heuristic" };
  }

  const enc = await encodeText(text, 256);
  // prepare ort tensors (onnxruntime-web accepts int32 arrays for many models; cast to int32)
  const inputIds = new Int32Array(enc.input_ids);
  const attMask = new Int32Array(enc.attention_mask);

  const feeds = {
    input_ids: new ORT.Tensor("int32", inputIds, [1, inputIds.length]),
    attention_mask: new ORT.Tensor("int32", attMask, [1, attMask.length])
  };

  try {
    const out = await session.run(feeds);
    // out names depend on ONNX export ("bin_logits","pat_logits")
    const bin = out.bin_logits || out[Object.keys(out)[0]];
    // bin is Float32Array with shape [1,2]
    const logits = Array.from(bin.data ? bin.data : bin);
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const sum = exps.reduce((a,b)=>a+b,0);
    const probDark = exps[1] / sum;
    return { probDark, logits };
  } catch (e) {
    return { error: "inference_failed", detail: String(e) };
  }
}

// When content script sends a page, run analyze and raise notification if needed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PAGE_TEXT") {
    (async () => {
      const res = await analyzeText(msg.text.slice(0, 20000));
      if (res && res.probDark && res.probDark > ALERT_THRESHOLD) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/warning-48.png",
          title: "Possible dark pattern detected",
          message: `Risk ${(res.probDark*100).toFixed(1)}% — click to inspect.`,
          priority: 2
        });
      }
      sendResponse({ ok: true, res });
    })();
    return true; // indicate async
  }
});
