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
  UserGroupIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import Logo from '../components/Logo'
import NotificationPanel from '../components/NotificationPanel'
import Avatar from '../components/Avatar'
import { getCurrentUser } from '../utils/auth'

const SuperAdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
  }

  const navigation = [
    { name: 'Dashboard', href: '/super-admin/dashboard', icon: HomeIcon },
    { name: 'Quản lý Công ty', href: '/super-admin/directors', icon: UserGroupIcon },
    { name: 'Quản lý công việc', href: '/super-admin/tasks', icon: ClipboardDocumentListIcon },
    { name: 'Quản lý nhân viên', href: '/super-admin/users', icon: UsersIcon },
    { name: 'Quản lý Phòng ban', href: '/super-admin/departments', icon: BuildingOfficeIcon },
    { name: 'Báo cáo', href: '/super-admin/reports', icon: ChartBarIcon },
    { name: 'Lịch sử thông báo', href: '/super-admin/notifications', icon: BellIcon },
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
        fixed inset-y-0 left-0 z-30 bg-white shadow-lg transform transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:relative lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'w-16 lg:w-16' : 'w-64 sm:w-72'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 border-b border-gray-200">
            {!sidebarCollapsed && <Logo />}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-5 w-5" />
                ) : (
                  <ChevronLeftIcon className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-4 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center ${sidebarCollapsed ? 'justify-center' : ''} space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base
                    ${active 
                      ? 'bg-indigo-50 text-indigo-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>

        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 md:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
            >
              <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <div className="flex-1 lg:flex-none" />
            <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
              <NotificationPanel />
              <div className="text-right hidden md:block">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[120px] sm:max-w-none">
                  {getCurrentUser()?.fullName || 'Super Admin'}
                </p>
                <p className="text-xs text-gray-500">Quản trị viên hệ thống</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Avatar size={10} className="border-2 border-indigo-600" />
                </button>
                {avatarMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setAvatarMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="py-1">
                        <Link
                          to="/super-admin/notifications"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <BellIcon className="h-5 w-5 text-gray-400" />
                          <span>Lịch sử thông báo</span>
                        </Link>
                        <div className="border-t border-gray-200 my-1"></div>
                        <button
                          onClick={() => {
                            setAvatarMenuOpen(false)
                            handleLogout()
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-600" />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout

