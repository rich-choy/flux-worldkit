// Priority Task Scheduling API service for world generation

// TypeScript types for Priority Task Scheduling API
declare global {
  interface Window {
    scheduler?: {
      postTask: (callback: () => void, options?: { priority?: 'user-blocking' | 'user-visible' | 'background' }) => void
    }
  }
}

export interface TaskPriority {
  priority: 'user-blocking' | 'user-visible' | 'background'
}

export interface WorldGenerationTask {
  id: string
  config: any // Use any for now to avoid module system issues
  priority: TaskPriority['priority']
  generationType?: 'regular' | 'lichtenberg'  // Add generation type option
  onSuccess: (world: any) => void
  onError: (error: string) => void
  onProgress?: (progress: number) => void
}

class TaskScheduler {
  private activeTasks = new Map<string, WorldGenerationTask>()
  private taskQueue: WorldGenerationTask[] = []
  private isProcessing = false

  constructor() {
    console.log('Task scheduler: Initialized with Priority Task Scheduling API')
  }

  private async processNextTask() {
    if (this.isProcessing || this.taskQueue.length === 0) return

    this.isProcessing = true

    // Sort by priority: user-blocking > user-visible > background
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { 'user-blocking': 0, 'user-visible': 1, 'background': 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    const task = this.taskQueue.shift()!
    this.activeTasks.set(task.id, task)

    // Use Priority Task Scheduling API if available
    if (window.scheduler?.postTask) {
      try {
        window.scheduler.postTask(() => {
          this.executeTask(task)
        }, { priority: task.priority })
      } catch (error) {
        console.warn('Priority Task Scheduling API error, falling back:', error)
        this.executeTask(task)
      }
    } else {
      // Fallback to setTimeout with priority-based delays
      const delayMap = {
        'user-blocking': 0,
        'user-visible': 0,
        'background': 16 // ~1 frame delay for background tasks
      }

      setTimeout(() => {
        this.executeTask(task)
      }, delayMap[task.priority])
    }
  }

  private async executeTask(task: WorldGenerationTask) {
    // Execute on main thread with Priority Task Scheduling API and yielding
    await this.executeTaskOnMainThread(task)
  }

  private async executeTaskOnMainThread(task: WorldGenerationTask) {
    try {
      console.log('Executing task on main thread with yielding')

      // Import the generation functions
      const { generateLichtenbergWorld } = await import('~/lib/flux-wrapper')

      // Execute with yielding to prevent blocking
      await this.yieldToMainThread()

      // Always use river delta generation (pizza slices are deprecated)
      const world = await generateLichtenbergWorld(task.config)

      // Yield again before calling success callback
      await this.yieldToMainThread()
      task.onSuccess(world)
    } catch (error) {
      task.onError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      this.activeTasks.delete(task.id)
      this.isProcessing = false
      this.processNextTask()
    }
  }

  private yieldToMainThread(): Promise<void> {
    return new Promise(resolve => {
      if (window.scheduler?.postTask) {
        window.scheduler.postTask(resolve, { priority: 'user-visible' })
      } else {
        setTimeout(resolve, 0)
      }
    })
  }

  public scheduleWorldGeneration(task: Omit<WorldGenerationTask, 'id'>): string {
    const taskId = `world-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const fullTask: WorldGenerationTask = { ...task, id: taskId }

    this.taskQueue.push(fullTask)

    // Process immediately if not already processing
    if (!this.isProcessing) {
      this.processNextTask()
    }

    return taskId
  }

  public cancelTask(taskId: string): boolean {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId)
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1)
      return true
    }

    // If it's an active task, we can't really cancel it once started
    // but we can remove it from tracking
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.delete(taskId)
      return true
    }

    return false
  }

  public getActiveTaskCount(): number {
    return this.activeTasks.size
  }

  public getQueuedTaskCount(): number {
    return this.taskQueue.length
  }

  public isWorkerAvailable(): boolean {
    return true // Always available since we use Priority Task Scheduling API
  }

  public destroy() {
    // Cancel all active tasks
    for (const [, task] of this.activeTasks) {
      task.onError('Task scheduler destroyed')
    }
    this.activeTasks.clear()
    this.taskQueue.length = 0
  }
}

// Global task scheduler instance
export const taskScheduler = new TaskScheduler()

// Utility function for easy world generation scheduling (always Lichtenberg)
export function scheduleWorldGeneration(
  config: any,
  options: {
    priority?: TaskPriority['priority']
    onSuccess: (world: any) => void
    onError: (error: string) => void
    onProgress?: (progress: number) => void
  }
): string {
  return taskScheduler.scheduleWorldGeneration({
    config,
    priority: options.priority || 'user-visible',
    generationType: 'lichtenberg',
    onSuccess: options.onSuccess,
    onError: options.onError,
    onProgress: options.onProgress
  })
}
