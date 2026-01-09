import api from './api'

const dailyReportService = {
  // Tạo báo cáo cuối ngày
  createDailyReport: (data) => {
    return api.post('/daily-reports', data)
  },

  // Lấy báo cáo theo ID
  getDailyReportById: (reportId) => {
    return api.get(`/daily-reports/${reportId}`)
  },

  // Lấy tất cả báo cáo của tôi
  getMyDailyReports: () => {
    return api.get('/daily-reports/my-reports')
  },

  // Lấy báo cáo theo khoảng thời gian
  getMyDailyReportsByDateRange: (startDate, endDate) => {
    return api.get('/daily-reports/my-reports/range', {
      params: {
        startDate,
        endDate
      }
    })
  },

  // Xóa báo cáo
  deleteDailyReport: (reportId) => {
    return api.delete(`/daily-reports/${reportId}`)
  },

  // Cập nhật comment cho báo cáo cuối ngày
  updateDailyReportComments: (reportId, data) => {
    return api.put(`/daily-reports/${reportId}/comments`, data)
  },

  // Lấy tổng hợp báo cáo phòng ban
  getDepartmentDailyReportSummary: (departmentId, date) => {
    return api.get(`/daily-reports/department/${departmentId}/summary`, {
      params: { date }
    })
  },

  // Lưu đánh giá phòng ban
  saveDepartmentEvaluation: (departmentId, data) => {
    return api.post(`/daily-reports/department/${departmentId}/evaluation`, data)
  },

  // Lấy báo cáo của một user cụ thể theo ngày (cho Director)
  getDailyReportByUserId: (userId, date) => {
    return api.get(`/daily-reports/user/${userId}`, {
      params: { date }
    })
  },
  
  // Lấy danh sách nhân viên đã báo cáo trong ngày (cho Director)
  getEmployeesWithReportsByDate: (date) => {
    return api.get('/daily-reports/director/employees-summary', {
      params: { date }
    })
  },
  
  // Lấy danh sách phòng ban đã báo cáo trong ngày (cho Director)
  getDepartmentsWithReportsByDate: (date) => {
    return api.get('/daily-reports/director/departments-summary', {
      params: { date }
    })
  },
  
  // Lấy tất cả công việc phát sinh chưa được duyệt (cho Director)
  getPendingAdHocTasks: () => {
    return api.get('/daily-reports/director/ad-hoc-tasks')
  }
}

export const directorEvaluationService = {
  // Lưu đánh giá của giám đốc cho một task trong báo cáo nhân viên
  saveTaskEvaluation: (reportId, data) => {
    return api.post(`/director-evaluations/reports/${reportId}/tasks`, data)
  },
  
  // Lưu đánh giá của giám đốc cho một công việc phát sinh trong báo cáo nhân viên
  saveAdHocTaskEvaluation: (reportId, data) => {
    return api.post(`/director-evaluations/reports/${reportId}/ad-hoc-tasks`, data)
  },
  
  // Lưu đánh giá của giám đốc cho báo cáo phòng ban
  saveDepartmentEvaluation: (departmentId, reportDate, data) => {
    return api.post(`/director-evaluations/departments/${departmentId}`, data, {
      params: { reportDate }
    })
  }
}

export default dailyReportService


