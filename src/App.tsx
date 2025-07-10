// Import components
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {

  return (
    <ErrorBoundary>
      <div className="app-container">
        <div className="main-content">
          <div className="view-container">
            <h1>Hello World</h1>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
