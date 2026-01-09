import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userService } from '../../services/userService'
import { directorService } from '../../services/directorService'
import dailyReportService, { directorEvaluationService } from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import WorkTimeline from '../../components/WorkTimeline'

const EmployeeReportsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState(null)
  const [reports, setReports] = useState([]) // Tất cả báo cáo trong ngày
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [evaluatingTaskId, setEvaluatingTaskId] = useState(null)
  const [evaluatingAdHocTaskId, setEvaluatingAdHocTaskId] = useState(null)
  const [taskEvaluation, setTaskEvaluation] = useState({ rating: '', comment: '' })
  const [adHocTaskEvaluation, setAdHocTaskEvaluation] = useState({ rating: '', comment: '' })
  const [savingEvaluation, setSavingEvaluation] = useState(false)

  // Hàm kiểm tra báo cáo đã gửi chưa (dựa vào comment)
  const isReportSent = (report) => {
    if (!report) return false
    
    // Báo cáo được coi là đã gửi nếu có comment
    const hasTaskComment = report.selectedTasks && report.selectedTasks.length > 0 && 
      report.selectedTasks.some(task => task.comment && task.comment.trim() !== '')
    
    const hasAdHocComment = report.adHocTasks && report.adHocTasks.length > 0 && 
      report.adHocTasks.some(ah => ah.comment && ah.comment.trim() !== '')
    
    return hasTaskComment || hasAdHocComment
  }

  useEffect(() => {
    const userIdParam = searchParams.get('userId')
    const dateParam = searchParams.get('date')
    
    if (dateParam) {
      setReportDate(dateParam)
    }
    
    loadUsers().then(() => {
      // After users are loaded, check URL params
      if (userIdParam) {
        const userId = parseInt(userIdParam)
        setSelectedUserId(userId)
        // Find user and set search query
        setTimeout(() => {
          const user = users.find(u => u.userId === userId)
          if (user) {
            setSearchQuery(`${user.fullName} (${user.email})`)
          }
        }, 100)
      }
    })
  }, [])
  
  useEffect(() => {
    // Update selected user when users are loaded and URL has userId param
    const userIdParam = searchParams.get('userId')
    if (userIdParam && users.length > 0) {
      const userId = parseInt(userIdParam)
      const user = users.find(u => u.userId === userId)
      if (user && !selectedUserId) {
        setSelectedUserId(userId)
        setSearchQuery(`${user.fullName} (${user.email})`)
      }
    }
  }, [users])

  useEffect(() => {
    if (selectedUserId && reportDate) {
      loadUserReport()
    }
  }, [selectedUserId, reportDate])

  useEffect(() => {
    // Filter users based on search query
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
    } else {
      const query = searchQuery.toLowerCase().trim()
      const filtered = users.filter(user => {
        const fullName = (user.fullName || '').toLowerCase()
        const email = (user.email || '').toLowerCase()
        const userName = (user.userName || '').toLowerCase()
        return fullName.includes(query) || email.includes(query) || userName.includes(query)
      })
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await directorService.getMyDirector()
      const director = response.data.result
      if (director) {
        const usersResponse = await userService.getUsersByDirectorId(director.directorId, 0, 1000)
        const usersList = usersResponse.data.result?.content || []
        const filteredUsersList = usersList.filter(user => 
          user.roles && (user.roles.includes('USER') || user.roles.includes('MANAGER'))
        )
        setUsers(filteredUsersList)
        setFilteredUsers(filteredUsersList)
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách nhân viên')
    } finally {
      setLoading(false)
    }
    return Promise.resolve()
  }

  const loadUserReport = async () => {
    if (!selectedUserId) return

    try {
      setLoading(true)
      setError('')
      // Lấy TẤT CẢ báo cáo của nhân viên được chọn trong ngày
      const response = await dailyReportService.getAllDailyReportsByUserId(selectedUserId, reportDate)
      const allReports = response.data.result || []
      setReports(allReports)
      
      // Sắp xếp theo thời gian tạo (mới nhất trước)
      const sortedReports = [...allReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      // Tự động chọn báo cáo mới nhất nếu có
      if (sortedReports.length > 0) {
        setSelectedReportId(sortedReports[0].reportId)
        setReport(sortedReports[0])
      } else {
        setSelectedReportId(null)
        setReport(null)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải báo cáo')
      setReport(null)
      setReports([])
      setSelectedReportId(null)
    } finally {
      setLoading(false)
    }
  }
  
  // Xử lý khi chọn báo cáo khác
  const handleReportChange = (reportId) => {
    const selectedReport = reports.find(r => r.reportId === reportId)
    if (selectedReport) {
      setSelectedReportId(reportId)
      setReport(selectedReport)
    }
  }

  const handleSelectUser = (user) => {
    setSelectedUserId(user.userId)
    setSearchQuery('')
    setShowDropdown(false)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowDropdown(true)
    if (!value.trim()) {
      setSelectedUserId(null)
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

  const handleStartEvaluation = (task) => {
    setEvaluatingTaskId(task.taskId)
    if (task.directorEvaluation) {
      setTaskEvaluation({
        rating: task.directorEvaluation.rating || '',
        comment: task.directorEvaluation.comment || ''
      })
    } else {
      setTaskEvaluation({ rating: '', comment: '' })
    }
  }

  const handleStartAdHocTaskEvaluation = (adHocTask) => {
    setEvaluatingAdHocTaskId(adHocTask.id)
    if (adHocTask.directorEvaluation) {
      setAdHocTaskEvaluation({
        rating: adHocTask.directorEvaluation.rating || '',
        comment: adHocTask.directorEvaluation.comment || ''
      })
    } else {
      setAdHocTaskEvaluation({ rating: '', comment: '' })
    }
  }

  const handleCancelEvaluation = () => {
    setEvaluatingTaskId(null)
    setTaskEvaluation({ rating: '', comment: '' })
  }

  const handleCancelAdHocTaskEvaluation = () => {
    setEvaluatingAdHocTaskId(null)
    setAdHocTaskEvaluation({ rating: '', comment: '' })
  }

  const handleSaveTaskEvaluation = async (taskId) => {
    if (!report || !taskEvaluation.rating) {
      setError('Vui lòng chọn đánh giá')
      return
    }

    try {
      setSavingEvaluation(true)
      setError('')
      
      await directorEvaluationService.saveTaskEvaluation(report.reportId, {
        taskId: taskId,
        rating: taskEvaluation.rating,
        comment: taskEvaluation.comment || ''
      })
      
      // Reload report
      await loadUserReport()
      setEvaluatingTaskId(null)
      setTaskEvaluation({ rating: '', comment: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi lưu đánh giá')
    } finally {
      setSavingEvaluation(false)
    }
  }

  const handleSaveAdHocTaskEvaluation = async (adHocTaskId) => {
    if (!report || !adHocTaskEvaluation.rating) {
      setError('Vui lòng chọn đánh giá')
      return
    }

    try {
      setSavingEvaluation(true)
      setError('')
      
      await directorEvaluationService.saveAdHocTaskEvaluation(report.reportId, {
        adHocTaskId: adHocTaskId,
        rating: adHocTaskEvaluation.rating,
        comment: adHocTaskEvaluation.comment || ''
      })
      
      // Reload report
      await loadUserReport()
      setEvaluatingAdHocTaskId(null)
      setAdHocTaskEvaluation({ rating: '', comment: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi lưu đánh giá')
    } finally {
      setSavingEvaluation(false)
    }
  }

  if (loading && users.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Báo cáo của nhân viên</h1>

      {error && <ErrorMessage message={error} />}

      {/* Chọn nhân viên và ngày */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm kiếm và chọn nhân viên
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Nhập tên, email hoặc username để tìm kiếm..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {showDropdown && filteredUsers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.userId}
                    onClick={() => handleSelectUser(user)}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-gray-900">
                      <span className="font-medium">{user.fullName}</span>
                      {user.email && (
                        <span className="text-sm text-gray-500 ml-2">({user.email})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showDropdown && filteredUsers.length === 0 && searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <div className="px-4 py-2 text-sm text-red-500">
                  Không tìm thấy nhân viên nào
                </div>
              </div>
            )}
            {searchQuery && !selectedUserId && (
              <p className="mt-1 text-sm text-gray-500">
                Tìm thấy {filteredUsers.length} nhân viên
              </p>
            )}
          </div>
          <div className="w-full sm:w-auto sm:min-w-[200px]">
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

      {/* Hiển thị báo cáo */}
      {selectedUserId && (() => {
        const selectedUser = users.find(u => u.userId === selectedUserId)
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            {loading ? (
              <LoadingSpinner />
            ) : reports.length > 0 && report ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Báo cáo ngày {new Date(reportDate).toLocaleDateString('vi-VN')}
                    {selectedUser && (
                      <span className="text-lg font-normal text-gray-600 ml-2">
                        - {selectedUser.fullName} {selectedUser.email ? `(${selectedUser.email})` : ''}
                      </span>
                    )}
                  </h2>
                  
                  {/* Dropdown chọn báo cáo nếu có nhiều báo cáo */}
                  {reports.length > 1 && (
                    <div className="relative">
                      <select
                        value={selectedReportId || ''}
                        onChange={(e) => handleReportChange(parseInt(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm font-medium text-gray-700"
                      >
                        {reports.map((r, index) => {
                          const timeStr = new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          const label = index === 0 
                            ? `Báo cáo mới nhất - ${timeStr}` 
                            : `Báo cáo #${reports.length - index} - ${timeStr}`
                          return (
                            <option key={r.reportId} value={r.reportId}>
                              {label}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {/* Timeline hiển thị công việc chưa báo cáo */}
                {(() => {
                  // Tìm báo cáo chưa gửi (chưa có comment)
                  const unsentReports = reports.filter(r => !isReportSent(r))
                  
                  if (unsentReports.length > 0) {
                    // Lấy báo cáo chưa gửi mới nhất
                    const latestUnsentReport = unsentReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
                    
                    // Chuẩn bị dữ liệu cho timeline: chỉ lấy các công việc có thời gian
                    const tasksForTimeline = (latestUnsentReport.selectedTasks || [])
                      .filter(task => task.startTime && task.endTime)
                      .map(task => ({
                        id: Date.now() + Math.random(),
                        taskId: task.taskId,
                        task: { taskId: task.taskId, title: task.title, description: task.description },
                        startTime: task.startTime || '',
                        endTime: task.endTime || ''
                      }))
                    
                    const adHocTasksForTimeline = (latestUnsentReport.adHocTasks || [])
                      .filter(task => task.startTime && task.endTime)
                      .map(task => ({
                        id: task.id || Date.now() + Math.random(),
                        content: task.content || '',
                        startTime: task.startTime || '',
                        endTime: task.endTime || ''
                      }))
                    
                    // Chỉ hiển thị timeline nếu có công việc có thời gian
                    if (tasksForTimeline.length > 0 || adHocTasksForTimeline.length > 0) {
                      return (
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-300 mb-4">
                          <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <p className="text-sm text-yellow-800 font-medium">
                              ⚠️ <strong>Timeline công việc chưa báo cáo:</strong> Nhân viên đã đăng ký các công việc này nhưng chưa gửi báo cáo kết quả.
                            </p>
                          </div>
                          <WorkTimeline
                            selectedTasks={tasksForTimeline}
                            adHocTasks={adHocTasksForTimeline}
                            onAddAdHocAtTime={null}
                            mode="report"
                          />
                        </div>
                      )
                    }
                  }
                  return null
                })()}
                
                {/* Công việc đã chọn */}
                {report.selectedTasks && report.selectedTasks.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">
                    Công việc đã báo cáo ({report.selectedTasks.length})
                  </h3>
                  <div className="space-y-3">
                    {report.selectedTasks.map((task) => (
                      <div key={task.taskId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                            {task.comment && (
                              <p className="text-sm text-gray-600 mt-2 italic">"{task.comment}"</p>
                            )}
                          </div>
                          {evaluatingTaskId !== task.taskId && (
                            <button
                              onClick={() => handleStartEvaluation(task)}
                              className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {task.directorEvaluation ? 'Sửa đánh giá' : 'Đánh giá'}
                            </button>
                          )}
                        </div>
                        
                        {/* Hiển thị đánh giá hiện tại */}
                        {task.directorEvaluation && evaluatingTaskId !== task.taskId && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Đánh giá của giám đốc:</span>{' '}
                              <span className="font-semibold text-green-700">
                                {getRatingLabel(task.directorEvaluation.rating)}
                              </span>
                            </p>
                            {task.directorEvaluation.comment && (
                              <p className="text-sm text-gray-600 mt-1 italic">
                                "{task.directorEvaluation.comment}"
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Form đánh giá */}
                        {evaluatingTaskId === task.taskId && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-medium text-gray-900 mb-3">Đánh giá của giám đốc</h5>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Đánh giá
                                </label>
                                <select
                                  value={taskEvaluation.rating}
                                  onChange={(e) => setTaskEvaluation({ ...taskEvaluation, rating: e.target.value })}
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
                                  value={taskEvaluation.comment}
                                  onChange={(e) => setTaskEvaluation({ ...taskEvaluation, comment: e.target.value })}
                                  placeholder="Nhập ghi chú về công việc này..."
                                  rows={3}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={handleCancelEvaluation}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleSaveTaskEvaluation(task.taskId)}
                                  disabled={savingEvaluation || !taskEvaluation.rating}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingEvaluation ? 'Đang lưu...' : 'Lưu đánh giá'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Công việc phát sinh */}
              {report.adHocTasks && report.adHocTasks.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">
                    Công việc phát sinh ({report.adHocTasks.length})
                  </h3>
                  <div className="space-y-3">
                    {report.adHocTasks.map((adHocTask) => (
                      <div key={adHocTask.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-gray-900">{adHocTask.content}</h4>
                              {adHocTask.selfScore !== null && adHocTask.selfScore !== undefined && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                                  Điểm tự chấm: {adHocTask.selfScore.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {adHocTask.comment && (
                              <p className="text-sm text-gray-600 mt-2 italic">"{adHocTask.comment}"</p>
                            )}
                          </div>
                          {evaluatingAdHocTaskId !== adHocTask.id && (
                            <button
                              onClick={() => handleStartAdHocTaskEvaluation(adHocTask)}
                              className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {adHocTask.directorEvaluation ? 'Sửa đánh giá' : 'Đánh giá'}
                            </button>
                          )}
                        </div>
                        
                        {/* Hiển thị đánh giá hiện tại */}
                        {adHocTask.directorEvaluation && evaluatingAdHocTaskId !== adHocTask.id && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Đánh giá của giám đốc:</span>{' '}
                              <span className="font-semibold text-green-700">
                                {getRatingLabel(adHocTask.directorEvaluation.rating)}
                              </span>
                            </p>
                            {adHocTask.directorEvaluation.comment && (
                              <p className="text-sm text-gray-600 mt-1 italic">
                                "{adHocTask.directorEvaluation.comment}"
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Form đánh giá */}
                        {evaluatingAdHocTaskId === adHocTask.id && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-medium text-gray-900 mb-3">Đánh giá của giám đốc</h5>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Đánh giá
                                </label>
                                <select
                                  value={adHocTaskEvaluation.rating}
                                  onChange={(e) => setAdHocTaskEvaluation({ ...adHocTaskEvaluation, rating: e.target.value })}
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
                                  value={adHocTaskEvaluation.comment}
                                  onChange={(e) => setAdHocTaskEvaluation({ ...adHocTaskEvaluation, comment: e.target.value })}
                                  placeholder="Nhập ghi chú về công việc này..."
                                  rows={3}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={handleCancelAdHocTaskEvaluation}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleSaveAdHocTaskEvaluation(adHocTask.id)}
                                  disabled={savingEvaluation || !adHocTaskEvaluation.rating}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingEvaluation ? 'Đang lưu...' : 'Lưu đánh giá'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nhân viên chưa có báo cáo cho ngày này
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default EmployeeReportsPage

