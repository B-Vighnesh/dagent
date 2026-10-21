import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { scanSlides } from '../data/content.js';

const SLIDE_MS = 3600;
const REVEAL_MS = 950;

const VERDICT_GLYPH = {
  danger: 'x',
  warning: '!',
  success: 'o',
};

export default function ScanPreview() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const revealTimer = useRef(null);
  const advanceTimer = useRef(null);

  const slide = scanSlides[index];

  useEffect(() => {
    setRevealed(false);
    clearTimeout(revealTimer.current);
    clearTimeout(advanceTimer.current);

    revealTimer.current = setTimeout(() => setRevealed(true), REVEAL_MS);
    advanceTimer.current = setTimeout(() => {
      setIndex((current) => (current + 1) % scanSlides.length);
    }, SLIDE_MS);

    return () => {
      clearTimeout(revealTimer.current);
      clearTimeout(advanceTimer.current);
    };
  }, [index]);

  function goTo(nextIndex) {
    setIndex((nextIndex + scanSlides.length) % scanSlides.length);
  }

  return (
    <div className="hero-card">
      <div className="card-top">
        <span className="mono">SCAN PREVIEW</span>
      </div>

            <div className="browser" key={index}>
        <div className="browser-bar slide-fade">
            <i /><i /><i />
            <span>{slide.url}</span>
        </div>

        <div className="browser-body slide-fade">
            <p className="fake-title">{slide.title}</p>
            <div className="fake-line w75" />
            <div className="fake-line w40" />

            <div className={`inspect-box${revealed ? ` tone-${slide.tone}` : ''}`}>
            <span className="mono">{slide.category}</span>
            <p>&ldquo;{slide.quote}&rdquo;</p>
            </div>
        </div>
        </div>

        <div className={`scan-phase${revealed ? ' is-revealed' : ''}`}>
        <div className="scan-result scanning">
            <div>
            <b>Scanning page&hellip;</b>
            <div className="scan-progress-track">
                <div className="scan-progress-fill" key={index} />
            </div>
            </div>
        </div>

        <div className={`scan-result revealed tone-${slide.tone}`}>
            <span>{VERDICT_GLYPH[slide.tone]}</span>
            <div>
            <b>{slide.verdict}</b>
            <small>{slide.stage} &mdash; {slide.note}</small>
            </div>
            <Icon>-&gt;</Icon>
        </div>
        </div>

      <div className="scan-nav">
        <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous example">
          &lsaquo;
        </button>
        <div className="scan-dots">
          {scanSlides.map((item, dotIndex) => (
            <button
              key={item.url}
              type="button"
              className={dotIndex === index ? 'active' : ''}
              aria-label={`Show ${item.category.toLowerCase()} example`}
              onClick={() => goTo(dotIndex)}
            />
          ))}
        </div>
        <button type="button" onClick={() => goTo(index + 1)} aria-label="Next example">
          &rsaquo;
        </button>
      </div>
    </div>
  );
}