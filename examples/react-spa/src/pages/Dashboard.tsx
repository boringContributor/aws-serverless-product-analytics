import { useState } from 'react';
import { track } from '@analytics/tracker';
import './Pages.css';

export function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const handleMetricClick = (metric: string) => {
    setSelectedMetric(metric);
    track('metric_viewed', {
      metric,
      page: 'dashboard',
      timestamp: new Date().toISOString(),
    });
  };

  const metrics = [
    { id: 'users', label: 'Total Users', value: '1,234' },
    { id: 'sessions', label: 'Active Sessions', value: '567' },
    { id: 'pageviews', label: 'Page Views', value: '8,901' },
    { id: 'events', label: 'Custom Events', value: '2,345' },
  ];

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <p className="subtitle">
        View your analytics metrics and interact with them to track events.
      </p>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={`metric-card ${selectedMetric === metric.id ? 'selected' : ''}`}
            onClick={() => handleMetricClick(metric.id)}
          >
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
          </div>
        ))}
      </div>

      {selectedMetric && (
        <div className="card">
          <h2>Selected Metric</h2>
          <p>
            You selected: <strong>{metrics.find((m) => m.id === selectedMetric)?.label}</strong>
          </p>
          <p className="info-text">
            This interaction was tracked as a custom event. Check your browser console!
          </p>
        </div>
      )}

      <div className="card">
        <h2>📈 Chart Interactions</h2>
        <div className="button-group">
          <button
            onClick={() => track('chart_filtered', { filter: 'last-7-days', page: 'dashboard' })}
            className="btn btn-secondary"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => track('chart_filtered', { filter: 'last-30-days', page: 'dashboard' })}
            className="btn btn-secondary"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => track('chart_exported', { format: 'csv', page: 'dashboard' })}
            className="btn btn-primary"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
