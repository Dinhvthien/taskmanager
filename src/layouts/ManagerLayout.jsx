import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  HomeIcon, 
  ClipboardDocumentListIcon, 
  DocumentCheckIcon,
  UsersIcon, 
  BuildingOfficeIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  DocumentTextIcon,
  BellIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import Logo from '../components/Logo'
import NotificationPanel from '../components/NotificationPanel'
import ScoreHistoryModal from '../components/ScoreHistoryModal'
import Avatar from '../components/Avatar'
import { taskScoreService } from '../services/taskScoreService'
import { getCurrentUser } from '../utils/auth'

const ManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [averageScore, setAverageScore] = useState(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [showScoreHistory, setShowScoreHistory] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
  }

  useEffect(() => {
    loadAverageScore()
    // Reload điểm mỗi 30 giây để cập nhật khi có task mới hoàn thành
    const interval = setInterval(() => {
      loadAverageScore()
    }, 30000) // 30 giây
    
    return () => clearInterval(interval)
  }, [])

  const navigation = [
    { name: 'Công việc của tôi', href: '/manager/my-tasks', icon: DocumentCheckIcon },
    { name: 'Công việc phòng ban', href: '/manager/tasks', icon: ClipboardDocumentListIcon },
    { name: 'Nhân viên phòng ban', href: '/manager/users', icon: UsersIcon },
    { name: 'Báo cáo phòng ban', href: '/manager/reports', icon: ChartBarIcon },
  ]

  const [workScheduleMenuOpen, setWorkScheduleMenuOpen] = useState(false)

  const workScheduleSubMenu = [
    { name: 'Đăng ký lịch làm', href: '/manager/daily-report?mode=register' },
    { name: 'Báo cáo cuối ngày', href: '/manager/daily-report?mode=report' },
  ]

  // Kiểm tra xem có đang ở trong menu lịch làm việc không
  const isWorkScheduleActive = location.pathname === '/manager/daily-report'

  // Tự động mở submenu khi đang ở trang lịch làm việc
  useEffect(() => {
    if (isWorkScheduleActive) {
      setWorkScheduleMenuOpen(true)
    }
  }, [isWorkScheduleActive])

  const loadAverageScore = async () => {
    try {
      setScoreLoading(true)
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      console.log('Loading average score for:', year, month)
      const response = await taskScoreService.getMyScoresByMonth(year, month)
      console.log('Score response:', response.data)
      const averageScore = response.data?.result?.averageScore
      console.log('Average score:', averageScore)
      setAverageScore(averageScore !== null && averageScore !== undefined ? averageScore : null)
    } catch (err) {
      console.error('Error loading average score:', err)
      console.error('Error details:', err.response?.data)
      setAverageScore(null)
    } finally {
      setScoreLoading(false)
    }
  }

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
                      ? 'bg-green-50 text-green-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${active ? 'text-green-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}

            {/* Lịch làm việc với submenu */}
            <div>
              <button
                onClick={() => setWorkScheduleMenuOpen(!workScheduleMenuOpen)}
                className={`
                  w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base
                  ${isWorkScheduleActive 
                    ? 'bg-green-50 text-green-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
                title={sidebarCollapsed ? 'Lịch làm việc' : ''}
              >
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <CalendarDaysIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${isWorkScheduleActive ? 'text-green-600' : 'text-gray-400'}`} />
                  {!sidebarCollapsed && <span>Lịch làm việc</span>}
                </div>
                {!sidebarCollapsed && (
                  workScheduleMenuOpen ? (
                    <ChevronDownIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  )
                )}
              </button>

              {/* Submenu */}
              {workScheduleMenuOpen && !sidebarCollapsed && (
                <div className="ml-2 sm:ml-4 mt-1 space-y-1">
                  {workScheduleSubMenu.map((subItem) => {
                    const subActive = location.pathname === subItem.href.split('?')[0] && 
                                     (location.search.includes('mode=register') && subItem.href.includes('mode=register') ||
                                      location.search.includes('mode=report') && subItem.href.includes('mode=report') ||
                                      !location.search && subItem.href.includes('mode=register'))
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        className={`
                          block px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm
                          ${subActive 
                            ? 'bg-green-100 text-green-700 font-medium' 
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

          {/* Score Display */}
          {!sidebarCollapsed && (
            <div className="p-2 sm:p-4 border-t border-gray-200">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Điểm:</span>
                  {scoreLoading ? (
                    <span className="text-sm text-gray-500">Đang tải...</span>
                  ) : averageScore !== null && averageScore !== undefined ? (
                    <span className="text-sm font-bold text-green-600">{averageScore.toFixed(2)}</span>
                  ) : (
                    <span className="text-sm text-gray-500">Chưa có</span>
                  )}
                </div>
                <button
                  onClick={() => setShowScoreHistory(true)}
                  className="text-xs text-green-600 hover:text-green-700 hover:underline flex items-center space-x-1"
                >
                  <ClockIcon className="h-4 w-4" />
                  <span>Lịch sử</span>
                </button>
              </div>
            </div>
          )}
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
                  {getCurrentUser()?.fullName || 'Manager'}
                </p>
                <p className="text-xs text-gray-500">Trưởng phòng</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Avatar size={10} className="border-2 border-green-600" />
                </button>
                {avatarMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setAvatarMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="py-1">
                        {/* Score Display */}
                        <div className="px-4 py-3 bg-green-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-700">Điểm:</span>
                              {scoreLoading ? (
                                <span className="text-sm text-gray-500">Đang tải...</span>
                              ) : averageScore !== null && averageScore !== undefined ? (
                                <span className="text-sm font-bold text-green-600">{averageScore.toFixed(2)}</span>
                              ) : (
                                <span className="text-sm text-gray-500">Chưa có</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setAvatarMenuOpen(false)
                                setShowScoreHistory(true)
                              }}
                              className="text-xs text-green-600 hover:text-green-700 hover:underline flex items-center space-x-1"
                            >
                              <ClockIcon className="h-4 w-4" />
                              <span>Lịch sử</span>
                            </button>
                          </div>
                        </div>
                        
                        <Link
                          to="/manager/profile"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <UserCircleIcon className="h-5 w-5 text-gray-400" />
                          <span>Hồ sơ cá nhân</span>
                        </Link>
                        <Link
                          to="/manager/notifications"
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

      {/* Score History Modal */}
      <ScoreHistoryModal 
        isOpen={showScoreHistory} 
        onClose={() => setShowScoreHistory(false)} 
      />
    </div>
  )
}

export default ManagerLayout

