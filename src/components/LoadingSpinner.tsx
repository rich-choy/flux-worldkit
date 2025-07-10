import React, { useState, useEffect } from 'react'
import { taskScheduler } from '~/lib/task-scheduler'

export const LoadingSpinner: React.FC = () => {
  const [taskInfo, setTaskInfo] = useState({
    activeCount: 0,
    queuedCount: 0,
    isWorkerAvailable: false
  })

  useEffect(() => {
    const updateTaskInfo = () => {
      setTaskInfo({
        activeCount: taskScheduler.getActiveTaskCount(),
        queuedCount: taskScheduler.getQueuedTaskCount(),
        isWorkerAvailable: taskScheduler.isWorkerAvailable()
      })
    }

    // Update immediately
    updateTaskInfo()

    // Update every 100ms while loading
    const interval = setInterval(updateTaskInfo, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        className="flex flex-col items-center justify-center bg-surface/95 backdrop-blur-sm border border-border rounded-lg p-8 shadow-lg"
        style={{
          transform: 'translateY(-18.2vh)' // Position at golden ratio: 50% - 18.2% = 31.8% from top
        }}
      >
        {/* Spinner */}
        <div className="relative mb-4">
          <div className="w-12 h-12 border-4 border-text-dim/30 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-accent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>

        {/* Message */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-text-bright mb-1">Generating World</h3>
          <p className="text-sm text-text-dim">Creating your fractal trail network...</p>
        </div>

        {/* Task Information */}
        <div className="text-center text-xs text-text-dim space-y-1">
          <div className="flex items-center justify-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${taskInfo.isWorkerAvailable ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>
              {taskInfo.isWorkerAvailable ? 'Web Worker (Non-blocking)' : 'Main Thread (Optimized)'}
            </span>
          </div>

          {(taskInfo.activeCount > 0 || taskInfo.queuedCount > 0) && (
            <div className="text-text-dim">
              {taskInfo.activeCount > 0 && `Active: ${taskInfo.activeCount}`}
              {taskInfo.activeCount > 0 && taskInfo.queuedCount > 0 && ' • '}
              {taskInfo.queuedCount > 0 && `Queued: ${taskInfo.queuedCount}`}
            </div>
          )}

          <div className="text-text-dim/70">
            Using Priority Task Scheduling API
          </div>
        </div>
      </div>
    </div>
  )
}
