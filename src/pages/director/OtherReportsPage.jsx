import { useState, useEffect } from 'react'
import { reportService } from '../../services/reportService'
import { departmentService } from '../../services/departmentService'
import { directorService } from '../../services/directorService'
import ErrorMessage from '../../components/ErrorMessage'

const OtherReportsPage = () => {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    departmentId: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const response = await directorService.getMyDirector()
      const director = response.data.result
      if (director) {
        const deptResponse = await departmentService.getDepartmentsByDirectorId(director.directorId)
        setDepartments(deptResponse.data.result || [])
      }
    } catch (err) {
      console.error('Error loading departments:', err)
    }
  }

  const handleExportTasks = async () => {
    try {
      setLoading(true)
      setError('')
      const params = {
        departmentId: formData.departmentId ? parseInt(formData.departmentId) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined
      }
      const response = await reportService.exportTasksReport(
        params.departmentId,
        params.startDate,
        params.endDate
      )
      
      // Tạo blob và download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tasks_report_${new Date().getTime()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi export báo cáo tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleExportDepartmentPerformance = async () => {
    try {
      setLoading(true)
      setError('')
      const params = {
        departmentId: formData.departmentId ? parseInt(formData.departmentId) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined
      }
      const response = await reportService.exportDepartmentPerformanceReport(
        params.departmentId,
        params.startDate,
        params.endDate
      )
      
      // Tạo blob và download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `department_performance_report_${new Date().getTime()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi export báo cáo hiệu suất phòng ban')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Báo cáo khác</h1>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phòng ban (tùy chọn)
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Tất cả phòng ban --</option>
                {departments.map((dept) => (
                  <option key={dept.departmentId} value={dept.departmentId}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Từ ngày
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đến ngày
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Xuất báo cáo</h2>
          <div className="space-y-4">
            <button
              onClick={handleExportTasks}
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang xuất...' : 'Xuất báo cáo Tasks'}
            </button>
            <button
              onClick={handleExportDepartmentPerformance}
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-0 md:ml-4"
            >
              {loading ? 'Đang xuất...' : 'Xuất báo cáo Hiệu suất Phòng ban'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OtherReportsPage

