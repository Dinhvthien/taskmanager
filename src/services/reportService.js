import api from './api'

export const reportService = {
  // Export tasks report
  exportTasksReport: (departmentId, startDate, endDate) => {
    return api.get('/reports/tasks/export', {
      params: {
        departmentId,
        startDate,
        endDate
      },
      responseType: 'blob' // Để download file
    })
  },

  // Export department performance report
  exportDepartmentPerformanceReport: (departmentId, startDate, endDate) => {
    return api.get('/reports/departments/performance/export', {
      params: {
        departmentId,
        startDate,
        endDate
      },
      responseType: 'blob'
    })
  },

  // Export user report
  exportUserReport: (userId, startDate, endDate) => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    return api.get(`/reports/users/${userId}/export`, {
      params,
      responseType: 'blob'
    })
  },

  // Export department report
  exportDepartmentReport: (departmentId, startDate, endDate) => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    return api.get(`/reports/departments/${departmentId}/export`, {
      params,
      responseType: 'blob'
    })
  },

  // Export employee monthly report
  exportEmployeeMonthlyReport: (userId, startDate, endDate) => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    return api.get(`/reports/employees/${userId}/monthly-export`, {
      params,
      responseType: 'blob'
    })
  },

  // Export all employees monthly report
  exportAllEmployeesMonthlyReport: (startDate, endDate) => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    return api.get('/reports/employees/all/monthly-export', {
      params,
      responseType: 'blob'
    })
  }
}

