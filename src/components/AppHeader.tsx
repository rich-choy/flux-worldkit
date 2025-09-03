import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export const AppHeader: React.FC = () => {
  const location = useLocation();

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-semibold text-white">Worldkit Tools</h1>
          <nav className="flex space-x-1">
            <NavLink
              to="/worldgen"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive || location.pathname === '/'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              World Generation
            </NavLink>
            <NavLink
              to="/combat"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              Combat Sandbox
            </NavLink>
          </nav>
        </div>

        <div className="text-sm text-gray-400">
          {location.pathname === '/' || location.pathname === '/worldgen'
            ? 'Generate and analyze procedural worlds'
            : 'Physics-based tactical combat simulation'
          }
        </div>
      </div>
    </header>
  );
};
