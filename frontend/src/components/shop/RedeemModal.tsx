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
import Modal from '../ui/Modal/Modal'
import { Button, useToast } from '../ui'
import { getErrorMessage } from '../../services/api'
import { shopApi } from '../../services/shop'
import type { RedeemResponse, ShopItem } from '../../types/shop'

interface RedeemModalProps {
  item: ShopItem | null
  balance: number
  onClose: () => void
  /** Called after a successful redeem so the page can update balance/stock/lists. */
  onRedeemed: (result: RedeemResponse) => void
  /** Navigate to My redemptions from the done state. */
  onViewRedemptions: () => void
}

export const RedeemModal: React.FC<RedeemModalProps> = ({
  item,
  balance,
  onClose,
  onRedeemed,
  onViewRedemptions,
}) => {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [newBalance, setNewBalance] = useState<number | null>(null)

  if (!item) return null

  const isInstant = item.fulfillment_type === 'instant'
  const cost = item.cost_points
  const after = balance - cost
  const color = item.category?.color || '#9A8A4F'
  const icon = item.category?.icon || '✦'

  const handleClose = () => {
    setDone(false)
    setSubmitting(false)
    setNewBalance(null)
    onClose()
  }

  const confirm = async () => {
    setSubmitting(true)
    try {
      const result = await shopApi.redeem(item.id)
      setNewBalance(result.student_points.current_balance)
      onRedeemed(result)
      setDone(true)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not complete redemption'), 'danger')
      setSubmitting(false)
    }
  }

  const iconTile = (
    <div
      className="w-[52px] h-[52px] rounded-field flex items-center justify-center text-[24px]"
      style={{ background: `${color}1A` }}
      aria-hidden
    >
      {icon}
    </div>
  )

  if (done) {
    return (
      <Modal
        isOpen
        onClose={handleClose}
        showCloseButton
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>
              Keep shopping
            </Button>
            <Button onClick={onViewRedemptions}>View redemption</Button>
          </>
        }
      >
        <div className="text-center py-2">
          <div className="text-[44px] leading-none mb-3">
            {isInstant ? '🎉' : '📨'}
          </div>
          <p className="text-[18px] font-semibold text-ink">
            {isInstant ? 'Redeemed!' : 'Request sent'}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            {isInstant
              ? `${item.name} is yours. Your new balance is ◆ ${(newBalance ?? after).toLocaleString()}.`
              : `Your points are held and a request for ${item.name} went to your admin.`}
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen
      onClose={handleClose}
      icon={iconTile}
      title={item.name}
      subtitle="Redeem"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={submitting}>
            {isInstant ? 'Redeem now' : 'Send request'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Receipt */}
        <div className="space-y-2 text-[13.5px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Your balance</span>
            <span className="font-mono text-ink">◆ {balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">This costs</span>
            <span className="font-mono" style={{ color: 'var(--accent)' }}>
              – ◆ {cost.toLocaleString()}
            </span>
          </div>
          <div className="border-t border-line pt-2 flex items-center justify-between">
            <span className="font-semibold text-ink">Balance after</span>
            <span className="font-mono font-semibold text-ink">
              ◆ {after.toLocaleString()}
            </span>
          </div>
        </div>

        <div
          className="rounded-card p-3 text-[12.5px] text-muted leading-relaxed"
          style={{ background: 'var(--panel-2)' }}
        >
          {isInstant
            ? 'This is an instant reward — your points are deducted and it’s yours right away.'
            : 'Your points are held and a request goes to your admin, who’ll approve it and hand it off.'}
        </div>
      </div>
    </Modal>
  )
}
