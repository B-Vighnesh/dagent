// Backend URL is fixed — no UI to change it, so there's nothing to crash if
// an element is missing. Change this one line if the backend port changes.
// NOTE: your FastAPI backend has been running on port 8000 in every example
// so far in this project — double check this is really meant to be 8080,
// otherwise checkHealth() will always show "offline" against a live backend.
const API_ENDPOINT = "http://localhost:8080";

const statusDot = document.getElementById("statusDot");
const detectionCountEl = document.getElementById("detectionCount");
const confirmedCountEl = document.getElementById("confirmedCount");
const unconfirmedCountEl = document.getElementById("unconfirmedCount");
const detectionsListEl = document.getElementById("detectionsList");
const toggleDetectionsBtn = document.getElementById("toggleDetectionsBtn");

let detectionsLoaded = false;

/*
 * Data contract expected from the content script:
 * chrome.storage.local key `detections_<tabId>` holds an array of objects,
 * appended in the order they were found on the page:
 *   { text: "Only 2 left in stock!", category: "Scarcity", confirmed: true,
 *     reasoning: "Creates false urgency by implying limited availability." }
 * `confirmed` = the classifier is confident in this call (vs. a lower-confidence
 * flag surfaced for the user/community to weigh in on).
 * `reasoning` = the LLM's explanation for the flag; may be null if the
 * backend didn't return one for that detection.
 */

async function checkHealth(endpoint) {
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/health`, { method: "GET" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    statusDot.className = data.status === "ok" ? "dot ok" : "dot";
  } catch (err) {
    statusDot.className = "dot error";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

let currentDetections = [];

function updateStats(detections) {
  const total = detections.length;
  const confirmed = detections.filter((d) => d.confirmed).length;
  const unconfirmed = total - confirmed;

  detectionCountEl.textContent = total;
  confirmedCountEl.textContent = `${confirmed} confirmed`;
  unconfirmedCountEl.textContent = `${unconfirmed} unconfirmed`;
}

function renderDetectionsList(detections) {
  if (detections.length === 0) {
    detectionsListEl.innerHTML = `<li class="detection-empty">No detections on this page yet.</li>`;
    return;
  }

  const lastFive = detections.slice(-5).reverse();

  detectionsListEl.innerHTML = lastFive
    .map((d, i) => {
      const verdictClass = d.confirmed ? "confirmed" : "unconfirmed";
      const pillLabel = d.confirmed ? d.category : `${d.category} \u00b7 unconfirmed`;

      const reasonToggle = d.reasoning
        ? `<button class="reason-toggle" data-index="${i}">Why?</button>`
        : "";
      const reasonBlock = d.reasoning
        ? `<p class="detection-reasoning" id="reason-${i}" hidden>${escapeHtml(d.reasoning)}</p>`
        : "";

      return `
        <li>
          <div class="detection-body">
            <p class="detection-text">"${escapeHtml(d.text)}"</p>
            <div class="detection-meta-row">
              <span class="detection-pill ${verdictClass}">${escapeHtml(pillLabel)}</span>
              ${reasonToggle}
            </div>
            ${reasonBlock}
          </div>
        </li>`;
    })
    .join("");
}

async function loadDetections() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    currentDetections = [];
    updateStats(currentDetections);
    return;
  }

  const key = `detections_${tab.id}`;
  const stored = await chrome.storage.local.get(key);
  currentDetections = Array.isArray(stored[key]) ? stored[key] : [];
  updateStats(currentDetections);

  // Keep the list fresh if it's already open when new detections come in.
  if (!detectionsListEl.hidden) {
    renderDetectionsList(currentDetections);
  }
}

toggleDetectionsBtn.addEventListener("click", () => {
  const willOpen = detectionsListEl.hidden;
  detectionsListEl.hidden = !willOpen;
  toggleDetectionsBtn.classList.toggle("open", willOpen);
  toggleDetectionsBtn.textContent = willOpen ? "Hide recent detections" : "Show recent detections";

  if (willOpen && !detectionsLoaded) {
    renderDetectionsList(currentDetections);
    detectionsLoaded = true;
  }
});

detectionsListEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".reason-toggle");
  if (!btn) return;
  const reasonEl = document.getElementById(`reason-${btn.dataset.index}`);
  const willShow = reasonEl.hidden;
  reasonEl.hidden = !willShow;
  btn.textContent = willShow ? "Hide reasoning" : "Why?";
});

(async () => {
  checkHealth(API_ENDPOINT);
  loadDetections();
})();
