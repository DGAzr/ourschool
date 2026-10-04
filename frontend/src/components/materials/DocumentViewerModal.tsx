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
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Download } from 'lucide-react'
import Modal from '../ui/Modal/Modal'
import { Button, Spinner, useToast } from '../ui'
import { paperlessApi } from '../../services/paperless'
import { getAuthOnlyHeaders, getErrorMessage } from '../../services/api'
import { PaperlessMaterial } from '../../types/paperless'

interface Props {
  material: PaperlessMaterial | null
  onClose: () => void
}
const DocumentViewerModal: React.FC<Props> = (props) =>
  props.material ? (
    <ViewerContent
      key={props.material.document_id}
      material={props.material}
      onClose={props.onClose}
    />
  ) : null
const ViewerContent: React.FC<{
  material: PaperlessMaterial
  onClose: () => void
}> = ({ material, onClose }) => {
  const { toast } = useToast()
  const canvas = useRef<HTMLCanvasElement>(null)
  const downloadController = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState('')
  const [pdf, setPdf] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(
    null
  )
  useEffect(() => {
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    void import('pdfjs-dist')
      .then(async ({ getDocument, GlobalWorkerOptions }) => {
        if (cancelled) return
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        task = getDocument({
          url: paperlessApi.previewUrl(material.document_id),
          httpHeaders: getAuthOnlyHeaders(),
          disableAutoFetch: true,
          disableStream: true,
          cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
          wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
          iccUrl: `${import.meta.env.BASE_URL}pdfjs/iccs/`,
        })
        const document = await task.promise
        if (cancelled) {
          await task.destroy()
          return
        }
        setPages(document.numPages)
        setPdf(document)
      })
      .catch((err) => {
        if (cancelled) return
        const status = (err as { status?: number }).status
        setError(
          status === 403
            ? 'You no longer have access to this material.'
            : status === 404
              ? 'This document is no longer available in Paperless.'
              : status === 409
                ? 'The document’s Paperless library is disconnected. Ask an administrator to reconnect it.'
                : status === 401
                  ? 'Your session has expired. Sign in again.'
                  : status === 415
                    ? 'No PDF preview is available. Download the original instead.'
                    : 'Could not open the PDF. Check the Paperless connection or download the original.'
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
      void task?.destroy()
      downloadController.current?.abort()
    }
  }, [material.document_id])
  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    let render: RenderTask | null = null
    void pdf
      .getPage(page)
      .then(async (pdfPage) => {
        if (cancelled || !canvas.current) return
        const context = canvas.current.getContext('2d')
        if (!context) throw new Error('PDF rendering is unavailable')
        const viewport = pdfPage.getViewport({ scale: 1.5 })
        canvas.current.width = viewport.width
        canvas.current.height = viewport.height
        render = pdfPage.render({
          canvas: canvas.current,
          canvasContext: context,
          viewport,
        })
        await render.promise
        if (!cancelled) setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Could not render this page'))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
      render?.cancel()
    }
  }, [pdf, page])
  const handleDownload = async () => {
    const controller = new AbortController()
    downloadController.current = controller
    setDownloading(true)
    try {
      const { blob, filename } = await paperlessApi.download(
        material.document_id,
        controller.signal,
        (loaded, total) =>
          setProgress(
            total
              ? `${Math.round((loaded / total) * 100)}%`
              : `${Math.round(loaded / 1024)} KB`
          )
      )
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      if (!controller.signal.aborted)
        toast(getErrorMessage(err, 'Download failed'), 'danger')
    } finally {
      if (!controller.signal.aborted) {
        setDownloading(false)
        setProgress('')
      }
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
            Download {progress}
          </Button>
          {downloading && (
            <Button
              variant="outline"
              onClick={() => {
                downloadController.current?.abort()
                setDownloading(false)
                setProgress('')
              }}
            >
              Cancel download
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-neg-fg p-4">
          {error}
        </p>
      ) : (
        <>
          {loading && (
            <div role="status" className="flex justify-center gap-2 p-8">
              <Spinner size="sm" />
              Loading document…
            </div>
          )}
          <div className="max-h-[62vh] overflow-auto">
            <canvas
              ref={canvas}
              aria-label={`Page ${page} of ${material.title}`}
              className="max-w-full mx-auto"
            />
          </div>
          {pages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-3">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
export default DocumentViewerModal
