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

import { paperlessApi } from '../../services/paperless'

interface DocumentThumbProps {
  externalId?: string | null
  title: string
  /** Tint for the placeholder header band (usually the subject color). */
  accentColor?: string | null
  className?: string
}

/**
 * Document thumbnail image with a CSS "paper" placeholder fallback — a
 * subject-tinted header band over faint text lines — used while loading,
 * when the thumbnail 404s (Paperless unreachable), or when there is no
 * document id (snapshot-only rows after a doc vanished).
 */
const DocumentThumb: React.FC<DocumentThumbProps> = ({
  externalId,
  title,
  accentColor,
  className = '',
}) => {
  const [failed, setFailed] = useState(false)
  const showImage = externalId && !failed

  return (
    <div
      className={`relative overflow-hidden rounded-[7px] border border-line bg-white dark:bg-panel-2 ${className}`}
    >
      {showImage ? (
        <img
          src={paperlessApi.thumbnailUrl(externalId)}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col">
          <div
            className="h-[22%] flex-shrink-0"
            style={{
              background: accentColor
                ? `color-mix(in srgb, ${accentColor} 30%, transparent)`
                : 'var(--track)',
            }}
          />
          <div className="flex-1 px-[14%] py-[10%] space-y-[8%]">
            {[92, 100, 84, 96, 70].map((width, i) => (
              <div
                key={i}
                className="h-[4%] min-h-[2px] rounded-full bg-track"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentThumb
