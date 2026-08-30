import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: 'rgba(255, 45, 85, 0.1)',
          border: '1px solid rgba(255, 45, 85, 0.3)',
          borderRadius: '8px',
          color: 'var(--text-main)',
          margin: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'var(--accent-red)', marginTop: 0 }}>Component Render Issue</h3>
          <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              background: 'var(--card-bg)',
              color: 'var(--accent-cyan)',
              border: '1px solid var(--panel-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Reload Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
