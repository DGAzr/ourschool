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

import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

import Modal from '../ui/Modal/Modal'
import { Button, Spinner, useToast } from '../ui'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { PaperlessMaterial } from '../../types/paperless'

interface DocumentViewerModalProps {
  material: PaperlessMaterial | null
  onClose: () => void
}

/**
 * Inline PDF viewer for an attached Paperless document. The content is
 * fetched with the session token (the proxy authorizes students per
 * assignment) and shown via a blob URL; Download streams the original file.
 *
 * The outer component remounts the content per material so blob/error state
 * starts fresh (ConfirmDialog pattern — no state-sync effect).
 */
const DocumentViewerModal: React.FC<DocumentViewerModalProps> = (props) =>
  props.material ? (
    <ViewerContent key={props.material.id} {...props} material={props.material} />
  ) : null

interface ViewerContentProps extends DocumentViewerModalProps {
  material: PaperlessMaterial
}

const ViewerContent: React.FC<ViewerContentProps> = ({ material, onClose }) => {
  const { toast } = useToast()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    paperlessApi
      .fetchContentBlob(material.document_id, 'inline')
      .then((blob) => {
        url = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(url)
        } else {
          setBlobUrl(url)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            getErrorMessage(err, 'Could not load the document — is the Paperless server reachable?')
          )
        }
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [material.document_id])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await paperlessApi.fetchContentBlob(
        material.document_id,
        'attachment'
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = material.title || 'document'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(getErrorMessage(err, 'Download failed'), 'danger')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={material.title}
      subtitle={material.asn ? `ASN ${material.asn}` : undefined}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleDownload}
            loading={downloading}
            icon={<Download className="h-4 w-4" />}
          >
            Download
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error ? (
        <div className="px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      ) : blobUrl ? (
        <iframe
          src={blobUrl}
          title={material.title}
          className="w-full h-[62vh] rounded-[10px] border border-line bg-white"
        />
      ) : (
        <div className="flex items-center justify-center gap-2 h-[62vh] text-[13px] text-muted">
          <Spinner size="sm" />
          Loading document…
        </div>
      )}
    </Modal>
  )
}

export default DocumentViewerModal
