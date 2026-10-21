export const about = {
  eyebrow: 'ABOUT DARK PATTERNS',
  title: 'What is a dark pattern?',
  lead:
    'A dark pattern is a user interface deliberately designed to trick you into doing something you did not mean to do such as subscribing, overspending, or handing over data you would rather keep private. They exploit how people actually read and decide, not how the business claims the product works.',
  points: [
    {
      title: 'It looks like normal design',
      body: 'Dark patterns rarely look malicious. They borrow the same buttons, colors, and copy as honest interfaces, which is exactly what makes them hard to spot in the moment.',
    },
    {
      title: 'It relies on pressure or confusion',
      body: 'Whether it is a fake countdown, a guilt-tripping opt-out, or a maze of cancellation steps, the pattern works by narrowing your options or rushing your decision.',
    },
    {
      title: 'It is measurable',
      body: 'Because these tactics follow recognizable structures, they can be detected systematically. This is the problem DAGENT is built to solve.',
    },
  ],
  solution: {
    eyebrow: 'HOW DAGENT SOLVES IT',
    title: 'A browser extension that reasons before it warns you.',
    body: 'DAGENT is a browser extension. Once installed, it reads the page you are actually looking at, sends what it finds through a two-stage detection pipeline, and hands you a verdict.',
  },
};

export const pipeline = [
  {
    stage: 'CAPTURE',
    title: 'The extension scrapes the live page',
    body: 'When you land on a page (or trigger a manual scan), the DAGENT extension reads the visible DOM of that screen such as banners, buttons, timers, opt-outs these are the same content you see, nothing more.',
    tone: 'neutral',
  },
  {
    stage: 'STAGE 1',
    title: 'Fast classifier: dark pattern or not?',
    body: 'The scraped content is sent to our deployed model for a quick binary check. Most page content clears this stage in under a second.',
    tone: 'neutral',
    outcome: {
      label: 'Not a dark pattern',
      popup: 'green',
      note: 'Green popup shown to the user in under 1 second. Nothing else happens.',
    },
  },
  {
    stage: 'STAGE 2',
    title: 'LLM reasoning engine',
    body: 'Anything flagged in Stage 1 is escalated to an LLM that reviews it in context and reaches one of three verdicts, each with plain-language reasoning attached.',
    tone: 'neutral',
    branches: [
      {
        label: 'Confirmed dark pattern',
        popup: 'red',
        note: 'Red popup with the LLM\u2019s reasoning for why it qualifies.',
      },
      {
        label: 'Partially dark pattern',
        popup: 'orange',
        note: 'Orange popup with reasoning explaining the ambiguity.',
      },
      {
        label: 'Rejected by the LLM',
        popup: 'green',
        note: 'The LLM overturns Stage 1 then green popup, no alert shown.',
      },
    ],
  },
];

export const roadmap = {
  eyebrow: 'WHAT\u2019S NEXT',
  title: 'Going fully offline.',
  body: 'Right now, detection runs on our deployed model so we can stay accurate while the dataset grows. The long-term goal is a lightweight model that runs entirely on your device where no page data ever leaving your browser. Getting there means training on more real-world examples first, which is what this dataset is for.',
};

export const patternTypes = [
  {
    number: '01',
    title: 'Scarcity',
    tone: 'red',
    context: 'Shopping apps',
    definition: 'Stock counters and "only X left" warnings, often unrelated to real inventory.',
    examples: [
      'Hurry! Only 2 left at this price!',
      'Only 16 Left in Stock!',
    ],
  },
  {
    number: '02',
    title: 'Urgency',
    tone: 'orange',
    context: 'Shopping apps',
    definition: 'Countdown timers and expiring deals designed to rush a decision.',
    examples: [
      'DEAL ENDS IN 40:55:13',
      'Your order is reserved for 29:52 minutes!',
    ],
  },
  {
    number: '03',
    title: 'Social proof',
    tone: 'blue',
    context: 'Shopping apps',
    definition: 'Fabricated or exaggerated activity meant to imply high demand.',
    examples: [
      '251 people are viewing this right now',
      'Trending now! Added to basket 38 times today',
    ],
  },
  {
    number: '04',
    title: 'Misdirection',
    tone: 'purple',
    context: 'Shopping & subscription apps',
    definition: 'Confirmshaming copy that guilts you out of the option you actually want.',
    examples: [
      'No thanks, I hate cool stuff',
      'No thanks. I love chaos!',
    ],
  },
  {
    number: '05',
    title: 'Sneaking',
    tone: 'cyan',
    context: 'Subscription apps',
    definition: 'Trials, add-ons, or insurance quietly bundled into checkout by default.',
    examples: [
      'Free 60 day VIP trial membership with this order. Cancel anytime.',
      'Shipping Insurance and Remove Insurance',
    ],
  },
  {
    number: '06',
    title: 'Obstruction',
    tone: 'slate',
    context: 'Subscription apps',
    definition: 'Signing up is one click; canceling is buried behind calls or emails.',
    examples: [
      'You may cancel your VIP membership at any time by calling 1-866-337-0906 (open 24/7).',
      'To cancel your order before it ships, call us.',
    ],
  },
];

