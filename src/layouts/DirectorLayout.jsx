import { useState, useEffect } from 'react'
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
  BuildingOffice2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  BellIcon,
  UserCircleIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import Logo from '../components/Logo'
import DirectorNotificationPanel from '../components/DirectorNotificationPanel'
import Avatar from '../components/Avatar'
import { getCurrentUser } from '../utils/auth'

const DirectorLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const [tasksMenuOpen, setTasksMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
  }

  const navigation = [
    { name: 'Dashboard', href: '/director/dashboard', icon: HomeIcon },
    { name: 'Quản lý nhân viên', href: '/director/users', icon: UsersIcon },
    { name: 'Quản lý phòng ban', href: '/director/departments', icon: BuildingOfficeIcon },
  ]

  const tasksSubMenu = [
    { name: 'Tất cả công việc', href: '/director/tasks' },
    { name: 'Công việc theo phòng ban', href: '/director/department-tasks' },
    { name: 'Hoàn thành', href: '/director/tasks/hoanthanh' },
    { name: 'Đang chờ', href: '/director/tasks/choduyet' },
    { name: 'Công việc phát sinh', href: '/director/tasks/ad-hoc' },
  ]
  
  const handleCreateTask = () => {
    navigate('/director/tasks?create=true')
    setSidebarOpen(false)
  }

  const reportsSubMenu = [
    { name: 'Tổng quan', href: '/director/reports/statistics' },
    { name: 'Báo cáo của nhân viên', href: '/director/reports/employees' },
    { name: 'Báo cáo phòng ban', href: '/director/reports/departments' },
    { name: 'Lịch làm việc của nhân viên', href: '/director/reports/schedules' },
    { name: 'Khác', href: '/director/reports/other' },

  ]

  // Kiểm tra xem có đang ở trong menu báo cáo không
  const isReportsActive = location.pathname.startsWith('/director/reports')
  
  // Kiểm tra xem có đang ở trong menu công việc không
  const isTasksActive = location.pathname.startsWith('/director/tasks') || location.pathname.startsWith('/director/department-tasks')

  // Tự động mở submenu khi đang ở trang báo cáo
  useEffect(() => {
    if (isReportsActive) {
      setReportsMenuOpen(true)
    }
  }, [isReportsActive])

  // Tự động mở submenu khi đang ở trang công việc
  useEffect(() => {
    if (isTasksActive) {
      setTasksMenuOpen(true)
    }
  }, [isTasksActive])

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
                      ? 'bg-blue-50 text-blue-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}

            {/* Công việc với submenu */}
            <div>
              <button
                onClick={() => setTasksMenuOpen(!tasksMenuOpen)}
                className={`
                  w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base
                  ${isTasksActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
                title={sidebarCollapsed ? 'Công việc' : ''}
              >
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <ClipboardDocumentListIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${isTasksActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>Công việc</span>}
                </div>
                {!sidebarCollapsed && (
                  tasksMenuOpen ? (
                    <ChevronDownIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  )
                )}
              </button>

              {/* Submenu */}
              {tasksMenuOpen && !sidebarCollapsed && (
                <div className="ml-2 sm:ml-4 mt-1 space-y-1">
                  {/* Nút Tạo công việc */}
                  <button
                    onClick={handleCreateTask}
                    className="w-full flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tạo công việc</span>
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  {tasksSubMenu.map((subItem) => {
                    let subActive = false
                    if (subItem.href === '/director/tasks') {
                      // "Tất cả công việc" chỉ active khi pathname chính xác là /director/tasks (không có sub-path)
                      subActive = location.pathname === '/director/tasks'
                    } else if (subItem.href === '/director/department-tasks') {
                      subActive = location.pathname === '/director/department-tasks'
                    } else {
                      subActive = location.pathname === subItem.href
                    }
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        className={`
                          block px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm
                          ${subActive 
                            ? 'bg-blue-100 text-blue-700 font-medium' 
                            : 'text-gray-600 hover:bg-gray-50'
                          }
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {subItem.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Báo cáo với submenu */}
            <div>
              <button
                onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
                className={`
                  w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base
                  ${isReportsActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
                title={sidebarCollapsed ? 'Báo cáo' : ''}
              >
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <ChartBarIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${isReportsActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>Báo cáo</span>}
                </div>
                {!sidebarCollapsed && (
                  reportsMenuOpen ? (
                    <ChevronDownIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  )
                )}
              </button>

              {/* Submenu */}
              {reportsMenuOpen && !sidebarCollapsed && (
                <div className="ml-2 sm:ml-4 mt-1 space-y-1">
                  {reportsSubMenu.map((subItem) => {
                    const subActive = location.pathname === subItem.href
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        className={`
                          block px-4 py-2 rounded-lg transition-colors text-sm
                          ${subActive 
                            ? 'bg-blue-100 text-blue-700 font-medium' 
                            : 'text-gray-600 hover:bg-gray-50'
                          }
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {subItem.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
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
              <DirectorNotificationPanel />
              <div className="text-right hidden md:block">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[120px] sm:max-w-none">
                  {getCurrentUser()?.fullName || 'Director'}
                </p>
                <p className="text-xs text-gray-500">Giám đốc</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Avatar size={10} className="border-2 border-blue-600" />
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
                          to="/director/profile"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <UserCircleIcon className="h-5 w-5 text-gray-400" />
                          <span>Hồ sơ cá nhân</span>
                        </Link>
                        <Link
                          to="/director/notifications"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <BellIcon className="h-5 w-5 text-gray-400" />
                          <span>Lịch sử thông báo</span>
                        </Link>
                        <Link
                          to="/director/company"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
                          <span>Thông tin công ty</span>
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

export default DirectorLayout

