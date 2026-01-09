import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { departmentService } from '../../services/departmentService'
import { directorService } from '../../services/directorService'
import dailyReportService, { directorEvaluationService } from '../../services/dailyReportService'
import { userService } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'

const DepartmentReportsPage = () => {
  const getRatingLabel = (rating) => {
    const ratingMap = {
      'EXCELLENT': 'Xuất sắc',
      'GOOD': 'Tốt',
      'AVERAGE': 'Trung bình',
      'POOR': 'Kém'
    }
    return ratingMap[rating] || rating
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [filteredDepartments, setFilteredDepartments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [managerEmail, setManagerEmail] = useState('')
  const [directorEvaluation, setDirectorEvaluation] = useState({ rating: '', comment: '' })
  const [savingDirectorEvaluation, setSavingDirectorEvaluation] = useState(false)

  useEffect(() => {
    const departmentIdParam = searchParams.get('departmentId')
    const dateParam = searchParams.get('date')
    
    if (dateParam) {
      setReportDate(dateParam)
    }
    
    loadDepartments().then(() => {
      // After departments are loaded, check URL params
      if (departmentIdParam) {
        const departmentId = parseInt(departmentIdParam)
        setSelectedDepartment(departmentId)
        // Find department and set search query
        setTimeout(() => {
          const dept = departments.find(d => d.departmentId === departmentId)
          if (dept) {
            setSearchQuery(`${dept.departmentName} - ${dept.managerName || ''}`)
          }
        }, 100)
      }
    })
  }, [])
  
  useEffect(() => {
    // Update selected department when departments are loaded and URL has departmentId param
    const departmentIdParam = searchParams.get('departmentId')
    if (departmentIdParam && departments.length > 0) {
      const departmentId = parseInt(departmentIdParam)
      const dept = departments.find(d => d.departmentId === departmentId)
      if (dept && !selectedDepartment) {
        setSelectedDepartment(departmentId)
        setSearchQuery(`${dept.departmentName} - ${dept.managerName || ''}`)
      }
    }
  }, [departments])

  useEffect(() => {
    if (selectedDepartment && reportDate) {
      loadSummary()
    }
  }, [selectedDepartment, reportDate])

  useEffect(() => {
    // Fetch manager email when department is selected
    const fetchManagerEmail = async () => {
      if (selectedDepartment) {
        const dept = departments.find(d => d.departmentId === selectedDepartment)
        if (dept && dept.managerId) {
          try {
            const response = await userService.getUserById(dept.managerId)
            setManagerEmail(response.data.result?.email || '')
          } catch (err) {
            setManagerEmail('')
          }
        } else {
          setManagerEmail('')
        }
      }
    }
    fetchManagerEmail()
  }, [selectedDepartment, departments])

  useEffect(() => {
    // Filter departments based on search query
    if (!searchQuery.trim()) {
      setFilteredDepartments(departments)
    } else {
      const query = searchQuery.toLowerCase().trim()
      const filtered = departments.filter(dept => {
        const deptName = (dept.departmentName || '').toLowerCase()
        const managerName = (dept.managerName || '').toLowerCase()
        return deptName.includes(query) || managerName.includes(query)
      })
      setFilteredDepartments(filtered)
    }
  }, [searchQuery, departments])

  const loadDepartments = async () => {
    try {
      const response = await directorService.getMyDirector()
      const director = response.data.result
      if (director) {
        const deptResponse = await departmentService.getDepartmentsByDirectorId(director.directorId)
        const deptList = deptResponse.data.result || []
        setDepartments(deptList)
        setFilteredDepartments(deptList)
        const departmentIdParam = searchParams.get('departmentId')
        if (!departmentIdParam && deptList.length > 0) {
          setSelectedDepartment(deptList[0].departmentId)
        }
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách phòng ban')
    }
    return Promise.resolve()
  }

  const handleSelectDepartment = (dept) => {
    setSelectedDepartment(dept.departmentId)
    setSearchQuery('')
    setShowDropdown(false)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowDropdown(true)
    if (!value.trim()) {
      setSelectedDepartment(null)
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
      
      // TODO: Load đánh giá của giám đốc nếu có (cần thêm API)
      // Tạm thời reset
      setDirectorEvaluation({ rating: '', comment: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải tổng hợp báo cáo')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDirectorEvaluation = async () => {
    if (!selectedDepartment || !directorEvaluation.rating) {
      setError('Vui lòng chọn đánh giá')
      return
    }

    try {
      setSavingDirectorEvaluation(true)
      setError('')
      
      await directorEvaluationService.saveDepartmentEvaluation(
        selectedDepartment,
        reportDate,
        {
          rating: directorEvaluation.rating,
          comment: directorEvaluation.comment || ''
        }
      )
      
      // Reload summary
      await loadSummary()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi lưu đánh giá')
    } finally {
      setSavingDirectorEvaluation(false)
    }
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
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm kiếm và chọn phòng ban
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Nhập tên phòng ban hoặc tên trưởng phòng để tìm kiếm..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {showDropdown && filteredDepartments.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredDepartments.map((dept) => (
                  <div
                    key={dept.departmentId}
                    onClick={() => handleSelectDepartment(dept)}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-gray-900">
                      <span className="font-medium">{dept.departmentName}</span>
                      {dept.managerName && (
                        <span className="text-sm text-gray-500 ml-2">- {dept.managerName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showDropdown && filteredDepartments.length === 0 && searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <div className="px-4 py-2 text-sm text-red-500">
                  Không tìm thấy phòng ban nào
                </div>
              </div>
            )}
            {searchQuery && !selectedDepartment && (
              <p className="mt-1 text-sm text-gray-500">
                Tìm thấy {filteredDepartments.length} phòng ban
              </p>
            )}
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
      ) : summary ? (() => {
        const selectedDept = departments.find(d => d.departmentId === selectedDepartment)
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Tổng hợp báo cáo phòng ban: {summary.departmentName}
              {selectedDept?.managerName && (
                <span className="text-lg font-normal text-gray-600 ml-2">
                  - {selectedDept.managerName}
                  {managerEmail && ` (${managerEmail})`}
                </span>
              )}
            </h2>
          
          {/* Đánh giá của Manager */}
          {summary.evaluation && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Đánh giá của Manager</h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Đánh giá:</span> {getRatingLabel(summary.evaluation.rating)}
              </p>
              {summary.evaluation.comment && (
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-medium">Ghi chú:</span> {summary.evaluation.comment}
                </p>
              )}
            </div>
          )}

          {/* Báo cáo của nhân viên */}
          {summary.employeeReports && summary.employeeReports.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">
                Báo cáo của nhân viên ({summary.employeeReports.length})
              </h3>
              {summary.employeeReports.map((employee) => (
                <div key={employee.userId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{employee.fullName}</h4>
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
                    <div className="mt-3 text-sm text-gray-600">
                      <p>Công việc đã báo cáo: {employee.report.selectedTasks?.length || 0}</p>
                      <p>Công việc phát sinh: {employee.report.adHocTasks?.length || 0}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Không có nhân viên nào trong phòng ban</p>
          )}
          
          {/* Đánh giá của Giám đốc */}
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Đánh giá của Giám đốc
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đánh giá
                </label>
                <select
                  value={directorEvaluation.rating}
                  onChange={(e) => setDirectorEvaluation({ ...directorEvaluation, rating: e.target.value })}
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
                  value={directorEvaluation.comment}
                  onChange={(e) => setDirectorEvaluation({ ...directorEvaluation, comment: e.target.value })}
                  placeholder="Nhập ghi chú về phòng ban trong ngày..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveDirectorEvaluation}
                  disabled={savingDirectorEvaluation || !directorEvaluation.rating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingDirectorEvaluation ? 'Đang lưu...' : 'Lưu đánh giá'}
                </button>
              </div>
            </div>
          </div>
          </div>
        )
      })() : null}
    </div>
  )
}

export default DepartmentReportsPage

