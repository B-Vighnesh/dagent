import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../components/Layout.jsx';
import case1 from '../assets/case1.webp';
import case2 from '../assets/case2.avif';
import case3 from '../assets/case3.avif';
import case4 from '../assets/case4.jpg';
import case6 from '../assets/case6.jpg';
import case7 from '../assets/case7.avif';
import case10 from '../assets/case10.jpg';
import case14 from '../assets/case14.jpg';
import case15 from '../assets/case15.jpg';
import case16 from '../assets/case16.webp';
import case19 from '../assets/case19.png';
/*
 * Simple, hardcoded, dwell-based scan simulation:
 *  - Every 1000ms after scrolling stops, find whichever block is closest
 *    to the center of the viewport ("what the user is currently looking at").
 *  - If that block is different from the one last shown, pop its
 *    (hardcoded) verdict.
 *  - The toast is rendered through a portal straight into document.body,
 *    so its `position: fixed` is always relative to the real viewport —
 *    not to <main>, which has a CSS transform on it (page-transition
 *    animation) that would otherwise turn "fixed" into "stuck to the top
 *    of the page content" instead of "stuck to the screen".
 *
 * Images: each block's `image` field points at /images/<image>. Drop the
 * matching case1.png ... case20.png files in the public/images folder —
 * if a file is missing, ImagePlaceholder quietly falls back to a plain
 * gray box showing the filename instead of a broken image icon.
 */

const SETTLE_MS = 1000;
const AUTO_DISMISS_MS = 4500;

const BLOCKS = [
  {
    id: 'hero-scarcity',
    image: case1,
    eyebrow: 'FEATURED PRODUCT',
    title: 'Wireless Bluetooth Earbuds',
    price: '₹1,499',
    body: 'Studio-grade sound with 20-hour battery life and soft padded ear cushions.',
    banner: 'In Stock only 3 left',
    finding: {
      category: 'SCARCITY',
      sentence: 'In Stock only 3 left',
      confidence: 0.96,
      displayColor: 'red',
      llmReasoning: "Stock counter isn't tied to any verified inventory data on the page.",
    },
  },
  {
    id: 'countdown-urgency',
    image: case2,
    eyebrow: 'MEGA SALE DAYS',
    title: 'Today only — up to 40% off',
    body: 'Prices return to normal once the timer below reaches zero.',
    banner: 'HURRY! EXCLUSIVE DEAL FOR YOU! Offer ends in 40:55:13',
    finding: {
      category: 'URGENCY',
      sentence: 'HURRY! EXCLUSIVE DEAL FOR YOU! Offer ends in 40:55:13',
      confidence: 0.95,
      displayColor: 'red',
      llmReasoning: 'Countdown resets on page refresh — the deadline is not real.',
    },
  },
  {
    id: 'shipping-clean',
    image: case3,
    eyebrow: 'DELIVERY & RETURNS',
    title: 'Order with confidence',
    body: 'Standard delivery in 3–5 business days across India. Cash on Delivery available.',
    banner: 'Free delivery on orders over ₹499. Easy 7-day returns, no questions asked.',
    finding: null,
  },
  {
    id: 'viewers-social',
    image: case4,
    eyebrow: 'LIVE ACTIVITY',
    title: "You're not the only one looking",
    body: 'This item has been popular this week.',
    banner: '9 people from Bengaluru viewed this in the last hour',
    finding: {
      category: 'SOCIAL PROOF',
      sentence: '9 people from Bengaluru viewed this in the last hour',
      confidence: 0.89,
      displayColor: 'orange',
      llmReasoning: 'Could be a real analytics widget or a static placeholder — inconclusive from page content alone.',
    },
  },
  {
    id: 'newsletter-misdirect',
    eyebrow: 'BEFORE YOU GO',
    title: 'Save 15% on your first order',
    body: 'Join the list for early access to sales and new arrivals.',
    choice: { accept: 'Yes, save my spot', decline: "I don't want to save money" },
    finding: {
      category: 'MISDIRECTION',
      sentence: "I don't want to save money",
      confidence: 0.92,
      displayColor: 'red',
      llmReasoning: 'The decline option uses guilt-based language instead of a neutral opt-out.',
    },
  },
  {
    id: 'basket-social2',
    image: case6,
    eyebrow: 'CUSTOMER FAVORITE',
    title: 'Handcrafted Copper Water Bottle',
    price: '₹899',
    body: 'Pure copper build, holds 1 litre, traditional design.',
    banner: '1,142 people have added to cart recently',
    finding: {
      category: 'SOCIAL PROOF',
      sentence: '1,142 people have added to cart recently',
      confidence: 0.93,
      displayColor: 'red',
      llmReasoning: 'This counter cannot be verified and commonly resets arbitrarily on shopping templates.',
    },
  },
  {
    id: 'checkout-sneak',
    image: case7,
    eyebrow: 'CHECKOUT',
    title: 'Review your order',
    body: 'A platform fee has already been added for you below.',
    extras: ['Platform Fee — ₹49 — Remove Fee', 'Delivery Protection added'],
    finding: {
      category: 'SNEAKING',
      sentence: 'Platform Fee ₹49 Remove Fee',
      confidence: 0.97,
      displayColor: 'red',
      llmReasoning: 'An extra charge is opted in by default instead of being disclosed upfront.',
    },
  },
  {
    id: 'reviews',
    eyebrow: 'CUSTOMER REVIEWS',
    title: '4.8 out of 5 — 1,204 ratings',
    body: 'Read what other customers thought before you buy.',
    banner: 'Write a review',
    finding: {
      category: 'SOCIAL PROOF',
      sentence: '4.8 out of 5 — 1,204 ratings',
      confidence: 0.9,
      displayColor: 'red',
      llmReasoning: 'Displays high ratings and prompts reading reviews to influence buying, a classic social proof dark pattern.',
    },
  },
  {
    id: 'cancel-obstruct',
    eyebrow: 'ACCOUNT',
    title: 'Manage your membership',
    body: 'Your premium membership renews automatically each month.',
    banner: 'To cancel your order before it ships, call our support line at 1800-123-4567 (Mon–Fri, 10am–6pm).',
    finding: {
      category: 'OBSTRUCTION',
      sentence: 'To cancel your order before it ships, call our support line at 1800-123-4567 (Mon–Fri, 10am–6pm).',
      confidence: 0.9,
      displayColor: 'red',
      llmReasoning: 'Signing up takes one click; cancelling requires calling a support line during limited hours.',
    },
  },
  {
    id: 'stock-scarcity2',
    image: case10,
    eyebrow: 'BACK IN STOCK',
    title: 'Handwoven Cotton Tote Bag',
    price: '₹1,199',
    body: 'Undyed cotton canvas with reinforced jute handles, handwoven using traditional techniques.',
    banner: 'ONLY 8 LEFT',
    finding: {
      category: 'SCARCITY',
      sentence: 'ONLY 8 LEFT',
      confidence: 0.87,
      displayColor: 'orange',
      llmReasoning: 'Matches scarcity phrasing, but this inventory figure may reflect genuine stock levels.',
    },
  },
  {
    id: 'forced-account',
    eyebrow: 'CHECKOUT',
    title: 'Almost there',
    body: 'Complete a quick step to continue to payment.',
    banner: 'Create a free account to view your final price and taxes.',
    finding: {
      category: 'FORCED ACTION',
      sentence: 'Create a free account to view your final price and taxes.',
      confidence: 0.93,
      displayColor: 'red',
      llmReasoning: 'Requires account creation before revealing pricing, blocking easy price comparison.',
    },
  },
  {
    id: 'obstruction-menu',
    eyebrow: 'SETTINGS',
    title: 'Subscription settings',
    body: 'Manage your recurring plan below.',
    banner: 'To cancel: Settings → Account → Membership → Advanced → Cancel Plan.',
    finding: {
      category: 'OBSTRUCTION',
      sentence: 'To cancel: Settings → Account → Membership → Advanced → Cancel Plan.',
      confidence: 0.88,
      displayColor: 'red',
      llmReasoning: 'Cancellation requires navigating multiple nested menus compared to one-click signup.',
    },
  },
  {
    id: 'sneak-consent',
    eyebrow: 'STAY IN TOUCH',
    title: 'Get updates from us',
    body: 'We like to keep our customers in the loop.',
    banner: 'By continuing, you agree to receive promotional emails and SMS. (Pre-selected — uncheck to opt out.)',
    finding: {
      category: 'SNEAKING',
      sentence: 'By continuing, you agree to receive promotional emails and SMS.',
      confidence: 0.91,
      displayColor: 'red',
      llmReasoning: 'Marketing consent is pre-selected rather than requiring an active opt-in.',
    },
  },
  {
    id: 'misdirect-discount',
    image: case14,
    eyebrow: 'SPECIAL OFFER',
    title: 'Unlock 20% off your order',
    body: 'This offer is only shown once.',
    choice: { accept: 'Claim my discount', decline: 'No thanks, I like paying full price' },
    finding: {
      category: 'MISDIRECTION',
      sentence: 'No thanks, I like paying full price',
      confidence: 0.9,
      displayColor: 'red',
      llmReasoning: 'The decline option is worded to make the neutral choice feel foolish rather than neutral.',
    },
  },
  {
    id: 'urgency-priceup',
    image: case15,
    eyebrow: 'LIMITED WINDOW',
    title: 'Lock in this price',
    body: "This rate won't be shown again after the timer ends.",
    banner: 'Price increases to full amount in 00:10:00 — lock in this rate now.',
    finding: {
      category: 'URGENCY',
      sentence: 'Price increases to full amount in 00:10:00 — lock in this rate now.',
      confidence: 0.94,
      displayColor: 'red',
      llmReasoning: 'No indication of why or how the price would genuinely increase on a fixed timer.',
    },
  },
  {
    id: 'scarcity-price-tier',
    image: case16,
    eyebrow: 'PRICING',
    title: 'Introductory pricing',
    body: 'Early units are offered at a reduced rate.',
    banner: 'Only 1 left at this price!',
    finding: {
      category: 'SCARCITY',
      sentence: 'Only 1 left at this price!',
      confidence: 0.85,
      displayColor: 'orange',
      llmReasoning: 'Wording is consistent with real limited-time pricing tiers as well as manufactured scarcity.',
    },
  },
  {
    id: 'trending-social',
    eyebrow: 'TRENDING',
    title: "What everyone's buying",
    body: 'A quick look at what other shoppers are choosing right now.',
    banner: 'Trending now — bought by 500+ shoppers today',
    finding: {
      category: 'SOCIAL PROOF',
      sentence: 'Trending now — bought by 500+ shoppers today',
      confidence: 0.88,
      displayColor: 'orange',
      llmReasoning: 'Trending claim is not tied to a visible or verifiable sales counter.',
    },
  },
  {
    id: 'size-guide-clean',
    eyebrow: 'SIZE GUIDE',
    title: 'Find your fit',
    body: 'Refer to the chart below before choosing a size.',
    banner: 'All measurements are in centimetres.',
    finding: null,
  },
  {
    id: 'warranty-clean',
    image: case19,
    eyebrow: 'WARRANTY',
    title: '1-year manufacturer warranty included',
    body: 'Covers manufacturing defects. Register your product within 30 days of purchase.',
    banner: 'Warranty registration is optional and does not affect your legal rights.',
    finding: null,
  },
  {
    id: 'unsub-obstruct',
    eyebrow: 'EMAIL PREFERENCES',
    title: 'Manage your subscriptions',
    body: 'Update what you hear from us.',
    banner: 'To unsubscribe, please re-enter your account password to confirm.',
    finding: {
      category: 'OBSTRUCTION',
      sentence: 'To unsubscribe, please re-enter your account password to confirm.',
      confidence: 0.84,
      displayColor: 'orange',
      llmReasoning: 'Adds an unnecessary authentication step to a simple preference change.',
    },
  },
];

