// content-script.js
// Runs on every page. Scrapes currently-visible text blocks, re-scrapes on
// DOM change / scroll / mouse-idle, dedupes against already-classified text,
// and shows a single-slot popup (red = flagged, green = clean) for results.

(() => {
  const SCRAPE_SELECTOR = "p, h1, h2, h3, h4, span, div, li, a, label";
  const MIN_TEXT_LENGTH = 3;

  // Minimum percentage of an element's area that must be visible
  // inside the browser viewport before it is scraped.
  const MIN_VISIBLE_RATIO = 0.5;

  const MUTATION_DEBOUNCE_MS = 400;
  const SCROLL_DEBOUNCE_MS = 300;
  const MOUSE_IDLE_MS = 500;

  const TOAST_DISPLAY_MS = 4000;

  const classifiedCache = new Map();
  const inFlight = new Set();
  const lastShownAt = new Map();
  const REPLAY_COOLDOWN_MS = 600;

  let blockIdCounter = 0;
  const elementToBlockId = new WeakMap();
  let lastSentAt = 0;

  function hashText(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
      h = (h * 33) ^ text.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  // Checks whether a meaningful portion of the element is actually
  // visible inside the current browser viewport.
  function isVisible(el) {
    const rect = el.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = window.getComputedStyle(el);

    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }

    // Calculate the intersection between the element and viewport.
    const visibleLeft = Math.max(rect.left, 0);
    const visibleRight = Math.min(rect.right, window.innerWidth);
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);

    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    if (visibleWidth <= 0 || visibleHeight <= 0) {
      return false;
    }

    const elementArea = rect.width * rect.height;
    const visibleArea = visibleWidth * visibleHeight;

    const visibleRatio = visibleArea / elementArea;

    return visibleRatio >= MIN_VISIBLE_RATIO;
  }

  function getBlockId(el) {
    if (!elementToBlockId.has(el)) {
      blockIdCounter += 1;
      elementToBlockId.set(el, `dagent-${blockIdCounter}`);
    }

    return elementToBlockId.get(el);
  }

  function scrapeVisibleBlocks() {
    const candidates = document.querySelectorAll(SCRAPE_SELECTOR);

    const newBlocks = [];
    const cachedHitsToReplay = [];

    for (const el of candidates) {
      const text = (el.innerText || el.textContent || "").trim();

      if (text.length < MIN_TEXT_LENGTH) {
        continue;
      }

      // IMPORTANT:
      // Only scrape text that is meaningfully visible on screen.
      if (!isVisible(el)) {
        continue;
      }

      const blockId = getBlockId(el);
      const hash = hashText(text);

      if (classifiedCache.has(hash)) {
        const cachedDetections = classifiedCache.get(hash);
        const last = lastShownAt.get(hash) || 0;

        if (
          cachedDetections.length > 0 &&
          Date.now() - last > REPLAY_COOLDOWN_MS
        ) {
          cachedHitsToReplay.push({
            block_id: blockId,
            source_text: text,
            detections: cachedDetections,
          });

          lastShownAt.set(hash, Date.now());
        }

        continue;
      }

      if (inFlight.has(hash)) {
        continue;
      }

      inFlight.add(hash);

      newBlocks.push({
        block_id: blockId,
        text,
        tag: el.tagName.toLowerCase(),
        _hash: hash,
      });
    }

    return {
      newBlocks,
      cachedHitsToReplay,
    };
  }

  function sendBlocksIfAny() {
    const { newBlocks, cachedHitsToReplay } =
      scrapeVisibleBlocks();

    console.debug("[Dagent] scrape cycle:", {
      new: newBlocks.length,
      cachedReplay: cachedHitsToReplay.length,
    });

    if (cachedHitsToReplay.length > 0) {
      console.debug(
        "[Dagent] replaying cached hits:",
        cachedHitsToReplay
      );

      presentResults(cachedHitsToReplay);
    }

    if (newBlocks.length === 0) {
      return;
    }

    const payloadBlocks = newBlocks.map(
      ({ _hash, ...rest }) => rest
    );

    lastSentAt = performance.now();

    console.debug(
      `[Dagent] sending ${payloadBlocks.length} block(s) to backend...`
    );

    chrome.runtime.sendMessage({
      type: "SCAN_BLOCKS",
      blocks: payloadBlocks,
      page_url: location.href,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    });
  }

  // ---------------- debounce helpers ----------------

  function debounce(fn, ms) {
    let t = null;

    return (...args) => {
      if (t) {
        clearTimeout(t);
      }

      t = setTimeout(() => fn(...args), ms);
    };
  }

  const debouncedScrapeOnMutation = debounce(
    sendBlocksIfAny,
    MUTATION_DEBOUNCE_MS
  );

  const debouncedScrapeOnScroll = debounce(
    sendBlocksIfAny,
    SCROLL_DEBOUNCE_MS
  );

  const debouncedScrapeOnMouseIdle = debounce(
    sendBlocksIfAny,
    MOUSE_IDLE_MS
  );

  // ---------------- triggers ----------------

  new MutationObserver(() =>
    debouncedScrapeOnMutation()
  ).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener(
    "scroll",
    () => debouncedScrapeOnScroll(),
    { passive: true }
  );

  window.addEventListener(
    "mousemove",
    () => debouncedScrapeOnMouseIdle(),
    { passive: true }
  );

  window.addEventListener("load", () =>
    setTimeout(sendBlocksIfAny, 500)
  );

  if (document.readyState === "complete") {
    setTimeout(sendBlocksIfAny, 500);
  }

  // ---------------- popup ----------------

  const HOST_ID = "dagent-popup-host";

  function ensureHost() {
    let host = document.getElementById(HOST_ID);

    if (host) {
      return host.shadowRoot;
    }

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.all = "initial";

    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({
      mode: "open",
    });

    const style = document.createElement("style");

    style.textContent = `
      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 340px;
        padding: 14px 34px 14px 16px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        color: #fff;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        z-index: 2147483647;
        opacity: 0;
        transform: translateY(12px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .toast.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .toast.flagged {
        background: #A32D2D;
      }

      .toast.partial {
        background: #B5651D;
      }

      .toast.clean {
        background: #3B6D11;
      }

      .toast .cat {
        display: inline-block;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 11px;
        margin-bottom: 4px;
        opacity: 0.9;
      }

      .toast .text {
        font-weight: 400;
      }

      .toast .conf {
        display: block;
        margin-top: 6px;
        font-size: 11px;
        opacity: 0.8;
      }

      .toast-close {
        position: absolute;
        top: 6px;
        right: 8px;
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.75);
        font-size: 15px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .toast-close:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.15);
      }
    `;

    shadow.appendChild(style);

    const toastEl = document.createElement("div");
    toastEl.className = "toast";

    shadow.appendChild(toastEl);

    return shadow;
  }

  let cycleTimer = null;
  let queue = [];

  function closeToastNow() {
    if (cycleTimer) {
      clearTimeout(cycleTimer);
    }

    queue = [];
    hideToast();
  }

  function renderToast(item) {
    const shadow = ensureHost();
    const toastEl = shadow.querySelector(".toast");

    toastEl.classList.remove(
      "visible",
      "flagged",
      "partial",
      "clean"
    );

    toastEl.innerHTML = "";

    if (item.flagged) {
      const isPartial =
        item.displayColor === "orange";

      toastEl.classList.add(
        isPartial ? "partial" : "flagged"
      );

      const cat = document.createElement("span");
      cat.className = "cat";

      cat.textContent = isPartial
        ? `${item.category} (unconfirmed)`
        : item.category;

      const text = document.createElement("span");
      text.className = "text";
      text.textContent = `"${item.sentence}"`;

      const conf = document.createElement("span");
      conf.className = "conf";
      conf.textContent =
        `Confidence: ${Math.round(
          item.confidence * 100
        )}%`;

      toastEl.appendChild(cat);
      toastEl.appendChild(
        document.createElement("br")
      );
      toastEl.appendChild(text);
      toastEl.appendChild(conf);

      if (item.llmReasoning) {
        const reasoning =
          document.createElement("span");

        reasoning.className = "conf";
        reasoning.style.display = "block";
        reasoning.style.marginTop = "2px";
        reasoning.textContent = item.llmReasoning;

        toastEl.appendChild(reasoning);
      }
    } else {
      toastEl.classList.add("clean");

      const text = document.createElement("span");
      text.className = "text";
      text.textContent =
        "No dark pattern detected";

      toastEl.appendChild(text);
    }

    const closeBtn =
      document.createElement("button");

    closeBtn.className = "toast-close";
    closeBtn.setAttribute(
      "aria-label",
      "Close"
    );
    closeBtn.textContent = "\u00d7";

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeToastNow();
    });

    toastEl.appendChild(closeBtn);

    requestAnimationFrame(() =>
      toastEl.classList.add("visible")
    );
  }

  function hideToast() {
    const shadow = ensureHost();
    const toastEl =
      shadow.querySelector(".toast");

    toastEl.classList.remove("visible");
  }

  function showNext() {
    if (cycleTimer) {
      clearTimeout(cycleTimer);
    }

    if (queue.length === 0) {
      hideToast();
      return;
    }

    const item = queue.shift();

    renderToast(item);

    cycleTimer = setTimeout(
      showNext,
      TOAST_DISPLAY_MS
    );
  }

  function presentResults(results) {
    const flaggedItems = [];
    let sawAnyBlock = false;

    for (const r of results) {
      sawAnyBlock = true;

      if (
        r.detections &&
        r.detections.length > 0
      ) {
        for (const d of r.detections) {
          flaggedItems.push({
            flagged: true,
            sentence: d.sentence,
            category: d.category,
            confidence: d.confidence,
            displayColor:
              d.display_color || "red",
            llmReasoning:
              d.llm_reasoning || null,
          });
        }
      }
    }

    if (!sawAnyBlock) {
      return;
    }

    queue =
      flaggedItems.length > 0
        ? flaggedItems
        : [{ flagged: false }];

    showNext();
  }

  // ---------------- response handling ----------------

  chrome.runtime.onMessage.addListener(
    (message) => {
      if (message.type === "SCAN_RESULT") {
        const elapsed = lastSentAt
          ? Math.round(
              performance.now() -
              lastSentAt
            )
          : null;

        console.debug(
          `[Dagent] result received${
            elapsed !== null
              ? ` — round trip ${elapsed}ms`
              : ""
          }`,
          message.results
        );

        for (const r of message.results) {
          const hash = hashText(
            r.source_text.trim()
          );

          inFlight.delete(hash);

          classifiedCache.set(
            hash,
            r.detections || []
          );

          lastShownAt.set(
            hash,
            Date.now()
          );
        }

        presentResults(message.results);
      } else if (
        message.type === "SCAN_ERROR"
      ) {
        console.debug(
          "[Dagent] backend unreachable:",
          message.error
        );
      }
    }
  );
})();