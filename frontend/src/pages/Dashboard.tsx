import { useAuth } from '../contexts/AuthContext'
import TeacherDashboard from './TeacherDashboard'
import StudentToday from './StudentToday'

export default function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <TeacherDashboard /> : <StudentToday />
}
