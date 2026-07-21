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

import { config } from '../config/env'
import { api } from './api'
import type { StudentPoints } from './points'
import type {
  RedeemResponse,
  ShopAdminOverview,
  ShopCategory,
  ShopItem,
  ShopRedemption,
} from '../types/shop'

export interface ShopCategoryInput {
  name: string
  color?: string
  icon?: string | null
  sort_order?: number
}

export interface ShopItemInput {
  name: string
  category_id: number
  description?: string | null
  cost_points: number
  quantity_available: number | null
  fulfillment_type: 'instant' | 'request'
  is_active?: boolean
  image_ids?: string[]
}

export const shopApi = {
  // Categories
  getCategories: (): Promise<ShopCategory[]> => api.get('/shop/categories'),
  createCategory: (data: ShopCategoryInput): Promise<ShopCategory> =>
    api.post('/shop/categories', data),
  updateCategory: (id: number, data: Partial<ShopCategoryInput>): Promise<ShopCategory> =>
    api.put(`/shop/categories/${id}`, data),
  deleteCategory: (id: number): Promise<{ message: string }> =>
    api.delete(`/shop/categories/${id}`),

  // Items
  getItems: (categoryId?: number): Promise<ShopItem[]> =>
    api.get(
      categoryId != null ? `/shop/items?category_id=${categoryId}` : '/shop/items'
    ),
  getItem: (id: number): Promise<ShopItem> => api.get(`/shop/items/${id}`),
  createItem: (data: ShopItemInput): Promise<ShopItem> => api.post('/shop/items', data),
  updateItem: (id: number, data: Partial<ShopItemInput>): Promise<ShopItem> =>
    api.put(`/shop/items/${id}`, data),
  setItemActive: (id: number, isActive: boolean): Promise<ShopItem> =>
    api.patch(`/shop/items/${id}`, { is_active: isActive }),
  deleteItem: (id: number): Promise<{ message: string }> =>
    api.delete(`/shop/items/${id}`),
  /** Set the storefront order from a full ordered list of item ids. */
  reorderItems: (ids: number[]): Promise<ShopItem[]> =>
    api.put('/shop/items/reorder', { item_ids: ids }),

  // Redemptions
  redeem: (itemId: number): Promise<RedeemResponse> =>
    api.post('/shop/redeem', { item_id: itemId }),
  /** Set (or clear, with null) the item the student is saving toward. */
  setMyGoal: (itemId: number | null): Promise<StudentPoints> =>
    api.put('/shop/my-goal', { item_id: itemId }),
  getMyRedemptions: (): Promise<ShopRedemption[]> => api.get('/shop/my-redemptions'),
  getRedemptions: (status: 'pending' | 'ready' | 'history'): Promise<ShopRedemption[]> =>
    api.get(`/shop/redemptions?status=${status}`),
  approveRedemption: (id: number): Promise<ShopRedemption> =>
    api.post(`/shop/redemptions/${id}/approve`, {}),
  declineRedemption: (id: number): Promise<ShopRedemption> =>
    api.post(`/shop/redemptions/${id}/decline`, {}),
  fulfillRedemption: (id: number): Promise<ShopRedemption> =>
    api.post(`/shop/redemptions/${id}/fulfill`, {}),

  // Admin overview
  getAdminOverview: (): Promise<ShopAdminOverview> => api.get('/shop/admin/overview'),

  // Images
  uploadImage: (file: File): Promise<{ id: string; url: string }> => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm('/shop/images', form)
  },
  /** Absolute URL for an image by its external id (plain <img src>). */
  imageUrl: (imageId: string): string =>
    `${config.api.baseUrl}/shop/images/${imageId}`,
}
