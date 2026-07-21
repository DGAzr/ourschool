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

import React, { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { shopApi } from '../../../services/shop'
import { getErrorMessage } from '../../../services/api'
import { useToast } from '../../ui'

const MAX_BYTES = 10 * 1024 * 1024

interface ImagePickerProps {
  imageIds: string[]
  onChange: (imageIds: string[]) => void
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ imageIds, onChange }) => {
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', 'danger')
      return
    }
    if (file.size > MAX_BYTES) {
      toast('Image is too large (max 10 MB).', 'danger')
      return
    }
    setUploading(true)
    try {
      const { id } = await shopApi.uploadImage(file)
      onChange([...imageIds, id])
    } catch (err) {
      toast(getErrorMessage(err, 'Upload failed'), 'danger')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = (id: string) => onChange(imageIds.filter((x) => x !== id))

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {imageIds.map((id, i) => (
          <div
            key={id}
            className="relative w-[84px] h-[84px] rounded-field overflow-hidden border border-line bg-center bg-cover"
            style={{ backgroundImage: `url(${shopApi.imageUrl(id)})` }}
          >
            <span className="absolute bottom-0 left-0 right-0 text-[9px] font-semibold text-white text-center bg-black/40 py-0.5">
              {i === 0 ? 'COVER' : 'ALT'}
            </span>
            <button
              type="button"
              onClick={() => remove(id)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="w-[84px] h-[84px] rounded-field border border-dashed flex flex-col items-center justify-center gap-1 text-muted hover:text-ink transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--btn-border)' }}
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
          ) : (
            <>
              <Plus size={16} />
              <span className="text-[11px]">Upload</span>
            </>
          )}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-faint">
        No photo? The category icon is used automatically.
      </p>
    </div>
  )
}
