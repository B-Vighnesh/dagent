// background.js
// Owns the actual network call to the FastAPI backend. Content scripts send
// scraped blocks here; this worker batches them per tab (small debounce
// window so bursts from multiple triggers collapse into one request),
// then relays detections back to the tab that asked.
//
// It also persists each flagged detection into chrome.storage.local under
// `detections_<tabId>` (an array of { text, category, confirmed }), which is
// what popup.js reads to render the count/breakdown and "last 5" list.

// Backend URL is fixed — no settings UI, so nothing else needs to read/write
// chrome.storage.sync for it. Change this one line if the backend port changes.
const API_ENDPOINT = "http://localhost:8000";
const BATCH_WINDOW_MS = 200;

// tabId -> { blocks: [{block_id, text, tag}], timer, meta: {page_url, viewport_width, viewport_height} }
const pendingBatches = new Map();

// tabId -> count of flagged detections this session (for the badge)
const tabDetectionCounts = new Map();

function setBadge(tabId, count) {
  chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#A32D2D" });
}

// ---------------- popup storage helpers ----------------

function detectionsKey(tabId) {
  return `detections_${tabId}`;
}

async function appendDetections(tabId, newDetections) {
  if (newDetections.length === 0) return;
  const key = detectionsKey(tabId);
  const stored = await chrome.storage.local.get(key);
  const existing = Array.isArray(stored[key]) ? stored[key] : [];
  await chrome.storage.local.set({ [key]: existing.concat(newDetections) });
}

async function clearDetections(tabId) {
  await chrome.storage.local.remove(detectionsKey(tabId));
}

// display_color "orange" == lower-confidence / not auto-confirmed, matches
// the toast's "(unconfirmed)" label in content-script.js.
function toStoredDetection(d) {
  return {
    text: d.sentence,
    category: d.category,
    confirmed: (d.display_color || "red") !== "orange",
    reasoning: d.llm_reasoning || null,
  };
}

// ---------------- batching / backend call ----------------

async function flushBatch(tabId) {
  const batch = pendingBatches.get(tabId);
  if (!batch || batch.blocks.length === 0) {
    pendingBatches.delete(tabId);
    return;
  }
  pendingBatches.delete(tabId);

  try {
    const res = await fetch(`${API_ENDPOINT}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_url: batch.meta.page_url,
        viewport_width: batch.meta.viewport_width,
        viewport_height: batch.meta.viewport_height,
        blocks: batch.blocks,
      }),
    });

    if (!res.ok) {
      throw new Error(`Backend responded ${res.status}`);
    }

    const data = await res.json();

    const flaggedThisBatch = data.results.reduce(
      (sum, r) => sum + (r.detections ? r.detections.length : 0),
      0
    );
    if (flaggedThisBatch > 0) {
      const prev = tabDetectionCounts.get(tabId) || 0;
      const next = prev + flaggedThisBatch;
      tabDetectionCounts.set(tabId, next);
      setBadge(tabId, next);

      const toStore = data.results.flatMap((r) =>
        (r.detections || []).map(toStoredDetection)
      );
      appendDetections(tabId, toStore);
    }

    chrome.tabs.sendMessage(tabId, { type: "SCAN_RESULT", results: data.results }).catch(() => {
      // tab may have navigated away already; safe to ignore
    });
  } catch (err) {
    chrome.tabs
      .sendMessage(tabId, { type: "SCAN_ERROR", error: String(err && err.message ? err.message : err) })
      .catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SCAN_BLOCKS") return;
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;

  let batch = pendingBatches.get(tabId);
  if (!batch) {
    batch = { blocks: [], timer: null, meta: {} };
    pendingBatches.set(tabId, batch);
  }

  batch.blocks.push(...message.blocks);
  batch.meta = {
    page_url: message.page_url,
    viewport_width: message.viewport_width,
    viewport_height: message.viewport_height,
  };

  if (batch.timer) clearTimeout(batch.timer);
  batch.timer = setTimeout(() => flushBatch(tabId), BATCH_WINDOW_MS);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingBatches.delete(tabId);
  tabDetectionCounts.delete(tabId);
  clearDetections(tabId);
});

// Reset per-tab state on navigation so a fresh page starts at zero.
// (Using tabs.onUpdated instead of webNavigation to avoid an extra permission.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    tabDetectionCounts.set(tabId, 0);
    setBadge(tabId, 0);
    clearDetections(tabId);
  }
});