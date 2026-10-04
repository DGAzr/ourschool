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

import React, { useEffect, useRef, useState } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { paperlessApi } from '../../services/paperless'

interface DocumentThumbProps {
  externalId?: string | null
  revision?: string | null
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
  revision,
  accentColor,
  className = '',
}) => {
  const container = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const [image, setImage] = useState<{
    id: string
    userId: number
    url: string
  } | null>(null)
  useEffect(() => {
    if (!externalId || !user) return
    const controller = new AbortController()
    let url: string | null = null
    let started = false
    const load = () => {
      if (started || controller.signal.aborted) return
      started = true
      void paperlessApi
        .fetchThumbnail(externalId, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return
          url = URL.createObjectURL(blob)
          setImage({ id: externalId, userId: user.id, url })
        })
        .catch(() => {
          /* Placeholder for unavailable thumbnails. */
        })
    }
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                load()
                observer?.disconnect()
              }
            },
            { rootMargin: '100px' }
          )
        : null
    if (observer && container.current) observer.observe(container.current)
    else load()
    return () => {
      observer?.disconnect()
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [externalId, user, revision])
  const showImage =
    image && image.id === externalId && image.userId === user?.id

  return (
    <div
      ref={container}
      className={`relative overflow-hidden rounded-[7px] border border-line bg-white dark:bg-panel-2 ${className}`}
    >
      {showImage ? (
        <img
          src={image?.url}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top"
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
