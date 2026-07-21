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
import { EmptyState } from '../../ui'
import ConfirmDialog from '../../ui/ConfirmDialog'
import { PartyPopper, Package, Archive } from 'lucide-react'
import type { ShopRedemption } from '../../../types/shop'
import { RedemptionStatusPill } from '../statusPill'
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  tint,
} from '../categoryTint'
import { relativeWhen } from '../shopLogic'

export type QueueTab = 'pending' | 'ready' | 'history'

interface RedemptionQueueProps {
  queueTab: QueueTab
  onQueueTab: (tab: QueueTab) => void
  pendingCount: number
  readyCount: number
  redemptions: ShopRedemption[]
  onApprove: (r: ShopRedemption) => void
  onDecline: (r: ShopRedemption) => void
  onFulfill: (r: ShopRedemption) => void
  busyId: number | null
}

const EMPTY: Record<QueueTab, { icon: typeof PartyPopper; title: string; sub: string }> = {
  pending: { icon: PartyPopper, title: 'All caught up', sub: 'No requests waiting for approval.' },
  ready: { icon: Package, title: 'Nothing to hand off', sub: 'No approved requests awaiting pickup.' },
  history: { icon: Archive, title: 'No history yet', sub: 'Fulfilled, declined, and instant redemptions appear here.' },
}

const SubTab: React.FC<{
  label: string
  count?: number
  active: boolean
  onClick: () => void
}> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`h-8 px-3.5 rounded-pill text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 ${
      active ? 'bg-panel text-ink shadow-card' : 'text-muted'
    }`}
  >
    {label}
    {count != null && count > 0 && (
      <span className="font-mono text-[11px] px-1.5 rounded-pill bg-track text-muted">
        {count}
      </span>
    )}
  </button>
)

export const RedemptionQueue: React.FC<RedemptionQueueProps> = ({
  queueTab,
  onQueueTab,
  pendingCount,
  readyCount,
  redemptions,
  onApprove,
  onDecline,
  onFulfill,
  busyId,
}) => {
  const [declining, setDeclining] = useState<ShopRedemption | null>(null)
  const empty = EMPTY[queueTab]

  return (
    <div>
      <div className="inline-flex items-center gap-1 p-1 rounded-pill bg-panel-2 border border-line mb-4">
        <SubTab
          label="Pending"
          count={pendingCount}
          active={queueTab === 'pending'}
          onClick={() => onQueueTab('pending')}
        />
        <SubTab
          label="Ready"
          count={readyCount}
          active={queueTab === 'ready'}
          onClick={() => onQueueTab('ready')}
        />
        <SubTab
          label="History"
          active={queueTab === 'history'}
          onClick={() => onQueueTab('history')}
        />
      </div>

      <div className="bg-panel border border-line rounded-card overflow-hidden">
        {redemptions.length === 0 ? (
          <EmptyState icon={empty.icon} title={empty.title} subtext={empty.sub} />
        ) : (
          <div className="divide-y divide-line">
            {redemptions.map((r) => {
              const color = r.item?.category?.color || DEFAULT_CATEGORY_COLOR
              const icon = r.item?.category?.icon || DEFAULT_CATEGORY_ICON
              const name = r.student_name || 'Student'
              const initial = name.charAt(0).toUpperCase()
              const busy = busyId === r.id
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-[18px] py-[15px]"
                >
                  <div
                    className="w-[42px] h-[42px] rounded-field flex items-center justify-center flex-shrink-0 text-[19px]"
                    style={{ background: tint(color) }}
                    aria-hidden
                  >
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink truncate">
                      {r.item_name}
                    </p>
                    <p className="text-[12px] text-muted flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-semibold text-white"
                        style={{ background: 'var(--muted)' }}
                        aria-hidden
                      >
                        {initial}
                      </span>
                      {name} · {relativeWhen(r.created_at)} ·{' '}
                      <span aria-hidden>◆</span> {r.cost_points.toLocaleString()}
                    </p>
                  </div>

                  {queueTab === 'history' ? (
                    <RedemptionStatusPill status={r.status} />
                  ) : queueTab === 'ready' ? (
                    <button
                      onClick={() => onFulfill(r)}
                      disabled={busy}
                      className="h-8 px-3.5 rounded-field text-white text-[13px] font-medium disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}
                    >
                      Mark fulfilled
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeclining(r)}
                        disabled={busy}
                        className="h-8 px-3.5 rounded-field border text-[13px] text-ink-2 hover:bg-panel-2 disabled:opacity-50"
                        style={{ borderColor: 'var(--btn-border)' }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => onApprove(r)}
                        disabled={busy}
                        className="h-8 px-3.5 rounded-field text-white text-[13px] font-medium disabled:opacity-50"
                        style={{ background: 'var(--accent)' }}
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={declining !== null}
        onClose={() => setDeclining(null)}
        onConfirm={() => {
          if (declining) onDecline(declining)
          setDeclining(null)
        }}
        title="Decline this request?"
        message={
          <>
            The student’s <strong>◆ {declining?.cost_points.toLocaleString()}</strong> will
            be refunded and <strong>{declining?.item_name}</strong> restocked.
          </>
        }
        tone="danger"
        confirmLabel="Decline & refund"
      />
    </div>
  )
}