function ImagePlaceholder({ src }) {
  if (!src) return null;

  return (
    <div className="dg-imgph">
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '10px'
        }}
      />
    </div>
  );
}


function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function Toast({ item, onClose }) {
  if (!item) return null;

  const node = !item.flagged ? (
    <div className="dg-toast dg-clean">
      <span className="dg-text">No dark pattern detected</span>
      <button type="button" className="dg-toast-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
    </div>
  ) : (
    <div className={`dg-toast ${item.displayColor === 'orange' ? 'dg-partial' : 'dg-flagged'}`}>
      <span className="dg-cat">
        {item.displayColor === 'orange' ? `${item.category} (unconfirmed)` : item.category}
      </span>
      <br />
      <span className="dg-text">&ldquo;{item.sentence}&rdquo;</span>
      <span className="dg-conf">Confidence: {Math.round(item.confidence * 100)}%</span>
      {item.llmReasoning && (
        <span className="dg-conf" style={{ display: 'block', marginTop: 2 }}>
          {item.llmReasoning}
        </span>
      )}
      <button type="button" className="dg-toast-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
    </div>
  );

  // Portal straight to <body> so `position: fixed` is relative to the real
  // viewport, not to any transformed ancestor (e.g. <main>'s page-transition).
  return createPortal(node, document.body);
}

