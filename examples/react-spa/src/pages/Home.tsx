import { track } from '@analytics/tracker';
import './Pages.css';

export function Home() {
  const handleButtonClick = (buttonId: string) => {
    track('button_clicked', {
      buttonId,
      page: 'home',
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="page">
      <h1>Welcome to Analytics Demo</h1>
      <p className="subtitle">
        This is a React SPA example demonstrating automatic analytics tracking with React Router.
      </p>

      <div className="card">
        <h2>🚀 Features</h2>
        <ul>
          <li>Automatic page view tracking on route changes</li>
          <li>JWT-based authentication (no anonymous tracking)</li>
          <li>Web Vitals monitoring (LCP, FID, CLS, TTFB)</li>
          <li>Custom event tracking</li>
          <li>TypeScript support</li>
        </ul>
      </div>

      <div className="card">
        <h2>📊 Try It Out</h2>
        <p>Click the buttons below to track custom events:</p>
        <div className="button-group">
          <button onClick={() => handleButtonClick('cta-primary')} className="btn btn-primary">
            Primary CTA
          </button>
          <button onClick={() => handleButtonClick('cta-secondary')} className="btn btn-secondary">
            Secondary CTA
          </button>
          <button onClick={() => handleButtonClick('cta-tertiary')} className="btn btn-tertiary">
            Tertiary CTA
          </button>
        </div>
        <p className="info-text">
          Open your browser console to see the tracked events (debug mode is enabled).
        </p>
      </div>

      <div className="card">
        <h2>🧭 Navigation</h2>
        <p>
          Use the navigation menu above to switch between pages. Each route change will automatically
          trigger a page view event.
        </p>
      </div>
    </div>
  );
}
