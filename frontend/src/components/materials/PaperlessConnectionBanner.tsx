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

import { Link } from 'react-router-dom'

const PaperlessConnectionBanner = ({ disconnected }: { disconnected: boolean }) => disconnected ? (
  <div role="status" className="my-4 p-4 bg-exc-bg border border-line rounded-card text-[13px] text-ink">
    <p className="font-semibold">Paperless is disconnected</p>
    <p className="mt-1">Cached document information and attachment history are still available. You can plan with these records; previews, downloads and sync need the library to be reconnected.</p>
    <Link to="/admin/settings/paperless" className="inline-block mt-2 text-accent font-semibold">Reconnect Paperless</Link>
  </div>
) : null
export default PaperlessConnectionBanner
