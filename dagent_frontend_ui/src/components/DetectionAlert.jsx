export default function DetectionAlert({ detection, onClose }) {
  if (!detection) return null;

  const { verdict, category, quote, confidence, reasoning } = detection;

  return (
    <div className={`detection-alert alert-${verdict}`} role="status">
      <div className="detection-alert-head">
        <span>{category}</span>
        <button type="button" onClick={onClose} aria-label="Dismiss">&times;</button>
      </div>
      {quote && <p className="detection-quote">&ldquo;{quote}&rdquo;</p>}
      {typeof confidence === 'number' && <p className="detection-confidence">Confidence: {confidence}%</p>}
      {reasoning && <p className="detection-reason">{reasoning}</p>}
    </div>
  );
}