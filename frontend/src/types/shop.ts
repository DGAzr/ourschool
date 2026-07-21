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

import type { StudentPoints } from '../services/points'

export interface ShopCategory {
  id: number
  external_id: string
  name: string
  color: string
  icon?: string | null
  sort_order: number
  created_at: string
  item_count?: number | null
}

export type FulfillmentType = 'instant' | 'request'

export type RedemptionStatus =
  | 'redeemed'
  | 'pending'
  | 'ready'
  | 'fulfilled'
  | 'declined'

export interface ShopItem {
  id: number
  external_id: string
  name: string
  category_id: number
  description?: string | null
  cost_points: number
  quantity_available: number | null
  fulfillment_type: FulfillmentType
  is_active: boolean
  image_ids: string[]
  total_redeemed: number
  display_order: number
  created_at: string
  updated_at: string
  category?: ShopCategory | null
}

export interface ShopRedemption {
  id: number
  external_id: string
  student_id: number
  item_id: number | null
  item_name: string
  cost_points: number
  fulfillment_type: FulfillmentType
  status: RedemptionStatus
  created_at: string
  decided_at?: string | null
  fulfilled_at?: string | null
  student_name?: string | null
  item?: ShopItem | null
}

export interface StudentGoalSummary {
  student_id: number
  student_name: string
  item_name: string
  cost_points: number
  current_balance: number
  remaining: number
  category_icon?: string | null
  category_color?: string | null
}

export interface ShopAdminOverview {
  pending_redemptions: number
  ready_redemptions: number
  student_goals: StudentGoalSummary[]
}

export interface RedeemResponse {
  redemption: ShopRedemption
  student_points: StudentPoints
}
