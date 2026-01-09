import api from './api'

export const taskScoreService = {
  // Lấy điểm số của user hiện tại
  getMyScores: () => {
    return api.get('/task-scores/my-scores')
  },

  // Lấy điểm trung bình của user hiện tại
  getMyAverageScore: () => {
    return api.get('/task-scores/my-average')
  },

  // Lấy điểm số của user hiện tại theo tháng
  getMyScoresByMonth: (year, month) => {
    return api.get('/task-scores/my-scores/month', {
      params: { year, month }
    })
  },

  // Lấy điểm số của user cụ thể
  getScoresByUserId: (userId) => {
    return api.get(`/task-scores/user/${userId}`)
  },

  // Lấy điểm số của user cụ thể theo tháng
  getScoresByUserIdAndMonth: (userId, year, month) => {
    return api.get(`/task-scores/user/${userId}/month`, {
      params: { year, month }
    })
  },

  // Lấy điểm số của task cụ thể
  getScoreByTaskId: (taskId) => {
    return api.get(`/task-scores/task/${taskId}`)
  },

  // Lấy danh sách công việc phát sinh bị từ chối theo tháng
  getMyRejectedAdHocTasksByMonth: (year, month) => {
    return api.get('/task-scores/my-rejected-ad-hoc-tasks/month', {
      params: { year, month }
    })
  }
}

