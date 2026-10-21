// content.js
(function() {
  // Very lightweight: grabs visible text
  function getVisibleText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // skip scripts/styles/hidden
        const style = window.getComputedStyle(parent);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, iframe')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    let out = '';
    while (node = walker.nextNode()) {
      out += ' ' + node.nodeValue.trim();
      if (out.length > 20000) break; // cap
    }
    return out.slice(0, 20000);
  }

  // Send page text to background for quick analysis
  const text = getVisibleText();
  chrome.runtime.sendMessage({ type: 'PAGE_TEXT', text });
})();