export default function ScanPage() {
  const [toast, setToast] = useState(null);
  const nodeRefs = useRef({});
  const lastShownIdRef = useRef(null);
  const dismissTimerRef = useRef(null);

  function getActiveBlock() {
    let best = null;
    let bestDistance = Infinity;
    const viewportCenter = window.innerHeight / 2;

    BLOCKS.forEach((block) => {
      const el = nodeRefs.current[block.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return; // not on screen at all

      const blockCenter = rect.top + rect.height / 2;
      const distance = Math.abs(blockCenter - viewportCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = block;
      }
    });

    return best;
  }

  function showToastFor(block) {
    lastShownIdRef.current = block.id;
    const payload = block.finding ? { flagged: true, ...block.finding } : { flagged: false };
    setToast(payload);

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }

  function handleSettled() {
    const block = getActiveBlock();
    if (!block) return;
    if (block.id === lastShownIdRef.current) return; // already shown for this block
    showToastFor(block);
  }

  function closeToastNow() {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setToast(null);
  }

  useEffect(() => {
    const debouncedSettle = debounce(handleSettled, SETTLE_MS);
    window.addEventListener('scroll', debouncedSettle, { passive: true });

    const initial = window.setTimeout(handleSettled, 700);

    return () => {
      window.removeEventListener('scroll', debouncedSettle);
      window.clearTimeout(initial);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <style>{`
        .dg-scan-intro{padding:64px 0 40px;text-align:center}
        .dg-scan-intro .shell{max-width:640px;margin:0 auto}
        .dg-segment{min-height:82vh;display:flex;align-items:center;justify-content:center;border-top:1px dashed #e0e8e8}
        .dg-segment:first-of-type{border-top:none}
        .dg-segment .shell{max-width:820px;width:100%;margin:0 auto;padding:0 40px;box-sizing:border-box}
        .dg-eyebrow-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .dg-index-tag{font:500 10px 'DM Mono',monospace;color:#93a3a4}
        .dg-segment h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(22px,3vw,30px);margin:0 0 10px;letter-spacing:-.01em}
        .dg-segment .dg-body-text{color:#5b6969;font-size:14.5px;line-height:1.65;max-width:480px;margin:0 0 22px}
        .dg-imgph{width:100%;max-width:280px;aspect-ratio:1/1;border-radius:10px;margin:0 0 22px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:repeating-linear-gradient(135deg,#eef3f3,#eef3f3 10px,#e4ebeb 10px,#e4ebeb 20px);border:1px solid #dde5e5}
        .dg-imgph span{font:600 11px 'DM Mono',monospace;color:#9aabab;letter-spacing:.08em}
        .dg-price{font-family:'Space Grotesk',sans-serif;font-size:18px;color:#00666e;margin:-6px 0 16px}
        .dg-banner{display:inline-block;background:#fff;border:1px solid #dde5e5;border-radius:7px;padding:10px 16px;font-size:13.5px;font-weight:600;color:#242e2f}
        .dg-choice{display:flex;gap:10px;flex-wrap:wrap}
        .dg-choice button{border-radius:7px;padding:11px 18px;font-size:13px;font-weight:600;cursor:default;border:1px solid transparent}
        .dg-choice .accept{background:#00666e;color:#fff}
        .dg-choice .decline{background:none;border-color:#d6e1e1;color:#7c8a8a}
        .dg-extras{list-style:none;margin:0;padding:0;display:grid;gap:10px;max-width:420px}
        .dg-extras li{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #dde5e5;border-radius:7px;padding:11px 14px;font-size:13px}
        .dg-extras li b{font-size:11px;color:#00666e;cursor:default;font-weight:600;white-space:nowrap}

        .dg-content-row{display:flex;align-items:flex-start;gap:36px}
        .dg-content-row .dg-imgph{flex:0 0 260px;width:260px;margin:0}
        .dg-content-col{flex:1;min-width:0}

        .dg-toast{position:fixed;top:20px;right:20px;max-width:560px;padding:14px 34px 14px 16px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.5;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;animation:dgToastIn .2s ease both}
        @keyframes dgToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .dg-flagged{background:#A32D2D}
        .dg-partial{background:#B5651D}
        .dg-clean{background:#3B6D11}
        .dg-cat{display:inline-block;font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:11px;margin-bottom:4px;opacity:.9}
        .dg-text{font-weight:400}
        .dg-conf{display:block;margin-top:6px;font-size:11px;opacity:.8}
        .dg-toast-close{position:absolute;top:6px;right:8px;width:20px;height:20px;border:none;background:transparent;color:rgba(255,255,255,.75);font-size:15px;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;border-radius:4px}
        .dg-toast-close:hover{color:#fff;background:rgba(255,255,255,.15)}

        @media(max-width:760px){
          .dg-toast{left:16px;right:16px;top:16px;max-width:none}
          .dg-segment{min-height:70vh}
          .dg-content-row{flex-direction:column}
          .dg-content-row .dg-imgph{width:100%;max-width:280px}
        }
      `}</style>

      <section className="dg-scan-intro">
        <div className="shell">
          <p className="eyebrow">SCAN PREVIEW</p>
          <h1>Scroll to watch DAGENT work.</h1>
          <p className="lead">
            This is a simulated shopping page. Pause on any section for a moment and DAGENT
            scans it — just like the real extension — and shows a popup right on your screen.
          </p>
        </div>
      </section>

      {BLOCKS.map((block, index) => (
        <section
          key={block.id}
          className="dg-segment"
          ref={(node) => {
            nodeRefs.current[block.id] = node;
          }}
        >
          <div className="shell">
            <div className="dg-eyebrow-row">
              <p className="eyebrow" style={{ margin: 0 }}>{block.eyebrow}</p>
              <span className="dg-index-tag">SEGMENT {index + 1} / {BLOCKS.length}</span>
            </div>

            <div className="dg-content-row">
              {block.image && <ImagePlaceholder src={block.image} />}

              <div className="dg-content-col">
                <h2>{block.title}</h2>
                {block.price && <p className="dg-price">{block.price}</p>}
                <p className="dg-body-text">{block.body}</p>

                {block.banner && <div className="dg-banner">{block.banner}</div>}

                {block.choice && (
                  <div className="dg-choice">
                    <button type="button" className="accept">{block.choice.accept}</button>
                    <button type="button" className="decline">{block.choice.decline}</button>
                  </div>
                )}

                {block.extras && (
                  <ul className="dg-extras">
                    {block.extras.map((extra) => {
                      const [label, action] = extra.split(' — ');
                      return (
                        <li key={extra}>
                          <span>{label}</span>
                          {action && <b>{action}</b>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      <Toast item={toast} onClose={closeToastNow} />
    </Layout>
  );
}