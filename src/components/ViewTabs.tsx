import React from 'react'
import type { ViewType } from '../App'

interface ViewTabsProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export const ViewTabs: React.FC<ViewTabsProps> = ({ currentView, onViewChange }) => {
  const tabs: { id: ViewType; label: string; icon: string }[] = [
    { id: 'spatial', label: 'Spatial', icon: '🗺️' },
    { id: 'network', label: 'Network', icon: '🕸️' },
    { id: 'analysis', label: 'Analysis', icon: '📊' },
    { id: 'detail', label: 'Detail', icon: '🔍' }
  ]

  return (
    <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-1 flex gap-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
            currentView === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-text-dim hover:text-text-bright hover:bg-surface/50'
          }`}
          onClick={() => onViewChange(tab.id)}
        >
          <span className="text-xs">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
