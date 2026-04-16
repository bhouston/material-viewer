import { useEffect } from 'react'

export interface ViewerTestState {
  consoleErrors: string[]
  uncaughtErrors: string[]
  failedRequests: string[]
}

export const useViewerTestInstrumentation = (enabled: boolean, hydrated: boolean) => {
  useEffect(() => {
    if (!enabled || !hydrated || typeof window === 'undefined') {
      return
    }

    const scopedWindow = window as Window & { __viewerTestState?: ViewerTestState }
    const state: ViewerTestState = {
      consoleErrors: [],
      uncaughtErrors: [],
      failedRequests: [],
    }
    scopedWindow.__viewerTestState = state

    const originalConsoleError = console.error
    const originalFetch = window.fetch.bind(window)
    const stringifyError = (value: unknown): string => {
      if (value instanceof Error) {
        return value.message
      }
      if (typeof value === 'string') {
        return value
      }
      return JSON.stringify(value)
    }

    console.error = (...args: unknown[]) => {
      state.consoleErrors.push(args.map((arg) => stringifyError(arg)).join(' '))
      originalConsoleError(...args)
    }

    const handleError = (event: ErrorEvent) => {
      state.uncaughtErrors.push(event.message || stringifyError(event.error))
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      state.uncaughtErrors.push(`Unhandled rejection: ${stringifyError(event.reason)}`)
    }

    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      try {
        const response = await originalFetch(...args)
        if (!response.ok) {
          state.failedRequests.push(`${response.status} ${String(args[0])}`)
        }
        return response
      } catch (error) {
        state.failedRequests.push(`network-error ${String(args[0])}: ${stringifyError(error)}`)
        throw error
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      console.error = originalConsoleError
      window.fetch = originalFetch
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [enabled, hydrated])
}
