import api from './api'

export const taskService = {
  // Tạo task mới
  createTask: (data) => {
    return api.post('/tasks', data)
  },

  // Lấy task theo ID
  getTaskById: (taskId) => {
    return api.get(`/tasks/${taskId}`)
  },

  // Lấy tasks theo director ID (có phân trang)
  getTasksByDirectorId: (directorId, page = 0, size = 20) => {
    return api.get(`/tasks/director/${directorId}`, {
      params: { page, size }
    })
  },

  // Lấy tasks của user hiện tại
  getMyTasks: () => {
    return api.get('/tasks/user/me')
  },

  // Lấy tasks theo department ID
  getTasksByDepartmentId: (departmentId) => {
    return api.get(`/tasks/department/${departmentId}`)
  },

  // Cập nhật task
  updateTask: (taskId, data) => {
    return api.put(`/tasks/${taskId}`, data)
  },

  // Gán task cho users
  assignTask: (data) => {
    return api.post('/tasks/assign', data)
  },

  // Xác nhận task hoàn thành
  confirmTask: (taskId) => {
    return api.post(`/tasks/${taskId}/confirm`)
  },

  // Lấy comments của task
  getTaskComments: (taskId, page = 0, size = 50) => {
    return api.get(`/tasks/${taskId}/comments`, {
      params: { page, size }
    })
  },

  // Tạo comment
  createComment: (taskId, data) => {
    return api.post(`/tasks/${taskId}/comments`, data)
  },

  // Lấy evaluation của task
  getTaskEvaluation: (taskId) => {
    return api.get(`/tasks/${taskId}/evaluations`)
  },

  // Tạo evaluation
  createEvaluation: (taskId, data) => {
    return api.post(`/tasks/${taskId}/evaluations`, data)
  },

  // Xác nhận nhận task (PENDING -> ACCEPTED)
  acceptTask: (taskId, departmentId) => {
    return api.post(`/tasks/${taskId}/accept`, {
      departmentId
    })
  },

  // Cập nhật trạng thái phòng ban
  updateDepartmentStatus: (taskId, data) => {
    return api.put(`/tasks/${taskId}/department-status`, data)
  },

  // Lấy lịch sử thay đổi của task
  getTaskHistory: (taskId) => {
    return api.get(`/tasks/${taskId}/history`)
  },

  // Lấy danh sách recurring tasks theo director ID
  getRecurringTasksByDirectorId: (directorId) => {
    return api.get(`/recurring-tasks/director/${directorId}`)
  },

  // Dừng recurring task
  deactivateRecurringTask: (recurringTaskId) => {
    return api.put(`/recurring-tasks/${recurringTaskId}/deactivate`)
  },

  // Kích hoạt lại recurring task
  activateRecurringTask: (recurringTaskId) => {
    return api.put(`/recurring-tasks/${recurringTaskId}/activate`)
  },

  // Xóa task (soft delete)
  deleteTask: (taskId) => {
    return api.delete(`/tasks/${taskId}`)
  },

  // Xóa recurring task (soft delete)
  deleteRecurringTask: (recurringTaskId) => {
    return api.delete(`/recurring-tasks/${recurringTaskId}`)
  },

  // Cập nhật recurring task
  updateRecurringTask: (recurringTaskId, data) => {
    return api.put(`/recurring-tasks/${recurringTaskId}`, data)
  }
}

