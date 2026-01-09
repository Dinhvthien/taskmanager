import api from './api'

const notificationService = {
  // Lấy danh sách thông báo (có phân trang)
  getNotifications: (page = 0, size = 20) => {
    return api.get('/notifications', {
      params: { page, size }
    })
  },
  
  // Lấy số lượng thông báo chưa đọc
  getUnreadCount: () => {
    return api.get('/notifications/unread-count')
  },
  
  // Lấy danh sách thông báo chưa đọc
  getUnreadNotifications: () => {
    return api.get('/notifications/unread')
  },
  
  // Đánh dấu một thông báo là đã đọc
  markAsRead: (notificationId) => {
    return api.put(`/notifications/${notificationId}/read`)
  },
  
  // Đánh dấu tất cả thông báo là đã đọc
  markAllAsRead: () => {
    return api.put('/notifications/read-all')
  },
  
  // Xóa một thông báo
  deleteNotification: (notificationId) => {
    return api.delete(`/notifications/${notificationId}`)
  }
}

export default notificationService

