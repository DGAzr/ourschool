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

import React, { useState } from 'react'
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface ThemeToggleProps {
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  showLabel = false, 
  size = 'md', 
  className = '' 
}) => {
  const { theme, effectiveTheme, setTheme, systemPrefersDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const getThemeIcon = (themeType: string, isEffective = false) => {
    const iconClass = iconSizes[size]
    
    switch (themeType) {
      case 'light':
        return <Sun className={iconClass} />
      case 'dark':
        return <Moon className={iconClass} />
      case 'system':
        return <Monitor className={iconClass} />
      default:
        return isEffective 
          ? (effectiveTheme === 'dark' ? <Moon className={iconClass} /> : <Sun className={iconClass} />)
          : <Monitor className={iconClass} />
    }
  }

  const getThemeLabel = (themeType: string) => {
    switch (themeType) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      case 'system':
        return `System ${systemPrefersDark ? '(Dark)' : '(Light)'}`
      default:
        return 'System'
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: 'light' },
    { value: 'dark', label: 'Dark', icon: 'dark' },
    { value: 'system', label: `System ${systemPrefersDark ? '(Dark)' : '(Light)'}`, icon: 'system' }
  ]

  // Simple button toggle (cycles through options)
  const SimpleToggle = () => (
    <button
      onClick={() => {
        if (theme === 'light') setTheme('dark')
        else if (theme === 'dark') setTheme('system')
        else setTheme('light')
      }}
      className={`
        inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 
        dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
        transition-all duration-200 ${sizeClasses[size]} ${className}
      `}
      title={`Current theme: ${getThemeLabel(theme)}`}
    >
      {getThemeIcon(theme)}
      {showLabel && (
        <span className="ml-2 text-gray-700 dark:text-gray-200 font-medium">
          {getThemeLabel(theme)}
        </span>
      )}
    </button>
  )

  // Dropdown toggle (shows all options)
  const DropdownToggle = () => (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 
          dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
          transition-all duration-200 ${sizeClasses[size]} ${className}
        `}
      >
        {getThemeIcon(theme)}
        {showLabel && (
          <span className="ml-2 text-gray-700 dark:text-gray-200 font-medium">
            {getThemeLabel(theme)}
          </span>
        )}
        <ChevronDown className={`ml-1 h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
            <div className="py-1">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value as 'light' | 'dark' | 'system')
                    setIsOpen(false)
                  }}
                  className={`
                    group flex w-full items-center px-4 py-2 text-sm transition-colors
                    ${theme === option.value 
                      ? 'bg-blue-50 text-blue-900 dark:bg-blue-900 dark:text-blue-100' 
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {getThemeIcon(option.icon)}
                  <span className="ml-3">{option.label}</span>
                  {theme === option.value && (
                    <svg className="ml-auto h-4 w-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )

  // Return dropdown if label is shown, otherwise simple toggle
  return showLabel ? <DropdownToggle /> : <SimpleToggle />
}

export default ThemeToggle