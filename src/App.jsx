import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from './layouts/AuthLayout'
import SuperAdminLayout from './layouts/SuperAdminLayout'
import DirectorLayout from './layouts/DirectorLayout'
import ManagerLayout from './layouts/ManagerLayout'
import UserLayout from './layouts/UserLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DirectorsPage from './pages/super-admin/DirectorsPage'
import TasksPage from './pages/super-admin/TasksPage'
import UsersPage from './pages/super-admin/UsersPage'
import CompanyInfoPage from './pages/director/CompanyInfoPage'
import CompanyTasksPage from './pages/director/CompanyTasksPage'
import AdHocTasksPage from './pages/director/AdHocTasksPage'
import CompanyUsersPage from './pages/director/CompanyUsersPage'
import CompanyDepartmentsPage from './pages/director/CompanyDepartmentsPage'
import DepartmentTasksPage from './pages/manager/DepartmentTasksPage'
import DepartmentUsersPage from './pages/manager/DepartmentUsersPage'
import DepartmentInfoPage from './pages/manager/DepartmentInfoPage'
import DepartmentsPage from './pages/super-admin/DepartmentsPage'
import ReportsPage from './pages/ReportsPage'
import DailyReportPage from './pages/DailyReportPage'
import EmployeeReportsPage from './pages/director/EmployeeReportsPage'
import DepartmentReportsPage from './pages/director/DepartmentReportsPage'
import OtherReportsPage from './pages/director/OtherReportsPage'
import MyTasksPage from './pages/user/MyTasksPage'
import TaskDetailPage from './pages/user/TaskDetailPage'
import NotificationHistoryPage from './pages/NotificationHistoryPage'
import ProfilePage from './pages/ProfilePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - Auth Layout */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Super Admin routes - Super Admin Layout (SUPER_ADMIN only) */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage role="super-admin" />} />
          <Route path="directors" element={<DirectorsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="reports" element={<ReportsPage role="super-admin" />} />
          <Route path="notifications" element={<NotificationHistoryPage />} />
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
        </Route>

        {/* Director routes - Director Layout (DIRECTOR only) */}
        <Route
          path="/director"
          element={
            <ProtectedRoute allowedRoles={['DIRECTOR']}>
              <DirectorLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage role="director" />} />
          <Route path="tasks" element={<CompanyTasksPage />} />
          <Route path="tasks/danglam" element={<CompanyTasksPage />} />
          <Route path="tasks/hoanthanh" element={<CompanyTasksPage />} />
          <Route path="tasks/choduyet" element={<CompanyTasksPage />} />
          <Route path="tasks/ad-hoc" element={<AdHocTasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage basePath="/director" />} />
          <Route path="department-tasks" element={<DepartmentTasksPage />} />
          <Route path="users" element={<CompanyUsersPage />} />
          <Route path="departments" element={<CompanyDepartmentsPage />} />
          <Route path="company" element={<CompanyInfoPage />} />
          <Route path="reports/employees" element={<EmployeeReportsPage />} />
          <Route path="reports/departments" element={<DepartmentReportsPage />} />
          <Route path="reports/other" element={<OtherReportsPage />} />
          <Route path="reports" element={<Navigate to="/director/reports/employees" replace />} />
          <Route path="notifications" element={<NotificationHistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route index element={<Navigate to="/director/dashboard" replace />} />
        </Route>

        {/* Manager routes - Manager Layout (MANAGER or DEPARTMENT_MANAGER) */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['MANAGER', 'DEPARTMENT_MANAGER']}>
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage role="manager" />} />
          <Route path="tasks" element={<DepartmentTasksPage />} />
          <Route path="my-tasks" element={<MyTasksPage basePath="/manager" />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage basePath="/manager" />} />
          <Route path="users" element={<DepartmentUsersPage />} />
          <Route path="department" element={<DepartmentInfoPage />} />
          <Route path="reports" element={<ReportsPage role="manager" />} />
          <Route path="daily-report" element={<DailyReportPage />} />
          <Route path="notifications" element={<NotificationHistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route index element={<Navigate to="/manager/dashboard" replace />} />
        </Route>

        {/* User routes - User Layout */}
        <Route
          path="/user"
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage role="user" />} />
          <Route path="tasks" element={<MyTasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="tasks/in-progress" element={<MyTasksPage />} />
          <Route path="tasks/completed" element={<MyTasksPage />} />
          <Route path="daily-report" element={<DailyReportPage />} />
          <Route path="notifications" element={<NotificationHistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route index element={<Navigate to="/user/dashboard" replace />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
