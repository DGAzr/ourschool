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

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ToastItem {
  id: number
  message: string
  variant?: 'default' | 'danger'
}

interface ToastContextValue {
  toast: (message: string, variant?: 'default' | 'danger') => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

let _nextId = 0

const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, variant: 'default' | 'danger' = 'default') => {
    const id = ++_nextId
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

const ToastItem: React.FC<{ item: ToastItem }> = ({ item }) => {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  return (
    <div
      className={[
        'px-4 py-3 rounded-[11px] text-[13px] font-medium pointer-events-auto shadow-float',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        item.variant === 'danger'
          ? 'bg-danger text-white'
          : 'bg-btn-primary-bg text-btn-primary-fg',
      ].join(' ')}
    >
      {item.message}
    </div>
  )
}

export const useToast = () => useContext(ToastContext)

export default ToastProvider
