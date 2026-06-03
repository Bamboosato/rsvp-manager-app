type SectionMetric = {
  label: string;
  value: number | string;
};

export function AdminSectionMetrics({ metrics }: { metrics: SectionMetric[] }) {
  return (
    <div className="section-metrics" aria-label="集計">
      {metrics.map((metric) => (
        <span className="section-metric-badge" key={metric.label}>
          <span>{metric.label} </span>
          <strong>{metric.value}</strong>
        </span>
      ))}
    </div>
  );
}
