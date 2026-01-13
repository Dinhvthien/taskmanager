import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import dailyReportService from '../services/dailyReportService'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatTime } from '../utils/dateFormat'

const DailyReportHistoryPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const today = new Date()
  const [historyMonth, setHistoryMonth] = useState(today.getMonth()) // 0-11
  const [historyYear, setHistoryYear] = useState(today.getFullYear())
  const [historyLoading, setHistoryLoading] = useState(false)
  const [myReports, setMyReports] = useState([])
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(today.toISOString().split('T')[0])
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null)
  const [selectedHistoryReports, setSelectedHistoryReports] = useState([]) // Tất cả báo cáo của ngày được chọn

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
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading history:', err)
      }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Điều khiển tháng */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleChangeMonth(-1)}
                  className="p-2 text-gray-700 hover:text-purple-600 hover:bg-white rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-bold text-gray-900 text-lg">
                  {getMonthLabel(historyMonth, historyYear)}
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeMonth(1)}
                  className="p-2 text-gray-700 hover:text-purple-600 hover:bg-white rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4">
              {/* Calendar header - Days of week */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, idx) => (
                  <div 
                    key={d} 
                    className={`text-center font-bold text-sm py-2 ${
                      idx === 5 || idx === 6 
                        ? 'text-red-500' 
                        : 'text-gray-700'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {buildCalendarDays(historyYear, historyMonth).map((dateStr, idx) => {
                    if (!dateStr) {
                      return <div key={idx} className="aspect-square" />
                    }

                    const dateObj = new Date(dateStr)
                    const day = dateObj.getDate()
                    const reportsForDate = reportsByDate[dateStr] || []
                    const hasReport = reportsForDate.length > 0
                    const reportCount = reportsForDate.length
                    const isSelected = selectedHistoryDate === dateStr
                    const isToday = dateStr === today.toISOString().split('T')[0]
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleSelectHistoryDate(dateStr)}
                        className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 text-sm font-semibold relative transition-all duration-200 group
                          ${isSelected 
                            ? 'ring-4 ring-purple-400 ring-offset-2 border-purple-500 bg-gradient-to-br from-purple-100 to-pink-100 text-purple-900 scale-110 shadow-xl z-10' 
                            : hasReport
                              ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 text-green-800 hover:border-green-500 hover:shadow-lg hover:scale-105'
                              : isToday
                                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-400 hover:shadow-md'
                                : isWeekend
                                  ? 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                          }
                        `}
                        title={hasReport 
                          ? `Đã có ${reportCount} báo cáo ngày này` 
                          : 'Chưa có báo cáo ngày này'}
                      >
                        <span className={`${isSelected ? 'text-lg font-bold' : ''}`}>{day}</span>
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></span>
                        )}
                        {hasReport && (
                          <span className={`absolute top-1 right-1 ${
                            reportCount > 1 
                              ? 'bg-green-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md' 
                              : 'w-2 h-2 bg-green-500 rounded-full shadow-sm'
                          }`}>
                            {reportCount > 1 && reportCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chi tiết báo cáo */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Chi tiết báo cáo
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Ngày: <span className="font-semibold text-blue-600">{selectedHistoryDate}</span>
                    {selectedHistoryReports.length > 1 && (
                      <span className="ml-2 text-purple-600 font-semibold">({selectedHistoryReports.length} báo cáo)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {selectedHistoryReports.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {selectedHistoryReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((report, reportIdx) => (
                    <div key={report.reportId || reportIdx} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 shadow-md hover:shadow-xl transition-all duration-200">
                      {selectedHistoryReports.length > 1 && (
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b-2 border-gray-200">
                          <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
                            Báo cáo #{selectedHistoryReports.length - reportIdx}
                          </div>
                          <div className="text-sm text-gray-600 font-medium">
                            {formatTime(report.createdAt)}
                          </div>
                        </div>
                      )}
                    <div className="space-y-3">
                      {/* Công việc đã chọn */}
                      {report.selectedTasks && report.selectedTasks.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Công việc đã báo cáo ({report.selectedTasks.length})
                          </h3>
                          <div className="space-y-3">
                            {report.selectedTasks.map(task => (
                              <div
                                key={task.taskId}
                                className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                    {task.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 ml-2">
                                    {task.priority && (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                          task.priority
                                        )}`}
                                      >
                                        {getPriorityLabel(task.priority)}
                                      </span>
                                    )}
                                    {task.directorEvaluation?.rating && (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getDirectorRatingColor(
                                          task.directorEvaluation.rating
                                        )}`}
                                      >
                                        GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {task.comment && (
                                  <p className="text-xs text-gray-600 mt-2 italic">
                                    <strong>Báo cáo kết quả:</strong> "{task.comment}"
                                  </p>
                                )}
                                {task.directorEvaluation?.comment && (
                                  <p className="text-xs text-blue-700 mt-1 italic">
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
                        <div className="mb-4">
                          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Công việc phát sinh ({report.adHocTasks.length})
                          </h3>
                          <div className="space-y-3">
                            {report.adHocTasks.map(task => (
                              <div
                                key={task.id}
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {task.content}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 ml-2">
                                    {task.priority && (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                          task.priority
                                        )}`}
                                      >
                                        {getPriorityLabel(task.priority)}
                                      </span>
                                    )}
                                    {task.directorEvaluation?.rating && (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getDirectorRatingColor(
                                          task.directorEvaluation.rating
                                        )}`}
                                      >
                                        GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {task.comment && (
                                  <p className="text-xs text-gray-600 mt-2 italic">
                                    <strong>Báo cáo kết quả:</strong> "{task.comment}"
                                  </p>
                                )}
                                {task.directorEvaluation?.comment && (
                                  <p className="text-xs text-blue-700 mt-1 italic">
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
                          <p className="text-sm text-gray-500 text-center py-4">
                            Báo cáo này không có nội dung chi tiết.
                          </p>
                        )}
                    </div>
                  </div>
                ))}
              </div>
              ) : (
                <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 font-semibold text-lg mb-2">Không có báo cáo nào cho ngày này.</p>
                  <p className="text-gray-500 text-sm">Vui lòng chọn ngày khác trong lịch.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailyReportHistoryPage

