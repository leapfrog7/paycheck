import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('PayCheck could not render the current screen.', error, info)
  }

  returnHome = () => {
    window.location.assign('/')
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-error" role="alert">
        <div className="app-error__card">
          <span className="app-error__icon" aria-hidden="true">!</span>
          <p className="app-error__eyebrow">Your saved work is safe</p>
          <h1>This screen could not be displayed</h1>
          <p>PayCheck stores your cases in this browser. Return to your calculations or reload this screen and try again.</p>
          <div className="app-error__actions">
            <button type="button" className="primary-action" onClick={this.returnHome}>Return to calculations</button>
            <button type="button" className="secondary-action" onClick={this.reload}>Reload this page</button>
          </div>
          {import.meta.env.DEV ? (
            <details>
              <summary>Development details</summary>
              <pre>{this.state.error?.stack ?? String(this.state.error)}</pre>
            </details>
          ) : null}
        </div>
      </main>
    )
  }
}
