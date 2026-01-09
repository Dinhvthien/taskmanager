import { useState, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { taskService } from '../services/taskService'
import dailyReportService from '../services/dailyReportService'
import { getCurrentUser } from '../utils/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const DailyReportPage = () => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlMode = searchParams.get('mode') || 'register'
  const [mode, setMode] = useState(urlMode) // 'register' hoặc 'report'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [allTasks, setAllTasks] = useState([])
  const [selectedTasks, setSelectedTasks] = useState([]) // Array of { taskId, task, priority, comment }
  const [adHocTasks, setAdHocTasks] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [todayReport, setTodayReport] = useState(null) // Báo cáo đã đăng ký trong ngày (cho mode report)

  // Lịch sử báo cáo (dùng chung cho nhân viên và manager)
  const today = new Date()
  const [historyMonth, setHistoryMonth] = useState(today.getMonth()) // 0-11
  const [historyYear, setHistoryYear] = useState(today.getFullYear())
  const [historyLoading, setHistoryLoading] = useState(false)
  const [myReports, setMyReports] = useState([])
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(today.toISOString().split('T')[0])
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null)
  const [selectedHistoryReports, setSelectedHistoryReports] = useState([]) // Tất cả báo cáo của ngày được chọn

  useEffect(() => {
    loadTasks()
  }, [])

  // Đọc mode từ URL query params
  useEffect(() => {
    const urlMode = searchParams.get('mode') || 'register'
    if (urlMode !== mode) {
      setMode(urlMode)
      if (urlMode === 'report') {
        loadTodayReport(true)
      }
    }
  }, [searchParams])

  // Nếu điều hướng từ thông báo với ngày cụ thể, focus vào ngày đó
  useEffect(() => {
    const focusDate = location.state?.focusReportDate
    if (focusDate) {
      const d = new Date(focusDate)
      if (!isNaN(d.getTime())) {
        setHistoryYear(d.getFullYear())
        setHistoryMonth(d.getMonth())
        setSelectedHistoryDate(focusDate)
      }
    }
  }, [location.state])

  // Load lịch sử báo cáo theo tháng
  useEffect(() => {
    loadHistoryForMonth(historyYear, historyMonth)
  }, [historyYear, historyMonth])

  // Load tasks khi chuyển mode
  useEffect(() => {
    if (mode === 'register') {
      loadTasks()
      // Reset form khi chuyển sang mode register
      setSelectedTasks([])
      setAdHocTasks([])
      setTodayReport(null)
    } else if (mode === 'report') {
      // Luôn load lại báo cáo hôm nay khi chuyển sang mode report (force reload)
      loadTodayReport(true)
    }
  }, [mode])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError('')
      const user = getCurrentUser()
      if (!user) {
        setError('Không tìm thấy thông tin người dùng')
        return
      }

      const response = await taskService.getMyTasks()
      // API trả về List<TaskResponse>, không phải Page
      const tasksList = response.data?.result || []
      
      // Ở mode register, chỉ load tasks chưa hoàn thành
      if (mode === 'register') {
        const incompleteTasks = Array.isArray(tasksList) 
          ? tasksList.filter(task => task.status !== 'COMPLETED')
          : []
        setAllTasks(incompleteTasks)
      } else {
        // Ở mode report, không cần load tasks vì sẽ load từ báo cáo đã đăng ký
        setAllTasks([])
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách công việc')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskToggle = (task) => {
    setSelectedTasks(prev => {
      const existingIndex = prev.findIndex(st => st.taskId === task.taskId)
      if (existingIndex >= 0) {
        // Nếu đã có, xóa khỏi danh sách
        return prev.filter(st => st.taskId !== task.taskId)
      } else {
        // Nếu chưa có, thêm vào danh sách với thông tin mặc định
        return [...prev, {
          id: Date.now(),
          taskId: task.taskId,
          task: task,
          priority: 'MEDIUM',
          comment: ''
        }]
      }
    })
  }

  const handleSelectedTaskChange = (taskId, field, value) => {
    setSelectedTasks(prev => prev.map(st => 
      st.taskId === taskId ? { ...st, [field]: value } : st
    ))
  }

  const handleRemoveSelectedTask = (taskId) => {
    setSelectedTasks(prev => prev.filter(st => st.taskId !== taskId))
  }

  const handleAddAdHocTask = () => {
    setAdHocTasks(prev => [...prev, {
      id: Date.now(),
      content: '',
      priority: 'MEDIUM',
      comment: ''
    }])
  }

  const handleRemoveAdHocTask = (id) => {
    setAdHocTasks(prev => prev.filter(task => task.id !== id))
  }

  const handleAdHocTaskChange = (id, field, value) => {
    setAdHocTasks(prev => prev.map(task => 
      task.id === id ? { ...task, [field]: value } : task
    ))
  }

  // Load báo cáo hôm nay
  const loadTodayReport = async (forceReload = false) => {
    try {
      // Chỉ set loading nếu force reload hoặc chưa có dữ liệu
      if (forceReload || !todayReport) {
        setLoading(true)
      }
      setError('')
      const today = new Date().toISOString().split('T')[0]
      
      // Thêm timestamp để tránh cache
      const response = await dailyReportService.getMyDailyReportsByDateRange(today, today)
      const reports = Array.isArray(response.data?.result) ? response.data.result : []
      
      // Lấy báo cáo mới nhất trong ngày
      if (reports.length > 0) {
        const latestReport = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        setTodayReport(latestReport)
        
        // Load dữ liệu vào form
        if (latestReport.selectedTasks) {
          setSelectedTasks(latestReport.selectedTasks.map(st => ({
            id: Date.now() + Math.random(),
            taskId: st.taskId,
            task: { taskId: st.taskId, title: st.title, description: st.description },
            priority: st.priority || 'MEDIUM',
            comment: st.comment || ''
          })))
        } else {
          setSelectedTasks([])
        }
        
        if (latestReport.adHocTasks) {
          setAdHocTasks(latestReport.adHocTasks.map(ah => ({
            id: ah.id || Date.now() + Math.random(),
            content: ah.content,
            priority: ah.priority || 'MEDIUM',
            comment: ah.comment || '',
            selfScore: ah.selfScore
          })))
        } else {
          setAdHocTasks([])
        }
      } else {
        setTodayReport(null)
        setSelectedTasks([])
        setAdHocTasks([])
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải báo cáo hôm nay')
    } finally {
      setLoading(false)
    }
  }

  // Cập nhật comment cho báo cáo cuối ngày
  const handleUpdateComments = async (e) => {
    e.preventDefault()
    
    if (!todayReport) {
      setError('Chưa có báo cáo đăng ký trong ngày. Vui lòng đăng ký lịch làm việc trước.')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const         updateData = {
        taskComments: selectedTasks.map(st => ({
          taskId: st.taskId,
          comment: st.comment ? st.comment.trim() : ''
        })),
        adHocTaskComments: adHocTasks.filter(ah => ah.id && !isNaN(ah.id)).map(ah => ({
          adHocTaskId: ah.id,
          comment: ah.comment ? ah.comment.trim() : '',
          selfScore: ah.selfScore || null
        })),
        // Ở mode report, không cho thêm công việc phát sinh mới
        newAdHocTasks: []
      }
      
      await dailyReportService.updateDailyReportComments(todayReport.reportId, updateData)
      
      setSubmitted(true)
      // Load lại báo cáo hôm nay để có dữ liệu mới nhất (force reload)
      await loadTodayReport(true)
      setTimeout(() => {
        setSubmitted(false)
      }, 3000)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi cập nhật báo cáo')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate: phải có ít nhất 1 task được chọn hoặc 1 công việc phát sinh
    if (selectedTasks.length === 0 && adHocTasks.length === 0) {
      setError('Vui lòng chọn ít nhất một công việc hoặc thêm công việc phát sinh')
      return
    }

    // Validate công việc phát sinh: nội dung không được để trống
    const invalidAdHocTasks = adHocTasks.filter(task => !task.content.trim())
    if (invalidAdHocTasks.length > 0) {
      setError('Vui lòng nhập nội dung cho tất cả công việc phát sinh')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      // Tự động lấy ngày hiện tại
      const today = new Date().toISOString().split('T')[0]
      
      const reportData = {
        date: today,
        selectedTaskIds: selectedTasks.map(st => st.taskId),
        selectedTasksWithDetails: selectedTasks.map(st => ({
          taskId: st.taskId,
          priority: 'MEDIUM', // Mặc định MEDIUM vì không có field nhập ở mode register
          comment: '' // Không có comment ở mode register
        })),
        adHocTasks: adHocTasks.map(task => ({
          content: task.content.trim(),
          priority: 'MEDIUM', // Mặc định MEDIUM vì không có field nhập ở mode register
          comment: '', // Không có comment ở mode register
          selfScore: task.selfScore || null
        }))
      }
      
      await dailyReportService.createDailyReport(reportData)
      
      setSubmitted(true)
      // Load lại báo cáo hôm nay để có dữ liệu mới nhất (force reload)
      await loadTodayReport(true)
      
      setTimeout(() => {
        setSubmitted(false)
        // Reset form chỉ khi ở mode register
        if (mode === 'register') {
          setSelectedTasks([])
          setAdHocTasks([])
        }
      }, 3000)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi gửi báo cáo')
    } finally {
      setLoading(false)
    }
  }

  const loadHistoryForMonth = async (year, monthIndex) => {
    try {
      setHistoryLoading(true)
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const response = await dailyReportService.getMyDailyReportsByDateRange(startStr, endStr)
      const reports = Array.isArray(response.data?.result) ? response.data.result : []
      setMyReports(reports)

      // Cập nhật report được chọn nếu vẫn nằm trong tháng này
      if (selectedHistoryDate) {
        const reportsForDate = reports.filter(r => r.reportDate === selectedHistoryDate)
        setSelectedHistoryReports(reportsForDate)
        // Lấy báo cáo mới nhất (sắp xếp theo createdAt DESC)
        const latestReport = reportsForDate.length > 0 
          ? reportsForDate.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
          : null
        setSelectedHistoryReport(latestReport)
      } else {
        setSelectedHistoryReport(null)
        setSelectedHistoryReports([])
      }
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleChangeMonth = (direction) => {
    setHistoryMonth(prev => {
      let newMonth = prev + direction
      let newYear = historyYear
      if (newMonth < 0) {
        newMonth = 11
        newYear = historyYear - 1
      } else if (newMonth > 11) {
        newMonth = 0
        newYear = historyYear + 1
      }
      setHistoryYear(newYear)
      return newMonth
    })
  }

  const handleSelectHistoryDate = (dateStr) => {
    setSelectedHistoryDate(dateStr)
    const reportsForDate = myReports.filter(r => r.reportDate === dateStr)
    setSelectedHistoryReports(reportsForDate)
    // Lấy báo cáo mới nhất (sắp xếp theo createdAt DESC)
    const latestReport = reportsForDate.length > 0 
      ? reportsForDate.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null
    setSelectedHistoryReport(latestReport)
  }

  const getMonthLabel = (monthIndex, year) => {
    const formatter = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' })
    return formatter.format(new Date(year, monthIndex, 1))
  }

  const buildCalendarDays = (year, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const daysInMonth = lastDay.getDate()
    // JS: 0=CN, 1=Thứ 2,... -> chuyển về 1..7 với 1=Thứ 2
    let startWeekDay = firstDay.getDay() // 0-6
    if (startWeekDay === 0) startWeekDay = 7

    const cells = []
    // Ô trống trước ngày 1
    for (let i = 1; i < startWeekDay; i++) {
      cells.push(null)
    }
    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day)
      const dateStr = date.toISOString().split('T')[0]
      cells.push(dateStr)
    }
    return cells
  }

  const getStatusLabel = (status) => {
    const statusMap = {
      'PENDING': 'Chờ xử lý',
      'ACCEPTED': 'Đã chấp nhận',
      'IN_PROGRESS': 'Đang thực hiện',
      'WAITING': 'Đang chờ',
      'COMPLETED': 'Hoàn thành',
      'REJECTED': 'Từ chối'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status) => {
    const colorMap = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'ACCEPTED': 'bg-blue-100 text-blue-800',
      'IN_PROGRESS': 'bg-green-100 text-green-800',
      'WAITING': 'bg-orange-100 text-orange-800',
      'COMPLETED': 'bg-gray-100 text-gray-800',
      'REJECTED': 'bg-red-100 text-red-800'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityLabel = (priority) => {
    const priorityMap = {
      'HIGH': 'Cao',
      'MEDIUM': 'Trung bình',
      'LOW': 'Thấp'
    }
    return priorityMap[priority] || priority
  }

  const getPriorityColor = (priority) => {
    const colorMap = {
      'HIGH': 'bg-red-100 text-red-800 border-red-300',
      'MEDIUM': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'LOW': 'bg-green-100 text-green-800 border-green-300'
    }
    return colorMap[priority] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getDirectorRatingLabel = (rating) => {
    const ratingMap = {
      EXCELLENT: 'Xuất sắc',
      GOOD: 'Tốt',
      AVERAGE: 'Trung bình',
      POOR: 'Kém'
    }
    return ratingMap[rating] || rating
  }

  const getDirectorRatingColor = (rating) => {
    const colorMap = {
      EXCELLENT: 'bg-green-100 text-green-800 border-green-300',
      GOOD: 'bg-blue-100 text-blue-800 border-blue-300',
      AVERAGE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      POOR: 'bg-red-100 text-red-800 border-red-300'
    }
    return colorMap[rating] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  if (loading && allTasks.length === 0) {
    return <LoadingSpinner />
  }

  // Tạo map để đếm số lượng báo cáo mỗi ngày
  const reportsByDate = myReports.reduce((acc, report) => {
    const date = report.reportDate
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(report)
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form gửi báo cáo */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Báo cáo công việc</h1>
          
          {/* Tabs để chuyển đổi giữa 2 mode */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setSearchParams({ mode: 'register' })
                setSelectedTasks([])
                setAdHocTasks([])
                setError('')
              }}
              className={`px-4 py-2 font-medium text-sm ${
                mode === 'register'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Đăng ký lịch làm việc (Buổi sáng)
            </button>
            <button
              type="button"
              onClick={async () => {
                setMode('report')
                setSearchParams({ mode: 'report' })
                // Đảm bảo load lại dữ liệu mới nhất (force reload)
                await loadTodayReport(true)
              }}
              className={`px-4 py-2 font-medium text-sm ${
                mode === 'report'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Báo cáo cuối ngày
            </button>
          </div>
          
          {mode === 'register' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              <strong>Đăng ký lịch làm việc:</strong> Chọn các công việc dự kiến sẽ làm trong ngày. Comment và điểm tự chấm có thể để trống hoặc nhập sau.
            </div>
          )}
          
          {mode === 'report' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {todayReport ? (
                <div>
                  <strong>Báo cáo cuối ngày:</strong> Cập nhật comment và điểm tự chấm cho các công việc đã đăng ký.
                </div>
              ) : (
                <div>
                  <strong>Chưa có báo cáo đăng ký:</strong> Vui lòng đăng ký lịch làm việc buổi sáng trước khi báo cáo cuối ngày.
                </div>
              )}
            </div>
          )}

          {error && <ErrorMessage message={error} />}

          {submitted && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              Báo cáo đã được gửi thành công!
            </div>
          )}

          <form onSubmit={mode === 'register' ? handleSubmit : handleUpdateComments} className="space-y-6">
          {/* Danh sách công việc có sẵn - chỉ hiển thị ở mode register */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Công việc chưa hoàn thành ({allTasks.length} công việc)
              </label>
            <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              {allTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Không có công việc nào</p>
              ) : (
                <div className="space-y-3">
                  {allTasks.map((task) => {
                    const isSelected = selectedTasks.some(st => st.taskId === task.taskId)
                    return (
                      <div 
                        key={task.taskId} 
                        className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleTaskToggle(task)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTaskToggle(task)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 ml-3">
                          <h3 className="font-medium text-gray-900">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                            {task.progress !== null && (
                              <span className="text-xs text-gray-500">
                                Tiến độ: {task.progress}%
                              </span>
                            )}
                            {task.endDate && (
                              <span className="text-xs text-gray-500">
                                Hạn: {new Date(task.endDate).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {selectedTasks.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                Đã chọn: <span className="font-medium">{selectedTasks.length}</span> công việc
              </p>
            )}
          </div>
          )}

          {/* Công việc đã chọn */}
          {selectedTasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {mode === 'register' 
                  ? `Công việc đã chọn (${selectedTasks.length} công việc)`
                  : `Báo cáo về công việc đã chọn (${selectedTasks.length} công việc)`
                }
              </label>
              <div className="space-y-4">
                {selectedTasks.map((selectedTask, index) => (
                  <div key={selectedTask.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{selectedTask.task.title}</h4>
                        {selectedTask.task.description && (
                          <p className="text-sm text-gray-600 mt-1">{selectedTask.task.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedTask(selectedTask.taskId)}
                        className="text-red-600 hover:text-red-700 p-1 ml-2"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Mức độ - chỉ hiển thị ở mode report (nhưng bỏ theo yêu cầu) */}
                      {/* Comment - chỉ hiển thị ở mode report */}
                      {mode === 'report' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comment
                          </label>
                          <textarea
                            value={selectedTask.comment || ''}
                            onChange={(e) => handleSelectedTaskChange(selectedTask.taskId, 'comment', e.target.value)}
                            placeholder="Nhập comment về công việc này..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Công việc phát sinh */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Công việc phát sinh
              </label>
              {/* Chỉ hiển thị nút thêm ở mode register */}
              {mode === 'register' && (
                <button
                  type="button"
                  onClick={handleAddAdHocTask}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Thêm công việc
                </button>
              )}
            </div>

            {adHocTasks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  {mode === 'register' 
                    ? 'Chưa có công việc phát sinh nào. Nhấn "Thêm công việc" để thêm mới'
                    : 'Chưa có công việc phát sinh nào được đăng ký'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {adHocTasks.map((adHocTask, index) => (
                  <div key={adHocTask.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Công việc phát sinh #{index + 1}</h4>
                      {/* Chỉ cho phép xóa ở mode register */}
                      {mode === 'register' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAdHocTask(adHocTask.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Nội dung công việc */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nội dung công việc {mode === 'register' && <span className="text-red-500">*</span>}
                        </label>
                        {mode === 'register' ? (
                          <input
                            type="text"
                            value={adHocTask.content}
                            onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'content', e.target.value)}
                            placeholder="Nhập nội dung công việc phát sinh..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        ) : (
                          <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                            {adHocTask.content}
                          </div>
                        )}
                      </div>

                      {/* Comment - chỉ hiển thị ở mode report */}
                      {mode === 'report' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comment
                          </label>
                          <textarea
                            value={adHocTask.comment || ''}
                            onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'comment', e.target.value)}
                            placeholder="Nhập comment về công việc này..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                      )}

                      {/* Điểm tự chấm */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Điểm tự chấm (giờ) {mode === 'report' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={adHocTask.selfScore || ''}
                          onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'selfScore', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="Ví dụ: 2.5 (tương đương 2.5 giờ = 2.5 điểm)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={mode === 'report'}
                        />
                        <p className="text-xs text-gray-500 mt-1">Điểm tính bằng giờ (ví dụ: 2.5 giờ = 2.5 điểm)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Nút gửi */}
            <div className="flex justify-end pt-4 border-top border-gray-200">
              <button
                type="submit"
                disabled={loading || (mode === 'register' && selectedTasks.length === 0 && adHocTasks.length === 0) || (mode === 'report' && !todayReport)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading 
                  ? (mode === 'register' ? 'Đang đăng ký...' : 'Đang cập nhật...') 
                  : (mode === 'register' ? 'Đăng ký' : 'Cập nhật báo cáo')
                }
              </button>
            </div>
          </form>
        </div>

        {/* Lịch sử báo cáo (calendar) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lịch sử báo cáo</h2>

          {/* Điều khiển tháng */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleChangeMonth(-1)}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              ← Tháng trước
            </button>
            <span className="font-medium text-gray-900">
              {getMonthLabel(historyMonth, historyYear)}
            </span>
            <button
              type="button"
              onClick={() => handleChangeMonth(1)}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              Tháng sau →
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-xs mb-3">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
              <div key={d} className="text-center font-semibold text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-gray-500">Đang tải lịch sử...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 mb-4 text-sm">
              {buildCalendarDays(historyYear, historyMonth).map((dateStr, idx) => {
                if (!dateStr) {
                  return <div key={idx} className="h-8" />
                }

                const dateObj = new Date(dateStr)
                const day = dateObj.getDate()
                const reportsForDate = reportsByDate[dateStr] || []
                const hasReport = reportsForDate.length > 0
                const reportCount = reportsForDate.length
                const isSelected = selectedHistoryDate === dateStr

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleSelectHistoryDate(dateStr)}
                    className={`h-8 flex items-center justify-center rounded-md border text-xs relative
                      ${hasReport
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700'
                      }
                      ${isSelected ? 'ring-2 ring-blue-500 font-semibold' : ''}
                    `}
                    title={hasReport 
                      ? `Đã có ${reportCount} báo cáo ngày này` 
                      : 'Chưa có báo cáo ngày này'}
                  >
                    {day}
                    {reportCount > 1 && (
                      <span className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {reportCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Chi tiết báo cáo của ngày được chọn */}
          <div className="border-t border-gray-200 pt-3 mt-2">
            <p className="text-xs text-gray-500 mb-2">
              Ngày chọn: <span className="font-medium">{selectedHistoryDate}</span>
              {selectedHistoryReports.length > 1 && (
                <span className="ml-2 text-blue-600 font-semibold">({selectedHistoryReports.length} báo cáo)</span>
              )}
            </p>
            {selectedHistoryReports.length > 0 ? (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {selectedHistoryReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((report, reportIdx) => (
                  <div key={report.reportId || reportIdx} className="border border-gray-300 rounded-md p-2 bg-white">
                    {selectedHistoryReports.length > 1 && (
                      <div className="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-200 font-medium">
                        Báo cáo #{selectedHistoryReports.length - reportIdx} - {new Date(report.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="space-y-3">
                {/* Công việc đã chọn */}
                {report.selectedTasks && report.selectedTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">
                      Công việc đã báo cáo ({report.selectedTasks.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.selectedTasks.map(task => (
                        <div
                          key={task.taskId}
                          className="bg-gray-50 border border-gray-200 rounded-md p-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">{task.title}</p>
                              {task.description && (
                                <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {task.priority && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(
                                    task.priority
                                  )}`}
                                >
                                  {getPriorityLabel(task.priority)}
                                </span>
                              )}
                              {task.directorEvaluation?.rating && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getDirectorRatingColor(
                                    task.directorEvaluation.rating
                                  )}`}
                                >
                                  GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.comment && (
                            <p className="text-[11px] text-gray-600 mt-1 italic">
                              "{task.comment}"
                            </p>
                          )}
                          {task.directorEvaluation?.comment && (
                            <p className="text-[11px] text-blue-700 mt-1 italic">
                              Ghi chú GĐ: "{task.directorEvaluation.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Công việc phát sinh */}
                {report.adHocTasks && report.adHocTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">
                      Công việc phát sinh ({report.adHocTasks.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.adHocTasks.map(task => (
                        <div
                          key={task.id}
                          className="bg-blue-50 border border-blue-200 rounded-md p-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">
                                {task.content}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {task.priority && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(
                                    task.priority
                                  )}`}
                                >
                                  {getPriorityLabel(task.priority)}
                                </span>
                              )}
                              {task.directorEvaluation?.rating && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getDirectorRatingColor(
                                    task.directorEvaluation.rating
                                  )}`}
                                >
                                  GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.comment && (
                            <p className="text-[11px] text-gray-600 mt-1 italic">
                              "{task.comment}"
                            </p>
                          )}
                          {task.directorEvaluation?.comment && (
                            <p className="text-[11px] text-blue-700 mt-1 italic">
                              Ghi chú GĐ: "{task.directorEvaluation.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!report.selectedTasks?.length &&
                  !report.adHocTasks?.length && (
                    <p className="text-xs text-gray-500">
                      Báo cáo này không có nội dung chi tiết.
                    </p>
                  )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Không có báo cáo nào cho ngày này.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailyReportPage
