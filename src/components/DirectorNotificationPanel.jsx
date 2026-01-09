import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, UserIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import notificationService from '../services/notificationService'
import dailyReportService from '../services/dailyReportService'

const DirectorNotificationPanel = () => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [employeeReportsExpanded, setEmployeeReportsExpanded] = useState(false)
  const [departmentReportsExpanded, setDepartmentReportsExpanded] = useState(false)
  const [employeeReports, setEmployeeReports] = useState([])
  const [departmentReports, setDepartmentReports] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const panelRef = useRef(null)
  const today = new Date().toISOString().split('T')[0]
  const pageSize = 10 // Số thông báo mỗi trang

  useEffect(() => {
    loadUnreadCount()
    
    // Polling để cập nhật số lượng thông báo chưa đọc
    const interval = setInterval(() => {
      loadUnreadCount()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPage])

  // Đóng panel khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadUnreadCount = async () => {
    try {
      const response = await notificationService.getUnreadCount()
      setUnreadCount(response.data.result || 0)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading unread count:', err)
      }
    }
  }

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await notificationService.getNotifications(currentPage, pageSize)
      const result = response.data.result
      const notificationsList = result?.content || []
      setNotifications(notificationsList)
      setTotalPages(result?.totalPages || 1)
      setTotalElements(result?.totalElements || 0)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading notifications:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadEmployeeReports = async () => {
    try {
      setLoadingEmployees(true)
      const response = await dailyReportService.getEmployeesWithReportsByDate(today)
      setEmployeeReports(response.data.result || [])
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading employee reports:', err)
      }
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadDepartmentReports = async () => {
    try {
      setLoadingDepartments(true)
      const response = await dailyReportService.getDepartmentsWithReportsByDate(today)
      setDepartmentReports(response.data.result || [])
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading department reports:', err)
      }
    } finally {
      setLoadingDepartments(false)
    }
  }

  const handleTogglePanel = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setCurrentPage(0) // Reset về trang đầu khi mở panel
    }
  }

  const handleToggleEmployeeReports = () => {
    const newState = !employeeReportsExpanded
    setEmployeeReportsExpanded(newState)
    if (newState && employeeReports.length === 0) {
      loadEmployeeReports()
    }
  }

  const handleToggleDepartmentReports = () => {
    const newState = !departmentReportsExpanded
    setDepartmentReportsExpanded(newState)
    if (newState && departmentReports.length === 0) {
      loadDepartmentReports()
    }
  }

  const handleEmployeeClick = (employee) => {
    // Navigate to employee reports page with pre-filled search
    navigate(`/director/reports/employees?userId=${employee.userId}&date=${today}`)
    setIsOpen(false)
  }

  const handleDepartmentClick = (department) => {
    // Navigate to department reports page with pre-filled search
    navigate(`/director/reports/departments?departmentId=${department.departmentId}&date=${today}`)
    setIsOpen(false)
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error marking notification as read:', err)
      }
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error marking all as read:', err)
      }
    }
  }

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId)
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting notification:', err)
      }
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Vừa xong'
    if (minutes < 60) return `${minutes} phút trước`
    if (hours < 24) return `${hours} giờ trước`
    if (days < 7) return `${days} ngày trước`
    return date.toLocaleDateString('vi-VN')
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return '📋'
      case 'TASK_STATUS_CHANGED':
        return '🔄'
      case 'TASK_COMPLETED':
        return '✅'
      case 'DAILY_REPORT_EVALUATED':
        return '📊'
      case 'DAILY_REPORT_CREATED':
        return '📝'
      case 'COMMENT_REPLY':
        return '💬'
      case 'COMMENT_MENTION':
        return '👤'
      default:
        return '🔔'
    }
  }

  const parseNotificationData = (notification) => {
    if (!notification?.data) return {}
    try {
      if (typeof notification.data === 'object') return notification.data
      return JSON.parse(notification.data)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error parsing notification data:', e)
      }
      return {}
    }
  }

  const handleNavigateToDetail = (notification) => {
    const data = parseNotificationData(notification)
    
    // Xử lý navigation cho DAILY_REPORT_CREATED
    if (notification.type === 'DAILY_REPORT_CREATED') {
      const userId = data.userId
      const reportDate = data.reportDate || today
      
      if (userId) {
        navigate(`/director/reports/employees?userId=${userId}&date=${reportDate}`)
      } else {
        // Nếu không có userId, điều hướng đến trang danh sách báo cáo nhân viên
        navigate('/director/reports/employees')
      }
      
      // Đánh dấu đã đọc nếu chưa đọc
      if (!notification.read) {
        handleMarkAsRead(notification.id)
      }
      
      setIsOpen(false)
      return
    }
    
    // Xử lý navigation cho các notification khác (task-related)
    const taskId = data.taskId
    const commentId = data.commentId

    if (!taskId) {
      return
    }

    const targetPath = `/director/tasks/${taskId}`

    // Điều hướng tới trang chi tiết task, truyền commentId để focus
    navigate(targetPath, {
      state: commentId ? { focusCommentId: commentId } : undefined
    })

    // Đánh dấu đã đọc nếu chưa đọc
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }

    setIsOpen(false)
  }

  const reportedEmployees = employeeReports.filter(emp => emp.hasReported)
  const reportedDepartments = departmentReports.filter(dept => dept.hasReported)

  return (
    <div className="relative" ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        onClick={handleTogglePanel}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[calc(100vh-8rem)] sm:max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Thông báo {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-700"
                >
                  <span className="hidden sm:inline">Đánh dấu tất cả đã đọc</span>
                  <span className="sm:hidden">Đã đọc</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Báo cáo của nhân viên */}
            <div className="border-b border-gray-200">
              <button
                onClick={handleToggleEmployeeReports}
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-gray-900 text-sm sm:text-base">Báo cáo của nhân viên theo ngày</span>
                </div>
                {employeeReportsExpanded ? (
                  <ChevronUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {employeeReportsExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  {loadingEmployees ? (
                    <div className="text-center text-gray-500 py-4">Đang tải...</div>
                  ) : reportedEmployees.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4">Chưa có nhân viên nào báo cáo hôm nay</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {reportedEmployees.map((employee) => (
                        <button
                          key={employee.userId}
                          onClick={() => handleEmployeeClick(employee)}
                          className="w-full text-left p-3 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{employee.fullName}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Báo cáo phòng ban */}
            <div className="border-b border-gray-200">
              <button
                onClick={handleToggleDepartmentReports}
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="font-medium text-gray-900 text-sm sm:text-base">Báo cáo phòng ban</span>
                </div>
                {departmentReportsExpanded ? (
                  <ChevronUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {departmentReportsExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  {loadingDepartments ? (
                    <div className="text-center text-gray-500 py-4">Đang tải...</div>
                  ) : reportedDepartments.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4">Chưa có phòng ban nào báo cáo hôm nay</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {reportedDepartments.map((department) => (
                        <button
                          key={department.departmentId}
                          onClick={() => handleDepartmentClick(department)}
                          className="w-full text-left p-3 rounded-lg hover:bg-green-50 border border-gray-200 hover:border-green-300 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{department.departmentName}</div>
                          {department.managerName && (
                            <div className="text-xs text-gray-500">{department.managerName} ({department.managerEmail})</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Regular Notifications */}
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500">
                <BellIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm sm:text-base">Không có thông báo nào</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNavigateToDetail(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="text-lg sm:text-xl flex-shrink-0">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'} line-clamp-1`}>
                              {notification.title}
                            </p>
                            {notification.message && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(notification.id)
                          }}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <XMarkIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>

                {/* Phân trang */}
                {totalPages > 1 && (
                  <div className="border-t border-gray-200 p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        Trang {currentPage + 1} / {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentPage(prev => Math.max(0, prev - 1))
                          }}
                          disabled={currentPage === 0}
                          className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Trước
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))
                          }}
                          disabled={currentPage >= totalPages - 1}
                          className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DirectorNotificationPanel

