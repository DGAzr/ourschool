import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocumentViewerModal from './DocumentViewerModal'
import ToastProvider from '../ui/Toast'
import { PaperlessMaterial } from '../../types/paperless'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('pdfjs-dist', () => ({
  getDocument: mocks.getDocument,
  GlobalWorkerOptions: {},
}))
vi.mock('../../services/api', () => ({
  getAuthOnlyHeaders: () => ({ Authorization: 'Bearer test' }),
  getErrorMessage: () => 'Rendering failed',
}))
const material: PaperlessMaterial = {
  id: 1,
  document_id: 42,
  title: 'Protected material',
  material_kind: 'worksheet',
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('uses authenticated range loading and destroys the PDF task on close', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D
  )
  mocks.getDocument.mockReturnValue({
    destroy: mocks.destroy,
    promise: Promise.resolve({
      numPages: 2,
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 100, height: 200 }),
          render: () => ({ promise: Promise.resolve(), cancel: mocks.cancel }),
        }),
    }),
  })
  const { unmount } = render(
    <ToastProvider>
      <DocumentViewerModal material={material} onClose={() => {}} />
    </ToastProvider>
  )
  await waitFor(() =>
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  )
  expect(mocks.getDocument).toHaveBeenCalledWith(
    expect.objectContaining({
      httpHeaders: { Authorization: 'Bearer test' },
      disableAutoFetch: true,
      disableStream: true,
      url: expect.stringContaining('/42/content'),
    })
  )
  unmount()
  expect(mocks.destroy).toHaveBeenCalledOnce()
})

it('distinguishes missing documents from disconnected libraries', async () => {
  mocks.getDocument.mockReturnValue({
    destroy: mocks.destroy,
    promise: Promise.reject({ status: 409 }),
  })
  render(
    <ToastProvider>
      <DocumentViewerModal material={material} onClose={() => {}} />
    </ToastProvider>
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('disconnected')
})
