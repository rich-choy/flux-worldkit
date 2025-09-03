import React from 'react'

interface ZoomPanControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onPanUp: () => void
  onPanDown: () => void
  onPanLeft: () => void
  onPanRight: () => void
  onResetView: () => void
}

export const ZoomPanControls: React.FC<ZoomPanControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onPanUp,
  onPanDown,
  onPanLeft,
  onPanRight,
  onResetView
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2">
      {/* Zoom Controls */}
      <div className="bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={onZoomIn}
          className="block w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright border-b border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="mx-auto">
            <path d="M10 2a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V3a1 1 0 011-1z" />
          </svg>
        </button>
        <button
          onClick={onZoomOut}
          className="block w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="mx-auto">
            <path d="M3 9a1 1 0 000 2h14a1 1 0 100-2H3z" />
          </svg>
        </button>
      </div>

      {/* Pan Controls */}
      <div className="bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-3 grid-rows-3 w-30 h-30">
          {/* Top row */}
          <div></div>
          <button
            onClick={onPanUp}
            className="w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright border-b border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
            title="Pan Up"
            aria-label="Pan Up"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mx-auto">
              <path d="M8 1.5a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.793V2a.5.5 0 01.5-.5z" transform="rotate(180 8 8)" />
            </svg>
          </button>
          <div></div>

          {/* Middle row */}
          <button
            onClick={onPanLeft}
            className="w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright border-r border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
            title="Pan Left"
            aria-label="Pan Left"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mx-auto">
              <path d="M8 1.5a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.793V2a.5.5 0 01.5-.5z" transform="rotate(90 8 8)" />
            </svg>
          </button>
          <button
            onClick={onResetView}
            className="w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright border-r border-b border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center"
            title="Reset View"
            aria-label="Reset View"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z" />
              <path d="M8 1.5a.5.5 0 01.5.5v4a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708L8 2.707V1.5z" />
            </svg>
          </button>
          <button
            onClick={onPanRight}
            className="w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright border-b border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
            title="Pan Right"
            aria-label="Pan Right"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mx-auto">
              <path d="M8 1.5a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.793V2a.5.5 0 01.5-.5z" transform="rotate(-90 8 8)" />
            </svg>
          </button>

          {/* Bottom row */}
          <div></div>
          <button
            onClick={onPanDown}
            className="w-10 h-10 bg-surface hover:bg-surface-bright text-text hover:text-text-bright transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent"
            title="Pan Down"
            aria-label="Pan Down"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mx-auto">
              <path d="M8 1.5a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.793V2a.5.5 0 01.5-.5z" />
            </svg>
          </button>
          <div></div>
        </div>
      </div>

      {/* Zoom Level Indicator */}
      <div className="bg-surface border border-border rounded-lg px-3 py-1 text-xs text-text-dim text-center shadow-lg">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}
