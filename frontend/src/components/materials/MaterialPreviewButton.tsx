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

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePaperlessStatusContext } from '../../contexts/PaperlessStatusContext'
import { useAuth } from '../../contexts/AuthContext'
import { paperlessApi } from '../../services/paperless'
import { PaperlessMaterial } from '../../types/paperless'
import { Button } from '../ui'

/** Check the document's own library, including attachments from an old connection. */
const MaterialPreviewButton = ({ material, onOpen, label = 'View' }: {
  material: PaperlessMaterial; onOpen: () => void; label?: string
}) => {
  const { user } = useAuth()
  const { status } = usePaperlessStatusContext()
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['material-availability', user?.id, material.document_id, status?.connected, status?.library_id, status?.needs_reconnect],
    queryFn: () => paperlessApi.documentAvailability(material.document_id),
    staleTime: 30_000, retry: false,
  })
  const handleOpen = async () => {
    const checked = await refetch()
    if (checked.data?.available && !checked.error) onOpen()
  }
  return <div className="max-w-[250px] text-[11px] text-muted">
    <Button variant="outline" size="sm" onClick={() => void handleOpen()} disabled={!data?.available || isFetching}
      aria-label={`${label} ${material.title}`} title={data?.reason || undefined}>
      {isPending ? 'Checking availability…' : data?.available ? label : 'Document unavailable'}
    </Button>
    {error ? <p role="status" className="mt-1">Could not check document availability. <button className="text-accent min-h-8" onClick={() => void refetch()}>Try again</button></p>
      : data?.available === false && <p className="mt-1">{data.reason}{user?.role === 'admin'
        ? <> <Link to="/admin/settings/paperless" className="text-accent underline">Reconnect library</Link></>
        : ' Ask your teacher for this material.'}
        <button className="ml-1 min-h-8 text-accent underline" disabled={isFetching} onClick={() => void refetch()}>Check again</button>
      </p>}
  </div>
}
export default MaterialPreviewButton
