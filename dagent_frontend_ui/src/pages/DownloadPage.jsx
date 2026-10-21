import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Layout from '../components/Layout.jsx';
import { supportedBrowsers, steps } from '../data/content.js';

const downloadFeatures = [
  {
    title: 'Runs in the background',
    body: 'DAGENT reads the page you are already on and only speaks up when something looks off. No manual scanning required.',
  },
  {
    title: 'Reasoning, not just a red flag',
    body: 'Every popup comes with plain-language reasoning from the detection pipeline, so you know exactly why a page was flagged.',
  },
  {
    title: 'Built to get smaller',
    body: 'Detection runs on our deployed model today. The roadmap is a lightweight on-device model where page data never leaves your browser.',
  },
];

const trustFacts = [
  ['Free', 'No paid tier'],
  ['No account', 'Nothing to sign up for'],
  ['6', 'Pattern categories detected'],
  ['2-stage', 'Detection pipeline'],
];

const faqs = [
  {
    q: 'Does DAGENT collect my browsing data?',
    a: 'The extension reads the visible content of the page you are on to run detection, the same content you can already see. It does not track your history or browsing activity beyond that page.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Chrome, Edge, and Firefox are supported today. Pick your browser above before downloading.',
  },
  {
    q: 'How does DAGENT decide something is a dark pattern?',
    a: 'Page content first passes a fast classifier. Anything flagged escalates to an LLM reasoning stage that returns a confirmed, partial, or rejected verdict with an explanation attached.',
  },
  {
    q: 'Is this extension ready for everyday use?',
    a: 'DAGENT is under active development. Expect the detection dataset and accuracy to keep improving as more real-world examples are collected.',
  },
];

export default function DownloadPage() {
  const [browser, setBrowser] = useState('Chrome');
  const [notice, setNotice] = useState('');
  
function handleDownload() {
  window.open(
    'https://drive.google.com/drive/folders/1OQwfpfzqWiCtCzNEb-3lv-mvVnykdfqs',
    '_blank'
  );
}

  return (
    <Layout>
      <section className="plain-page">
        <div className="shell center">
          <p className="eyebrow">BROWSER EXTENSION</p>
          <h1>Bring clarity to<br /><em>every tab.</em></h1>
          <p className="lead">DAGENT works quietly in the background, surfacing manipulation when it matters.</p>
          <div className="download-card">
            <div className="extension-mark">
              <img src="/dagent_logo.png" alt="Dagent logo" />
            </div>
            <div>
              <span className="mono">DAGENT FOR BROWSERS</span>
              <h2>Dark Pattern Detector</h2>
              <p>Real-time protection while you browse.</p>
            </div>
            <span className="version">v1.0.0</span>
            <div className="browser-picks">
              {supportedBrowsers.map((item) => (
                <button type="button" className={browser === item ? 'picked' : ''} onClick={() => setBrowser(item)} key={item}>
                  {item}
                </button>
              ))}
            </div>
            <button type="button" className="button primary wide" onClick={handleDownload}>
              Download for {browser} 
            </button>
            <small>{notice || 'Free · No account required · Privacy-first'}</small>
          </div>

          <div className="trust-strip">
            {trustFacts.map(([value, label]) => (
              <div key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="section muted">
        <div className="shell">
          <p className="eyebrow">GOOD TO KNOW</p>
          <h2>Questions before you install.</h2>
          <div className="faq">
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q} <Icon>v</Icon>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      
    </Layout>
  );
}