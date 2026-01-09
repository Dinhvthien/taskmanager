import api from './api'

export const userService = {
  // Lấy thông tin user hiện tại
  getCurrentUser: () => {
    return api.get('/users/me')
  },

  // Lấy user theo ID
  getUserById: (userId) => {
    return api.get(`/users/${userId}`)
  },

  // Lấy tất cả users (có phân trang)
  getAllUsers: (page = 0, size = 20) => {
    return api.get('/users', {
      params: { page, size }
    })
  },

  // Lấy users theo director ID
  getUsersByDirectorId: (directorId, page = 0, size = 20) => {
    return api.get(`/users/director/${directorId}`, {
      params: { page, size }
    })
  },

  // Tạo user mới
  createUser: (data) => {
    return api.post('/users', data)
  },

  // Cập nhật user
  updateUser: (userId, data) => {
    return api.put(`/users/${userId}`, data)
  },

  // Gán role cho user
  assignRole: (userId, roleName) => {
    return api.put(`/users/${userId}/roles/${roleName}`)
  },

  // Xóa role của user
  removeRole: (userId, roleName) => {
    return api.delete(`/users/${userId}/roles/${roleName}`)
  },

  // Xóa user
  deleteUser: (userId) => {
    return api.delete(`/users/${userId}`)
  },

  // Upload avatar
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // Get avatar URL
  getAvatarUrl: (userId) => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
    return `${baseURL}/users/${userId}/avatar`
  }
}

