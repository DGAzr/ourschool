/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'
import AssignmentDetailModal from '../components/assignments/AssignmentDetailModal'

/** A stable destination for dashboard, lesson and student work links. */
export default function AssignmentWork() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const id = Number(assignmentId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return <div role="alert">Assignment not found. <Link to="/assignments">Back to assignments</Link></div>
  }
  return <AssignmentDetailModal assignmentId={id} isOpen onClose={() => navigate('/assignments')} presentation="page" />
}
