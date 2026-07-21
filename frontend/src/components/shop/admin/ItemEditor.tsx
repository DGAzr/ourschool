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

import React, { useMemo, useState } from 'react'
import { ArrowLeft, Zap, Package, Infinity as InfinityIcon } from 'lucide-react'

import { Button, Input, TextArea, useToast } from '../../ui'
import ConfirmDialog from '../../ui/ConfirmDialog'
import { getErrorMessage } from '../../../services/api'
import { shopApi, type ShopItemInput } from '../../../services/shop'
import type { FulfillmentType, ShopCategory, ShopItem } from '../../../types/shop'
import { ItemCard } from '../ItemCard'
import { CategoryChipPicker } from './CategoryChipPicker'
import { ImagePicker } from './ImagePicker'

interface ItemEditorProps {
  /** null = new item; otherwise edit. */
  item: ShopItem | null
  categories: ShopCategory[]
  onCategoryCreated: (category: ShopCategory) => void
  onBack: () => void
  onSaved: () => void
  onDeleted: () => void
}

export const ItemEditor: React.FC<ItemEditorProps> = ({
  item,
  categories,
  onCategoryCreated,
  onBack,
  onSaved,
  onDeleted,
}) => {
  const { toast } = useToast()
  const editing = item !== null

  const [name, setName] = useState(item?.name ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(
    item?.category_id ?? categories[0]?.id ?? null
  )
  const [description, setDescription] = useState(item?.description ?? '')
  const [cost, setCost] = useState<string>(String(item?.cost_points ?? 0))
  const [unlimited, setUnlimited] = useState(
    item ? item.quantity_available === null : true
  )
  const [quantity, setQuantity] = useState<string>(
    item?.quantity_available != null ? String(item.quantity_available) : '10'
  )
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    item?.fulfillment_type ?? 'instant'
  )
  const [imageIds, setImageIds] = useState<string[]>(item?.image_ids ?? [])
  const [nameError, setNameError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const costNumber = Math.max(0, Math.floor(Number(cost) || 0))
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  )

  // Live preview item for the sticky StudentPreview card.
  const previewItem: ShopItem = {
    id: item?.id ?? -1,
    external_id: item?.external_id ?? 'preview',
    name,
    category_id: categoryId ?? 0,
    description,
    cost_points: costNumber,
    quantity_available: unlimited ? null : Math.max(0, Math.floor(Number(quantity) || 0)),
    fulfillment_type: fulfillment,
    is_active: true,
    image_ids: imageIds,
    total_redeemed: item?.total_redeemed ?? 0,
    display_order: item?.display_order ?? 0,
    created_at: item?.created_at ?? new Date().toISOString(),
    updated_at: item?.updated_at ?? new Date().toISOString(),
    category: selectedCategory,
  }

  const save = async () => {
    if (!name.trim()) {
      setNameError(true)
      toast('Give the item a name first.', 'danger')
      return
    }
    if (categoryId == null) {
      toast('Pick a category first.', 'danger')
      return
    }
    setSaving(true)
    const payload: ShopItemInput = {
      name: name.trim(),
      category_id: categoryId,
      description: description.trim() || null,
      cost_points: costNumber,
      quantity_available: unlimited
        ? null
        : Math.max(0, Math.floor(Number(quantity) || 0)),
      fulfillment_type: fulfillment,
      image_ids: imageIds,
    }
    try {
      if (editing && item) {
        await shopApi.updateItem(item.id, payload)
      } else {
        await shopApi.createItem(payload)
      }
      toast(editing ? 'Item saved.' : 'Item added to the shop.')
      onSaved()
    } catch (err) {
      toast(getErrorMessage(err, 'Could not save the item'), 'danger')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!item) return
    setSaving(true)
    try {
      await shopApi.deleteItem(item.id)
      toast('Item deleted.')
      onDeleted()
    } catch (err) {
      toast(getErrorMessage(err, 'Could not delete the item'), 'danger')
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-field border text-[13px] text-ink-2 hover:bg-panel-2 transition-colors mb-4"
        style={{ borderColor: 'var(--btn-border)' }}
      >
        <ArrowLeft size={14} /> Back to items
      </button>

      <h2 className="text-[19px] font-bold text-ink tracking-[-0.01em] mb-4">
        {editing ? 'Edit item' : 'New shop item'}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-[18px]">
        {/* Form */}
        <div className="bg-panel border border-line rounded-card p-[20px_22px] flex flex-col gap-[18px]">
          <Input
            label="Item name"
            value={name}
            error={nameError ? 'Give the item a name first' : undefined}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError(false)
            }}
            placeholder="e.g. Extra screen time"
          />

          <div>
            <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
              Category
            </label>
            <CategoryChipPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
              onCreated={onCategoryCreated}
            />
          </div>

          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is it, and how does the student get it?"
          />

          <div>
            <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
              Pictures
            </label>
            <ImagePicker imageIds={imageIds} onChange={setImageIds} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cost in points"
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <div>
              <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
                Quantity available
              </label>
              {unlimited ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center h-[42px] px-3 rounded-field border border-field-border bg-field-bg text-[13px] text-muted flex-1">
                    Unlimited
                  </span>
                  <button
                    type="button"
                    onClick={() => setUnlimited(false)}
                    className="h-[42px] px-3 rounded-field border text-[13px] text-ink-2 hover:bg-panel-2"
                    style={{ borderColor: 'var(--btn-border)' }}
                  >
                    Set limit
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setUnlimited(true)}
                    className="h-[42px] px-3 rounded-field border text-ink-2 hover:bg-panel-2"
                    style={{ borderColor: 'var(--btn-border)' }}
                    title="Make unlimited"
                  >
                    <InfinityIcon size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
              Fulfillment
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    key: 'instant' as const,
                    icon: <Zap size={14} />,
                    title: 'Instant',
                    body: "Points deduct and it's theirs right away. Good for privileges & digital perks.",
                  },
                  {
                    key: 'request' as const,
                    icon: <Package size={14} />,
                    title: 'Request',
                    body: 'You approve and hand it off. Good for physical items & outings.',
                  },
                ]
              ).map((opt) => {
                const selected = fulfillment === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFulfillment(opt.key)}
                    className="text-left rounded-card border p-3.5 transition-colors"
                    style={
                      selected
                        ? {
                            borderColor: 'var(--accent)',
                            background: 'var(--accent-soft)',
                            boxShadow: '0 0 0 1px var(--accent)',
                          }
                        : { borderColor: 'var(--line)', background: 'var(--panel)' }
                    }
                  >
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      {opt.icon} {opt.title}
                    </span>
                    <p className="mt-1 text-[12px] text-muted leading-snug">{opt.body}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sticky preview + actions */}
        <div className="lg:sticky lg:top-4 self-start flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">
              Student preview
            </p>
            <ItemCard item={previewItem} balance={Number.MAX_SAFE_INTEGER} preview />
          </div>

          <Button onClick={save} loading={saving} fullWidth>
            {editing ? 'Save changes' : 'Add to shop'}
          </Button>
          <Button variant="secondary" onClick={onBack} disabled={saving} fullWidth>
            Cancel
          </Button>
          {editing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="text-[13px] font-medium text-center py-1 disabled:opacity-50"
              style={{ color: 'var(--danger)' }}
            >
              Delete item
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          remove()
        }}
        title="Delete this item?"
        message={
          <>
            <strong>{item?.name}</strong> will be removed from the shop. Past
            redemptions keep their record.
          </>
        }
        tone="danger"
        confirmLabel="Delete item"
      />
    </div>
  )
}
