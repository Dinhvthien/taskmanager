import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BellIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import notificationService from '../services/notificationService'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

const NotificationHistoryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'read', 'unread'
  const [deletingId, setDeletingId] = useState(null)

  const getBasePath = () => {
    const path = location.pathname || ''
    if (path.startsWith('/manager')) return '/manager'
    if (path.startsWith('/director')) return '/director'
    if (path.startsWith('/super-admin')) return '/super-admin'
    return '/user'
  }

  useEffect(() => {
    if (currentPage === 0) {
      loadNotifications()
    } else {
      setCurrentPage(0)
    }
  }, [filter])

  useEffect(() => {
    loadNotifications()
  }, [currentPage])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      setError('')
      // Load all pages to filter properly (or we can load page by page)
      // For now, load with larger size to get more data
      const response = await notificationService.getNotifications(0, 100)
      const result = response.data.result
      
      let allNotifications = result.content || []
      
      // If there are more pages, we might need to load them all
      // For simplicity, we'll just filter what we have
      // In production, you might want to add filter parameter to backend API
      
      // Apply filter
      let filteredNotifications = allNotifications
      if (filter === 'read') {
        filteredNotifications = allNotifications.filter(n => n.read)
      } else if (filter === 'unread') {
        filteredNotifications = allNotifications.filter(n => !n.read)
      }
      
      // Apply pagination manually
      const pageSize = 20
      const startIndex = currentPage * pageSize
      const endIndex = startIndex + pageSize
      const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex)
      
      setNotifications(paginatedNotifications)
      setTotalPages(Math.ceil(filteredNotifications.length / pageSize) || 1)
      setTotalElements(filteredNotifications.length)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách thông báo')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi đánh dấu đã đọc')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi đánh dấu tất cả đã đọc')
    }
  }

  const handleDelete = async (notificationId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      return
    }
    
    try {
      setDeletingId(notificationId)
      await notificationService.deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setTotalElements(prev => prev - 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xóa thông báo')
    } finally {
      setDeletingId(null)
    }
  }

  const parseNotificationData = (notification) => {
    if (!notification?.data) return {}
    try {
      if (typeof notification.data === 'object') return notification.data
      return JSON.parse(notification.data)
    } catch (e) {
      console.error('Error parsing notification data:', e)
      return {}
    }
  }

  const handleOpenNotification = (notification) => {
    const data = parseNotificationData(notification)
    const taskId = data.taskId
    const commentId = data.commentId

    if (!taskId) {
      return
    }

    const basePath = getBasePath()
    if (basePath === '/super-admin') {
      return
    }

    const targetPath = `${basePath}/tasks/${taskId}`

    navigate(targetPath, {
      state: commentId ? { focusCommentId: commentId } : undefined
    })
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
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return '📋'
      case 'TASK_STATUS_CHANGED':
        return '🔄'
      case 'TASK_COMPLETED':
        return '✅'
      case 'TASK_CREATED':
        return '✨'
      case 'TASK_PROGRESS_UPDATED':
        return '📊'
      case 'DAILY_REPORT_EVALUATED':
        return '📝'
      case 'COMMENT_REPLY':
        return '💬'
      case 'COMMENT_MENTION':
        return '👤'
      default:
        return '🔔'
    }
  }

  const getNotificationTypeLabel = (type) => {
    const typeMap = {
      'TASK_ASSIGNED': 'Task được giao',
      'TASK_STATUS_CHANGED': 'Task thay đổi trạng thái',
      'TASK_COMPLETED': 'Task hoàn thành',
      'TASK_CREATED': 'Task mới được tạo',
      'TASK_PROGRESS_UPDATED': 'Task cập nhật tiến độ',
      'DAILY_REPORT_EVALUATED': 'Báo cáo được đánh giá',
      'COMMENT_REPLY': 'Trả lời bình luận',
      'COMMENT_MENTION': 'Được nhắc đến'
    }
    return typeMap[type] || type
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử thông báo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tổng cộng: {totalElements} thông báo
            {unreadCount > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({unreadCount} chưa đọc)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckIcon className="h-5 w-5" />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Chưa đọc
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'read'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Đã đọc
        </button>
      </div>

      {/* Error Message */}
      {error && <ErrorMessage message={error} />}

      {/* Notifications List */}
      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <BellIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">
            {filter === 'all' 
              ? 'Chưa có thông báo nào' 
              : filter === 'unread' 
              ? 'Không có thông báo chưa đọc' 
              : 'Không có thông báo đã đọc'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleOpenNotification(notification)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 flex items-start gap-3">
                    <span className="text-2xl mt-1">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                            Mới
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {getNotificationTypeLabel(notification.type)}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-xs text-gray-400">
                          {formatDate(notification.createdAt)}
                        </p>
                        {notification.readAt && (
                          <p className="text-xs text-gray-400">
                            Đã đọc: {formatDate(notification.readAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!notification.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMarkAsRead(notification.id)
                      }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Đánh dấu đã đọc"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(notification.id)
                      }}
                      disabled={deletingId === notification.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Xóa thông báo"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Trước
          </button>
          <span className="px-4 py-2 text-gray-700">
            Trang {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  )
}

export default NotificationHistoryPage

