import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  HomeIcon, 
  ClipboardDocumentListIcon, 
  UsersIcon, 
  BuildingOfficeIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import Logo from '../components/Logo'

const SuperAdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const navigation = [
    { name: 'Dashboard', href: '/super-admin/dashboard', icon: HomeIcon },
    { name: 'Quản lý Công ty', href: '/super-admin/directors', icon: UserGroupIcon },
    { name: 'Quản lý công việc', href: '/super-admin/tasks', icon: ClipboardDocumentListIcon },
    { name: 'Quản lý nhân viên', href: '/super-admin/users', icon: UsersIcon },
    { name: 'Quản lý Phòng ban', href: '/super-admin/departments', icon: BuildingOfficeIcon },
    { name: 'Báo cáo', href: '/super-admin/reports', icon: ChartBarIcon },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:relative lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Logo />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${active 
                      ? 'bg-indigo-50 text-indigo-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex-1 lg:flex-none" />
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">Super Admin</p>
                <p className="text-xs text-gray-500">Quản trị viên hệ thống</p>
              </div>
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                SA
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout

