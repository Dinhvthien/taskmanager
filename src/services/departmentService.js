import api from './api'

export const departmentService = {
  // Tạo department mới
  createDepartment: (data) => {
    return api.post('/departments', data)
  },

  // Lấy department theo ID
  getDepartmentById: (departmentId) => {
    return api.get(`/departments/${departmentId}`)
  },

  // Lấy departments theo director ID
  getDepartmentsByDirectorId: (directorId) => {
    return api.get(`/departments/director/${directorId}`)
  },

  // Lấy departments theo manager ID
  getDepartmentsByManagerId: (managerId) => {
    return api.get(`/departments/manager/${managerId}`)
  },

  // Cập nhật department
  updateDepartment: (departmentId, data) => {
    return api.put(`/departments/${departmentId}`, data)
  },

  // Thêm user vào department
  addUserToDepartment: (departmentId, userId) => {
    return api.post(`/departments/${departmentId}/users/${userId}`)
  },

  // Xóa user khỏi department
  removeUserFromDepartment: (departmentId, userId) => {
    return api.delete(`/departments/${departmentId}/users/${userId}`)
  },

  // Lấy departments theo user ID
  getDepartmentsByUserId: (userId) => {
    return api.get(`/departments/user/${userId}`)
  },

  // Lấy users trong department (chỉ userIds)
  getUsersByDepartmentId: (departmentId) => {
    return api.get(`/departments/${departmentId}/users`)
  },

  // Lấy users trong department với thông tin đầy đủ
  getUsersWithDetailsByDepartmentId: (departmentId) => {
    return api.get(`/departments/${departmentId}/users/details`)
  },

  // Xóa department (soft delete)
  deleteDepartment: (departmentId) => {
    return api.delete(`/departments/${departmentId}`)
  }
}

