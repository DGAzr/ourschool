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
import { useSearchParams } from 'react-router-dom'
import { Plus, Store } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { usePointsStatus } from '../contexts/PointsStatusContext'
import { getErrorMessage } from '../services/api'
import { shopApi } from '../services/shop'
import type {
  ShopAdminOverview,
  ShopCategory,
  ShopItem,
  ShopRedemption,
} from '../types/shop'
import { EmptyState, useToast } from '../components/ui'
import { AdminShopStats } from '../components/shop/admin/AdminShopStats'
import { ItemsTable } from '../components/shop/admin/ItemsTable'
import { ItemEditor } from '../components/shop/admin/ItemEditor'
import {
  RedemptionQueue,
  type QueueTab,
} from '../components/shop/admin/RedemptionQueue'

type Tab = 'items' | 'redemptions'
type Editing = null | { mode: 'new' } | { mode: 'edit'; item: ShopItem }

const AdminShop: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const { enabled, ready: statusReady } = usePointsStatus()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ?tab=redemptions deep-links straight to the queue (Dashboard "Needs you").
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'redemptions' ? 'redemptions' : 'items'
  )
  const [queueTab, setQueueTab] = useState<QueueTab>('pending')
  const [editing, setEditing] = useState<Editing>(null)

  const [items, setItems] = useState<ShopItem[]>([])
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [overview, setOverview] = useState<ShopAdminOverview | null>(null)
  const [redemptions, setRedemptions] = useState<ShopRedemption[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  const refetchOverview = useCallback(() => {
    shopApi.getAdminOverview().then(setOverview).catch(() => undefined)
  }, [])

  const loadCore = useCallback(() => {
    if (!user || user.role !== 'admin' || !statusReady || !enabled) return
    Promise.all([
      shopApi.getItems(),
      shopApi.getCategories(),
      shopApi.getAdminOverview(),
    ])
      .then(([its, cats, ov]) => {
        setError(null)
        setItems(its)
        setCategories(cats)
        setOverview(ov)
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load the shop')))
      .finally(() => setLoading(false))
  }, [user, statusReady, enabled])

  useEffect(() => {
    loadCore()
  }, [loadCore])

  // Load the queue whenever the redemptions tab / sub-tab changes.
  useEffect(() => {
    if (tab !== 'redemptions' || !enabled) return
    shopApi
      .getRedemptions(queueTab)
      .then(setRedemptions)
      .catch((err) => toast(getErrorMessage(err, 'Failed to load requests'), 'danger'))
  }, [tab, queueTab, enabled, toast])

  const refetchItems = useCallback(() => {
    shopApi.getItems().then(setItems).catch(() => undefined)
    refetchOverview()
  }, [refetchOverview])

  const refetchQueue = useCallback(() => {
    shopApi.getRedemptions(queueTab).then(setRedemptions).catch(() => undefined)
    refetchOverview()
  }, [queueTab, refetchOverview])

  const toggleActive = useCallback(
    async (item: ShopItem) => {
      // Optimistic flip.
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      )
      try {
        await shopApi.setItemActive(item.id, !item.is_active)
        refetchOverview()
      } catch (err) {
        // Revert on failure.
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_active: item.is_active } : i
          )
        )
        toast(getErrorMessage(err, 'Could not update visibility'), 'danger')
      }
    },
    [refetchOverview, toast]
  )

  const reorder = useCallback(
    async (orderedIds: number[]) => {
      // Optimistically reorder the local list.
      const previous = items
      const byId = new Map(items.map((i) => [i.id, i]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((i): i is ShopItem => i != null)
      setItems(next)
      try {
        await shopApi.reorderItems(orderedIds)
      } catch (err) {
        setItems(previous)
        toast(getErrorMessage(err, 'Could not reorder items'), 'danger')
      }
    },
    [items, toast]
  )

  const runQueueAction = useCallback(
    async (id: number, action: (id: number) => Promise<unknown>) => {
      setBusyId(id)
      try {
        await action(id)
        refetchQueue()
      } catch (err) {
        toast(getErrorMessage(err, 'Action failed'), 'danger')
      } finally {
        setBusyId(null)
      }
    },
    [refetchQueue, toast]
  )

  const pending = overview?.pending_redemptions ?? 0
  const ready = overview?.ready_redemptions ?? 0

  const subtitle = useMemo(() => {
    if (pending > 0) {
      return `${pending} redemption request${pending === 1 ? '' : 's'} need your approval.`
    }
    return "Everything's approved — the shop's running smoothly."
  }, [pending])

  if (!user || user.role !== 'admin') {
    return (
      <EmptyState
        icon={Store}
        title="Admins only"
        subtext="Only admins can manage the shop."
      />
    )
  }

  // Disabled is decided by the provider, so it never waits on the data load.
  if (statusReady && !enabled) {
    return (
      <EmptyState
        icon={Store}
        title="Points Shop unavailable"
        subtext="Enable the points system in Settings to use the shop."
      />
    )
  }

  if (!statusReady || loading) {
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
        icon={Store}
        title="Something went wrong"
        subtext={error ?? ''}
      />
    )
  }

  // Editor takes over the whole surface (no header/tabs).
  if (editing) {
    return (
      <div>
        <ItemEditor
          item={editing.mode === 'edit' ? editing.item : null}
          categories={categories}
          onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
          onBack={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refetchItems()
          }}
          onDeleted={() => {
            setEditing(null)
            refetchItems()
          }}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em]">
            Points Shop
          </h1>
          <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-pill bg-panel-2 border border-line">
            <button
              onClick={() => setTab('items')}
              className={`h-8 px-3.5 rounded-pill text-[13px] font-medium transition-colors ${
                tab === 'items' ? 'bg-panel text-ink shadow-card' : 'text-muted'
              }`}
            >
              Store items
            </button>
            <button
              onClick={() => setTab('redemptions')}
              className={`h-8 px-3.5 rounded-pill text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 ${
                tab === 'redemptions' ? 'bg-panel text-ink shadow-card' : 'text-muted'
              }`}
            >
              Redemptions
              {pending > 0 && (
                <span
                  className="font-mono text-[11px] px-1.5 rounded-pill text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {pending}
                </span>
              )}
            </button>
          </div>
          {tab === 'items' && (
            <button
              onClick={() => setEditing({ mode: 'new' })}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-field text-[13px] font-medium"
              style={{
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-fg)',
              }}
            >
              <Plus size={15} /> Add item
            </button>
          )}
        </div>
      </div>

      {tab === 'items' ? (
        <div className="space-y-5">
          {overview && <AdminShopStats overview={overview} />}
          <ItemsTable
            items={items}
            onToggleActive={toggleActive}
            onEdit={(item) => setEditing({ mode: 'edit', item })}
            onReorder={reorder}
          />
        </div>
      ) : (
        <RedemptionQueue
          queueTab={queueTab}
          onQueueTab={setQueueTab}
          pendingCount={pending}
          readyCount={ready}
          redemptions={redemptions}
          busyId={busyId}
          onApprove={(r) => runQueueAction(r.id, shopApi.approveRedemption)}
          onDecline={(r) => runQueueAction(r.id, shopApi.declineRedemption)}
          onFulfill={(r) => runQueueAction(r.id, shopApi.fulfillRedemption)}
        />
      )}
    </div>
  )
}

export default AdminShop
