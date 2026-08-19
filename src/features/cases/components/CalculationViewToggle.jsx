export default function CalculationViewToggle({ detailed, onChange }) {
  return (
    <section className="calculation-view-toggle" aria-label="Calculation detail level">
      <div>
        <strong>{detailed ? 'Detailed audit view' : 'Simple view'}</strong>
        <span>{detailed ? 'Rule IDs, reason codes and provenance are visible.' : 'Plain-language results with technical codes hidden.'}</span>
      </div>
      <div>
        <button type="button" aria-pressed={!detailed} className={!detailed ? 'selected' : ''} onClick={() => onChange(false)}>Simple</button>
        <button type="button" aria-pressed={detailed} className={detailed ? 'selected' : ''} onClick={() => onChange(true)}>Detailed audit</button>
      </div>
    </section>
  )
}
