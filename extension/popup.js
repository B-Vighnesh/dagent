// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const out = document.getElementById("out");
  const btn = document.getElementById("test");

  btn.addEventListener("click", async () => {
    status.textContent = "Running test — fetching active tab text...";
    out.textContent = "";

    // get active tab
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Use chrome.scripting.executeScript to read page text (MV3)
    // The function passed below executes in the context of the page (not inline on the popup),
    // so no CSP issue. It returns the first 2000 characters of the page body text.
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body ? document.body.innerText.slice(0, 2000) : ""
      });

      const pageText = results?.[0]?.result || "";
      status.textContent = "Page text captured — sending to background for analysis...";

      // Send to background which runs the model and returns result
      chrome.runtime.sendMessage({ type: "PAGE_TEXT", text: pageText }, (response) => {
        if (chrome.runtime.lastError) {
          status.textContent = "Error: " + chrome.runtime.lastError.message;
          out.textContent = "";
          return;
        }
        status.textContent = "Response received";
        out.textContent = JSON.stringify(response, null, 2);
      });

    } catch (err) {
      status.textContent = "Script failed: " + String(err);
      out.textContent = "";
      console.error(err);
    }
  });
});
