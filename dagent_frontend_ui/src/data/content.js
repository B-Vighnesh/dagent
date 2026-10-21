export const about = {
  eyebrow: 'ABOUT DARK PATTERNS',
  title: 'What is a dark pattern?',
  lead:
    'A dark pattern is a design choice that steers people into actions they may not have chosen freely, such as subscribing, overspending, or sharing personal data. These tactics can be hard to spot because they often look like ordinary interface copy.',
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
      body: 'Some tactics use recognizable language, which makes text classification a useful first step. Dagent explores how a tool could help people notice them.',
    },
  ],
  solution: {
    eyebrow: 'HOW DAGENT SOLVES IT',
    title: 'A browser tool that points out copy worth a second look.',
    body: 'Dagent is a product concept with a simulated website demo and local extension and API prototypes. The hosted model is not deployed, so the live scan shown here uses prepared examples.',
  },
};

export const pipeline = [
  {
    stage: 'CAPTURE',
    title: 'The extension prototype reads visible text',
    body: 'The local browser extension prototype collects visible page text, such as headings and paragraphs, while you browse.',
    tone: 'neutral',
  },
  {
    stage: 'STAGE 1',
    title: 'Stage 1: candidate or not?',
    body: 'A fine-tuned DistilBERT classifier checks each sentence for signs of a dark pattern. In the prototype, this runs through a local API when model files are available.',
    tone: 'neutral',
    outcome: {
      label: 'Not a dark pattern',
      popup: 'green',
      note: 'Sentences below the configured threshold move no further.',
    },
  },
  {
    stage: 'STAGE 2',
    title: 'Stage 2: predict a category',
    body: 'A second DistilBERT classifier assigns a likely category to sentences flagged by Stage 1. Predictions can be wrong, especially for rare categories.',
    tone: 'neutral',
    branches: [
      { label: 'Scarcity or urgency', popup: 'red', note: 'Low-stock messages and countdowns are common examples.' },
      { label: 'Social proof', popup: 'orange', note: 'Claims about how many people are viewing an item.' },
      { label: 'Other trained categories', popup: 'green', note: 'Misdirection, obstruction, sneaking, and forced action.' },
    ],
  },
];

export const roadmap = {
  eyebrow: 'WHAT’S NEXT',
  title: 'The goal: detection that stays on your device.',
  body: 'The trained models are too large and costly to host, and a hosted service would receive page text. Dagent is not deployed as a live detector. The next step is to make the models small enough to run locally in the browser, for example with ONNX.',
};

export const projectStatus = [
  { label: 'Website demo', title: 'Prepared examples, not a live scan', body: 'The Scan page is a simulated shopping experience. Its alerts are built into the site and are not generated from the page you are browsing.' },
  { label: 'Local prototype', title: 'An extension and API are available to explore', body: 'The browser extension can send visible text to a FastAPI service on your own machine. The API needs model files and is separate from this website demo.' },
  { label: 'Not hosted', title: 'No public detection service', body: 'The trained models are large and there is no funding to host them. A public service would also conflict with the goal of keeping page text on the user’s device.' },
];

export const unfinishedWork = [
  {
    label: 'Not built',
    title: 'On-device model',
    body: 'The DistilBERT models have not been exported to ONNX or integrated into the browser. Shrinking and running them locally is the main product goal.',
  },
  {
    label: 'Not ready to ship',
    title: 'A standalone extension',
    body: 'The current extension prototype depends on a separately run API and large model files. A ready-to-install release that works without manual backend setup does not exist yet.',
  },
  {
    label: 'Needs work',
    title: 'Privacy hardening',
    body: 'Before release, the prototype still needs tighter local API access and cleanup of debug output and remote host permissions.',
  },
  {
    label: 'More data needed',
    title: 'Reliable rare-category detection',
    body: 'The dataset has only 27 Obstruction, 12 Sneaking, and 4 Forced Action examples. Predictions for these classes need more labelled examples and evaluation.',
  },
];

export const privacyPrinciples = [
  { title: 'Keep page text local', body: 'The product goal is to run text collection and model inference on the user’s own device, without sending browsing content to a server.' },
  { title: 'No hosted AI in the product', body: 'The API contains an experimental Groq review option, but it sends flagged sentences to a third party. It is not part of the intended product and should remain disabled.' },
  { title: 'Store as little as possible', body: 'The design aims to keep results in the browser and clear them with the page or tab, with no telemetry or server-side history.' },
];

export const datasetFacts = [
  ['2,356', 'labelled text examples'],
  ['1,248', 'source pages'],
  ['7', 'pattern categories'],
];

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
  {
    number: '07',
    title: 'Forced Action',
    tone: 'purple',
    context: 'Signup & checkout',
    definition: 'Making an account, sharing data, or taking another step a condition for continuing.',
    examples: [
      'Create an account to continue checkout.',
      'Enter your email to see the price.',
    ],
  },
];

export const steps = [
  ['01', 'Try the website demo', 'Scroll through a sample shopping page and see prepared examples of possible dark patterns.'],
  ['02', 'Explore the prototype', 'The extension and API can be run locally with the downloaded model files. They are separate from this website demo.'],
  ['03', 'Help shape what comes next', 'The long-term plan is a smaller on-device model that can analyze text without sending it to a hosted service.'],
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