export const steps = [
  ['01', 'Install the extension', 'Add DAGENT to your browser once and it runs in the background from then on.'],
  ['02', 'Browse normally', 'The extension reads the page you are on and runs it through the detection pipeline automatically.'],
  ['03', 'Get an instant popup', 'Green means clear, orange means borderline, red means confirmed with the reasoning behind it.'],
];

export const findings = [
  {
    type: 'FALSE URGENCY',
    title: 'Only 2 rooms left at this price!',
    detail: 'The availability warning uses time pressure without evidence that inventory is truly scarce.',
    confidence: '94.8%',
    tone: 'danger',
  },
  {
    type: 'CONFIRMSHAMING',
    title: 'No thanks, I prefer paying full price',
    detail: 'The opt-out wording applies guilt to push newsletter sign-up.',
    confidence: '91.2%',
    tone: 'warning',
  },
  {
    type: 'HIDDEN COSTS',
    title: 'Taxes and service fees appear at checkout',
    detail: 'The price shown early in the journey excludes mandatory fees.',
    confidence: '88.6%',
    tone: 'info',
  },
];
export const scanSlides = [
  {
    url: 'shop.example.com/checkout',
    title: 'Complete your order',
    category: 'SCARCITY',
    quote: 'Hurry! Only 2 left at this price!',
    tone: 'danger',
    stage: 'Stage 2 escalation',
    verdict: 'Confirmed dark pattern',
    note: 'The LLM confirmed this stock warning is not tied to real inventory.',
  },
  {
    url: 'store.example.com/deal',
    title: "Today's flash sale",
    category: 'URGENCY',
    quote: 'DEAL ENDS IN 40:55:13',
    tone: 'danger',
    stage: 'Stage 2 escalation',
    verdict: 'Confirmed dark pattern',
    note: 'A recurring countdown timer designed to rush the decision.',
  },
  {
    url: 'shop.example.com/product',
    title: 'Ceramic table lamp',
    category: 'SOCIAL PROOF',
    quote: '251 people are viewing this right now',
    tone: 'warning',
    stage: 'Stage 2 escalation',
    verdict: 'Partially dark pattern',
    note: 'Likely inflated activity count so flagged but not fully confirmed.',
  },
  {
    url: 'shop.example.com/newsletter',
    title: 'Join our mailing list',
    category: 'MISDIRECTION',
    quote: 'No thanks, I hate cool stuff',
    tone: 'warning',
    stage: 'Stage 2 escalation',
    verdict: 'Partially dark pattern',
    note: 'Confirmshaming language used on the opt-out choice.',
  },
  {
    url: 'app.example.com/checkout',
    title: 'Add to your order',
    category: 'SNEAKING',
    quote: 'Free 60 day VIP trial. Cancel anytime.',
    tone: 'danger',
    stage: 'Stage 2 escalation',
    verdict: 'Confirmed dark pattern',
    note: 'A recurring paid trial bundled into checkout by default.',
  },
  {
    url: 'account.example.com/cancel',
    title: 'Manage membership',
    category: 'OBSTRUCTION',
    quote: 'Cancel any time by calling 1-866-337-0906.',
    tone: 'danger',
    stage: 'Stage 2 escalation',
    verdict: 'Confirmed dark pattern',
    note: 'Sign-up is one click; cancellation requires a phone call.',
  },
  {
    url: 'shop.example.com/returns',
    title: 'Start a return',
    category: 'NO DARK PATTERN',
    quote: 'Start your return below and instructions are emailed right away.',
    tone: 'success',
    stage: 'Stage 1 fast check',
    verdict: 'Cleared instantly',
    note: 'Straightforward process copy and cleared in under a second.',
  },
];
export const supportedBrowsers = ['Chrome', 'Edge', 'Firefox'];