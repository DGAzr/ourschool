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

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ShoppingBag } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { usePointsStatus } from '../contexts/PointsStatusContext'
import { getErrorMessage } from '../services/api'
import { pointsApi, type StudentPoints } from '../services/points'
import { shopApi } from '../services/shop'
import type {
  RedeemResponse,
  ShopCategory,
  ShopItem,
  ShopRedemption,
} from '../types/shop'
import { EmptyState } from '../components/ui'
import { BalanceCard } from '../components/shop/BalanceCard'
import { GoalCard } from '../components/shop/GoalCard'
import { CategoryChips } from '../components/shop/CategoryChips'
import { ItemGrid } from '../components/shop/ItemGrid'
import { ItemDetail } from '../components/shop/ItemDetail'
import { MyRedemptions } from '../components/shop/MyRedemptions'
import { RedeemModal } from '../components/shop/RedeemModal'
import { goalItem, lockedItems } from '../components/shop/shopLogic'

type Tab = 'shop' | 'orders'

const Shop: React.FC = () => {
  const { user } = useAuth()
  const { enabled, ready, notifyBalanceChanged } = usePointsStatus()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [items, setItems] = useState<ShopItem[]>([])
  const [points, setPoints] = useState<StudentPoints | null>(null)
  const [redemptions, setRedemptions] = useState<ShopRedemption[]>([])

  const [tab, setTab] = useState<Tab>('shop')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [goalItemId, setGoalItemId] = useState<number | null>(null)
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null)

  const load = useCallback(() => {
    if (!user || user.role !== 'student' || !ready || !enabled) return
    Promise.all([
      shopApi.getCategories(),
      shopApi.getItems(),
      pointsApi.getMyBalance(),
      shopApi.getMyRedemptions(),
    ])
      .then(([cats, its, bal, reds]) => {
        setError(null)
        setCategories(cats)
        setItems(its)
        setPoints(bal)
        setRedemptions(reds)
        // Seed the chosen goal from the persisted value.
        setGoalItemId(bal.goal_item_id ?? null)
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load the shop')))
      .finally(() => setLoading(false))
  }, [user, ready, enabled])

  useEffect(() => {
    load()
  }, [load])

  const balance = points?.current_balance ?? 0

  // Active items only (backend already filters for students, but be defensive).
  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items])

  // Category active-item counts.
  const counts = useMemo(() => {
    const map: Record<number, number> = {}
    for (const item of activeItems) {
      map[item.category_id] = (map[item.category_id] ?? 0) + 1
    }
    return map
  }, [activeItems])

  const visibleItems = useMemo(
    () =>
      selectedCategoryId == null
        ? activeItems
        : activeItems.filter((i) => i.category_id === selectedCategoryId),
    [activeItems, selectedCategoryId]
  )

  // Locked items, cheapest first — for the goal card.
  const locked = useMemo(
    () => lockedItems(activeItems, balance),
    [activeItems, balance]
  )

  // Goal = the chosen locked item if still locked, else the cheapest locked one.
  const goal = useMemo(() => goalItem(locked, goalItemId), [locked, goalItemId])

  // Explicitly choose a goal item; persist optimistically and revert on failure.
  const setGoal = useCallback((itemId: number) => {
    setGoalItemId((prev) => {
      shopApi.setMyGoal(itemId).catch(() => setGoalItemId(prev))
      return itemId
    })
  }, [])

  const selectedItem = useMemo(
    () => activeItems.find((i) => i.id === selectedItemId) ?? null,
    [activeItems, selectedItemId]
  )

  const applyRedeem = useCallback(
    (result: RedeemResponse) => {
      setPoints(result.student_points)
      notifyBalanceChanged()
      // Decrement stock locally for limited items.
      const soldItemId = result.redemption.item_id
      if (soldItemId != null) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === soldItemId && i.quantity_available !== null
              ? { ...i, quantity_available: Math.max(0, i.quantity_available - 1) }
              : i
          )
        )
      }
      // Refresh redemptions in the background.
      shopApi.getMyRedemptions().then(setRedemptions).catch(() => undefined)
    },
    [notifyBalanceChanged]
  )

  if (!user || user.role !== 'student') {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Students only"
        subtext="Only students can browse the Points Shop."
      />
    )
  }

  // Disabled is decided by the provider, so it never waits on the data load.
  if (ready && !enabled) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Points Shop unavailable"
        subtext="The points system is currently disabled by your administrator."
      />
    )
  }

  if (!ready || loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-12">
        <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Something went wrong"
        subtext={error ?? ''}
      />
    )
  }

  // Badge counts only orders that are still in flight (awaiting approval or
  // ready for pickup), not the student's lifetime order history.
  const pendingCount = redemptions.filter(
    (r) => r.status === 'pending' || r.status === 'ready'
  ).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em]">
            Points Shop
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Spend your points on rewards — save toward a goal and redeem.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-pill bg-panel-2 border border-line">
          <button
            onClick={() => {
              setTab('shop')
              setSelectedItemId(null)
            }}
            className={`h-8 px-3.5 rounded-pill text-[13px] font-medium transition-colors ${
              tab === 'shop' ? 'bg-panel text-ink shadow-card' : 'text-muted'
            }`}
          >
            Shop
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`h-8 px-3.5 rounded-pill text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 ${
              tab === 'orders' ? 'bg-panel text-ink shadow-card' : 'text-muted'
            }`}
          >
            My redemptions
            {pendingCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 rounded-pill bg-track text-muted">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === 'orders' ? (
        <MyRedemptions
          redemptions={redemptions}
          totalSpent={points?.total_spent ?? 0}
        />
      ) : selectedItem ? (
        <ItemDetail
          item={selectedItem}
          balance={balance}
          isGoal={goal?.id === selectedItem.id}
          onBack={() => setSelectedItemId(null)}
          onRedeem={setConfirmItem}
          onSetGoal={setGoal}
        />
      ) : (
        <>
          {/* Balance + Goal */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4 mb-6">
            {points && <BalanceCard points={points} />}
            {goal ? (
              <GoalCard
                goal={goal}
                balance={balance}
                lockedItems={locked}
                onSelect={setGoal}
              />
            ) : (
              <div
                className="rounded-card-lg bg-panel border flex items-center justify-center text-center p-5"
                style={{ borderColor: 'var(--accent-line)' }}
              >
                <p className="text-[13px] text-muted">
                  🎉 You can afford everything in the shop right now!
                </p>
              </div>
            )}
          </div>

          {/* Category chips */}
          <div className="mb-[18px]">
            <CategoryChips
              categories={categories}
              counts={counts}
              totalCount={activeItems.length}
              selectedCategoryId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
          </div>

          {/* Item grid */}
          <ItemGrid
            items={visibleItems}
            balance={balance}
            onOpen={(item) => setSelectedItemId(item.id)}
            onRedeem={setConfirmItem}
          />
        </>
      )}

      <RedeemModal
        item={confirmItem}
        balance={balance}
        onClose={() => setConfirmItem(null)}
        onRedeemed={applyRedeem}
        onViewRedemptions={() => {
          setConfirmItem(null)
          setSelectedItemId(null)
          setTab('orders')
        }}
      />
    </div>
  )
}

export default Shop
