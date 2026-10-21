import Icon from './Icon.jsx';

export default function FindingCard({ finding }) {
  return (
    <article className={`finding ${finding.tone}`}>
      <div className="finding-type">
        <span>!</span>
        <div>
          <p>{finding.type}</p>
          <h3>{finding.title}</h3>
        </div>
        <b>{finding.confidence}</b>
      </div>
      <p>{finding.detail}</p>
      <button type="button">Why was this flagged? <Icon>v</Icon></button>
    </article>
  );
}
