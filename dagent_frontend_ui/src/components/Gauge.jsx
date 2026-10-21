export default function Gauge({ score }) {
  return (
    <div className="gauge" aria-label={`Deception score: ${score} out of 100`}>
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path d="M10 60 A50 50 0 0 1 110 60" />
        <path className="meter" d="M10 60 A50 50 0 0 1 110 60" />
      </svg>
      <b>{score}</b>
      <span>/100</span>
    </div>
  );
}
