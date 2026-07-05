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

import { createContext, useContext } from 'react'

export interface ToastContextValue {
  toast: (message: string, variant?: 'default' | 'danger') => void
}

/** Raw context — consumed by ToastProvider; use useToast() everywhere else. */
export const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export const useToast = () => useContext(ToastContext)
