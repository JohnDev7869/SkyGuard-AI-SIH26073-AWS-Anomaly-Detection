import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Top-Level Error Boundary to prevent blank screen
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical Root UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: 'var(--color-text-primary)',
          background: 'var(--color-bg)',
          minHeight: '100vh',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h2 style={{ color: 'var(--color-status-critical)', margin: '0 0 16px 0' }}>SkyGuard AI — UI Initialization Error</h2>
          <div style={{ padding: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '20px' }}>
            <code>{this.state.error?.stack || this.state.error?.toString()}</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: 'var(--color-action-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Hard Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
)
