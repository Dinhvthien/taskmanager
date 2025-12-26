import api from './api'

export const directorService = {
  // Tạo director mới
  createDirector: (data) => {
    return api.post('/directors', data)
  },

  // Lấy director theo ID
  getDirectorById: (directorId) => {
    return api.get(`/directors/${directorId}`)
  },

  // Lấy director của user hiện tại
  getMyDirector: () => {
    return api.get('/directors/me')
  },

  // Lấy tất cả directors
  getAllDirectors: () => {
    return api.get('/directors')
  },

  // Cập nhật director
  updateDirector: (directorId, data) => {
    return api.put(`/directors/${directorId}`, data)
  },

  // Thêm user vào director (công ty)
  addUserToDirector: (directorId, userId) => {
    return api.post(`/directors/${directorId}/users/${userId}`)
  },

  // Xóa user khỏi director (công ty)
  removeUserFromDirector: (directorId, userId) => {
    return api.delete(`/directors/${directorId}/users/${userId}`)
  }
}

