import { useState } from 'react'
import { PaperlessMaterial } from '../../types/paperless'
import { LessonResource } from '../../types/lesson'
import MaterialPreviewButton from '../materials/MaterialPreviewButton'
import DocumentViewerModal from '../materials/DocumentViewerModal'
import DocumentThumb from '../materials/DocumentThumb'

export default function StudentResources({ materials = [], resources = [] }: {
  materials?: PaperlessMaterial[]; resources?: LessonResource[]
}) {
  const [viewing, setViewing] = useState<PaperlessMaterial | null>(null)
  return <div className="space-y-3">
    {resources.map(resource => resource.url ? <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-field border border-line p-3 text-accent underline break-words [overflow-wrap:anywhere]">{resource.label}<span className="text-sm text-muted">(opens a new tab)</span></a> : <p key={resource.id}>{resource.label}</p>)}
    {materials.map(material => <div key={material.document_id} className="flex flex-wrap items-center gap-3 rounded-field border border-line p-3">
      <DocumentThumb externalId={material.external_id} title={material.title} className="h-12 w-9 shrink-0" />
      <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{material.title}{material.page_count ? <span className="block text-sm text-muted">{material.page_count} pages</span> : null}</p>
      <MaterialPreviewButton material={material} onOpen={() => setViewing(material)} />
    </div>)}
    <DocumentViewerModal material={viewing} onClose={() => setViewing(null)} />
  </div>
}
