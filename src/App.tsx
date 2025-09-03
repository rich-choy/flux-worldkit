import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { AppHeader } from '~/components/AppHeader';
import { WorldGenTool } from '~/tools/worldgen/WorldGenTool';
import { CombatSandboxTool } from '~/tools/combat/CombatSandboxTool';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container h-screen flex flex-col">
        <AppHeader />
        <ErrorBoundary>
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/worldgen" replace />} />
              <Route path="/worldgen" element={<WorldGenTool />} />
              <Route path="/combat" element={<CombatSandboxTool />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

export default App;
