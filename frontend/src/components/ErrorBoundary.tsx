/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  /** Fallback component to render when error occurs */
  fallback?: ReactNode
  /** Callback function called when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Whether to show detailed error information (for development) */
  showDetails?: boolean
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing.
 * 
 * Features:
 * - Catches and handles component errors gracefully
 * - Displays user-friendly error messages
 * - Provides retry functionality
 * - Optional detailed error information for debugging
 * - Customizable fallback UI
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 w-20 h-20 mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Something went wrong
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred while loading this component. 
              You can try refreshing the page or contact support if the problem persists.
            </p>

            {/* Retry Button */}
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>

            {/* Detailed Error Information (Development Only) */}
            {this.props.showDetails && this.state.error && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  Show error details (development only)
                </summary>
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono text-left overflow-auto">
                  <div className="text-red-600 dark:text-red-400 font-bold mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <>
                      <div className="text-red-600 dark:text-red-400 font-bold mt-4 mb-2">
                        Component Stack:
                      </div>
                      <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary