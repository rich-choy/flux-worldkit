import React from 'react'

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Generating world...</p>
    </div>
  )
}
