import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    try { localStorage.clear(); } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', fontFamily: "'DM Sans', sans-serif", color: '#fafafa' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <details style={{ marginBottom: '1.5rem', color: '#a1a1aa' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error details</summary>
            <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', background: '#09090b', padding: '1rem', borderRadius: '8px', border: '1px solid #27272a' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Reset data and reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
