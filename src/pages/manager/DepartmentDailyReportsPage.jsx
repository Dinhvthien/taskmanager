import { useState, useEffect } from 'react'
import { departmentService } from '../../services/departmentService'
import dailyReportService from '../../services/dailyReportService'
import { getCurrentUser } from '../../utils/auth'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'

const DepartmentDailyReportsPage = () => {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [evaluation, setEvaluation] = useState({
    rating: '',
    comment: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    if (selectedDepartment && reportDate) {
      loadSummary()
    }
  }, [selectedDepartment, reportDate])

  const loadDepartments = async () => {
    try {
      const user = getCurrentUser()
      if (!user) return

      const response = await departmentService.getDepartmentsByManagerId(user.userId)
      const depts = response.data.result || []
      setDepartments(depts)
      if (depts.length > 0) {
        setSelectedDepartment(depts[0].departmentId)
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách phòng ban')
    }
  }

  const loadSummary = async () => {
    if (!selectedDepartment) return

    try {
      setLoading(true)
      setError('')
      const response = await dailyReportService.getDepartmentDailyReportSummary(
        selectedDepartment,
        reportDate
      )
      setSummary(response.data.result)
      
      // Load đánh giá hiện tại (nếu có)
      if (response.data.result?.evaluation) {
        setEvaluation({
          rating: response.data.result.evaluation.rating || '',
          comment: response.data.result.evaluation.comment || ''
        })
      } else {
        setEvaluation({ rating: '', comment: '' })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải tổng hợp báo cáo')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEvaluation = async () => {
    if (!selectedDepartment) return

    try {
      setSaving(true)
      setError('')
      
      await dailyReportService.saveDepartmentEvaluation(selectedDepartment, {
        date: reportDate,
        rating: evaluation.rating || null,
        comment: evaluation.comment || ''
      })
      
      // Reload summary
      await loadSummary()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi lưu đánh giá')
    } finally {
      setSaving(false)
    }
  }

  const getRatingLabel = (rating) => {
    const ratingMap = {
      'EXCELLENT': 'Xuất sắc',
      'GOOD': 'Tốt',
      'AVERAGE': 'Trung bình',
      'POOR': 'Kém'
    }
    return ratingMap[rating] || rating
  }

  const getPriorityLabel = (priority) => {
    const priorityMap = {
      'HIGH': 'Cao',
      'MEDIUM': 'Trung bình',
      'LOW': 'Thấp'
    }
    return priorityMap[priority] || priority
  }

  const getRatingColor = (rating) => {
    const colorMap = {
      'EXCELLENT': 'bg-green-100 text-green-800 border-green-300',
      'GOOD': 'bg-blue-100 text-blue-800 border-blue-300',
      'AVERAGE': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'POOR': 'bg-red-100 text-red-800 border-red-300'
    }
    return colorMap[rating] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getPriorityColor = (priority) => {
    const colorMap = {
      'HIGH': 'bg-red-100 text-red-800 border-red-300',
      'MEDIUM': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'LOW': 'bg-green-100 text-green-800 border-green-300'
    }
    return colorMap[priority] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Không có phòng ban nào</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Báo cáo phòng ban</h1>

      {error && <ErrorMessage message={error} />}

      {/* Chọn phòng ban và ngày */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phòng ban
            </label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {departments.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ngày báo cáo
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : summary ? (
        <div className="space-y-6">
          {/* Tổng hợp báo cáo nhân viên */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Báo cáo của nhân viên ({summary.employeeReports?.length || 0} nhân viên)
            </h2>
            
            {summary.employeeReports && summary.employeeReports.length > 0 ? (
              <div className="space-y-4">
                {summary.employeeReports.map((employee) => (
                  <div key={employee.userId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{employee.fullName}</h3>
                        <p className="text-sm text-gray-500">@{employee.userName}</p>
                      </div>
                      {employee.report ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          Đã báo cáo
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                          Chưa báo cáo
                        </span>
                      )}
                    </div>

                    {employee.report && (
                      <div className="mt-4 space-y-3">
                        {/* Công việc đã chọn */}
                        {employee.report.selectedTasks && employee.report.selectedTasks.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Công việc đã báo cáo ({employee.report.selectedTasks.length})
                            </h4>
                            <div className="space-y-2">
                              {employee.report.selectedTasks.map((task) => (
                                <div key={task.taskId} className="bg-gray-50 rounded p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{task.title}</p>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                      )}
                                    </div>
                                    <div className="ml-4 flex items-center gap-2">
                                      {task.priority && (
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                          Mức độ: {getPriorityLabel(task.priority)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {task.comment && (
                                    <p className="text-sm text-gray-600 mt-2 italic">"{task.comment}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Công việc phát sinh */}
                        {employee.report.adHocTasks && employee.report.adHocTasks.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Công việc phát sinh ({employee.report.adHocTasks.length})
                            </h4>
                            <div className="space-y-2">
                              {employee.report.adHocTasks.map((adHocTask) => (
                                <div key={adHocTask.id} className="bg-blue-50 rounded p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{adHocTask.content}</p>
                                    </div>
                                    <div className="ml-4">
                                      {adHocTask.priority && (
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(adHocTask.priority)}`}>
                                          Mức độ: {getPriorityLabel(adHocTask.priority)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {adHocTask.comment && (
                                    <p className="text-sm text-gray-600 mt-2 italic">"{adHocTask.comment}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Không có nhân viên nào trong phòng ban</p>
            )}
          </div>

          {/* Đánh giá và ghi chú của Manager */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Đánh giá và ghi chú phòng ban
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đánh giá
                </label>
                <select
                  value={evaluation.rating}
                  onChange={(e) => setEvaluation({ ...evaluation, rating: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Chọn đánh giá --</option>
                  <option value="EXCELLENT">Xuất sắc</option>
                  <option value="GOOD">Tốt</option>
                  <option value="AVERAGE">Trung bình</option>
                  <option value="POOR">Kém</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú
                </label>
                <textarea
                  value={evaluation.comment}
                  onChange={(e) => setEvaluation({ ...evaluation, comment: e.target.value })}
                  placeholder="Nhập ghi chú về phòng ban trong ngày..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveEvaluation}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Đang lưu...' : 'Lưu đánh giá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DepartmentDailyReportsPage

