import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line
} from 'recharts'
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, ChartBarIcon, DocumentArrowDownIcon, CalendarIcon, TrophyIcon } from '@heroicons/react/24/outline'
import * as XLSX from 'xlsx'
import dailyReportService from '../../services/dailyReportService'
import { userService } from '../../services/userService'
import { directorService } from '../../services/directorService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import DateInput from '../../components/DateInput'
import Modal from '../../components/Modal'

const ReportStatisticsPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [statistics, setStatistics] = useState([])
  const [filteredStatistics, setFilteredStatistics] = useState([]) // Danh sách đã filter
  const [filterType, setFilterType] = useState('all') // 'all', 'reported', 'notReported', 'withTasks'
  const [showEmployeeList, setShowEmployeeList] = useState(false) // Ẩn danh sách nhân viên mặc định
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10) // Số nhân viên mỗi trang
  const employeeListRef = useRef(null) // Ref để scroll tới danh sách nhân viên
  const [openActionMenu, setOpenActionMenu] = useState(null) // ID của nhân viên đang mở menu
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [performanceData, setPerformanceData] = useState([])

  useEffect(() => {
    loadUsers()
    // loadStatistics sẽ được gọi trong useEffect phụ thuộc reportDate
  }, [])

  useEffect(() => {
    if (reportDate) {
      loadStatistics()
      setCurrentPage(0) // Reset về trang đầu khi đổi ngày
    }
  }, [reportDate])


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

  // Filter statistics based on filterType
  useEffect(() => {
    let filtered = statistics
    
    if (filterType === 'reported') {
      filtered = statistics.filter(s => s.hasReported)
    } else if (filterType === 'notReported') {
      filtered = statistics.filter(s => !s.hasReported)
    } else if (filterType === 'withTasks') {
      filtered = statistics.filter(s => (s.statistics?.totalTasks || 0) > 0)
    }
    // filterType === 'all' -> không filter, lấy tất cả
    
    setFilteredStatistics(filtered)
    setCurrentPage(0) // Reset về trang đầu khi filter thay đổi
  }, [statistics, filterType])

  const handleSelectUser = (user) => {
    setSelectedUserId(user.userId)
    setSearchQuery(`${user.fullName} (${user.email})`)
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

  const loadUsers = async () => {
    try {
      const response = await directorService.getMyDirector()
      const director = response.data.result
      if (director) {
        const usersResponse = await userService.getUsersByDirectorId(director.directorId, 0, 1000)
        const usersList = usersResponse.data.result?.content || []
        const filteredUsersList = usersList.filter(user => 
          user.roles && (user.roles.includes('USER') || user.roles.includes('MANAGER'))
        )
        setUsers(filteredUsersList)
      }
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadStatistics = async () => {
    // Kiểm tra nếu reportDate chưa có thì không load
    if (!reportDate) {
      return
    }
    
    try {
      setLoading(true)
      setError('')
      const response = await dailyReportService.getEmployeesStatisticsByDate(reportDate)
      setStatistics(response.data.result || [])
    } catch (err) {
      // Bỏ qua lỗi 429 (Too Many Requests) để tránh spam console
      if (err.response?.status === 429) {
        console.warn('Too many requests, please wait...')
        return
      }
      setError(err.response?.data?.message || 'Lỗi khi tải thống kê báo cáo')
      setStatistics([])
    } finally {
      setLoading(false)
    }
  }

  const loadHistoryData = async (userId) => {
    try {
      setHistoryLoading(true)
      // Tính toán ngày bắt đầu (30 ngày trước)
      const endDate = new Date(reportDate)
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 30)
      
      // Load thống kê cho từng ngày trong 30 ngày qua và tìm data của user
      const historyStats = []
      const dates = []
      for (let i = 30; i >= 0; i--) {
        const date = new Date(endDate)
        date.setDate(date.getDate() - i)
        dates.push(date.toISOString().split('T')[0])
      }
      
      for (const date of dates) {
        try {
          const response = await dailyReportService.getEmployeesStatisticsByDate(date)
          const userStat = response.data.result?.find(s => s.userId === userId)
          if (userStat) {
            historyStats.push({
              date,
              totalTasks: userStat.statistics?.totalTasks || 0,
              totalAssignedTasks: userStat.statistics?.totalAssignedTasks || 0,
              totalAdHocTasks: userStat.statistics?.totalAdHocTasks || 0,
              hasReported: userStat.hasReported,
              statistics: userStat.statistics
            })
          }
        } catch (err) {
          console.error(`Error loading stats for ${date}:`, err)
        }
      }
      setHistoryData(historyStats)
    } catch (err) {
      console.error('Error loading history data:', err)
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadPerformanceData = async (userId) => {
    try {
      setPerformanceLoading(true)
      // Load thống kê 30 ngày gần nhất
      const dates = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date(reportDate)
        date.setDate(date.getDate() - i)
        dates.push(date.toISOString().split('T')[0])
      }
      
      // Load thống kê cho từng ngày và tìm data của user
      const performanceStats = []
      for (const date of dates) {
        try {
          const response = await dailyReportService.getEmployeesStatisticsByDate(date)
          const userStat = response.data.result?.find(s => s.userId === userId)
          if (userStat) {
            performanceStats.push({
              date,
              totalTasks: userStat.statistics?.totalTasks || 0,
              totalAssignedTasks: userStat.statistics?.totalAssignedTasks || 0,
              totalAdHocTasks: userStat.statistics?.totalAdHocTasks || 0,
              selfScore: userStat.statistics?.adHocTasksSelfScore || 0,
              hasReported: userStat.hasReported
            })
          }
        } catch (err) {
          console.error(`Error loading stats for ${date}:`, err)
        }
      }
      setPerformanceData(performanceStats)
    } catch (err) {
      console.error('Error loading performance data:', err)
      setPerformanceData([])
    } finally {
      setPerformanceLoading(false)
    }
  }


  const exportEvaluationReport = (stat) => {
    // Tạo báo cáo đánh giá dạng text/HTML để xuất
    const reportContent = `
BÁO CÁO ĐÁNH GIÁ HIỆU SUẤT NHÂN VIÊN
=====================================

Thông tin nhân viên:
- Họ tên: ${stat.fullName || stat.userName}
- Email: ${stat.email}
- Ngày đánh giá: ${new Date(reportDate).toLocaleDateString('vi-VN')}

Thống kê công việc:
- Công việc được giao: ${stat.statistics?.totalAssignedTasks || 0}
- Công việc phát sinh: ${stat.statistics?.totalAdHocTasks || 0}
- Tổng công việc: ${stat.statistics?.totalTasks || 0}
- Điểm tự chấm (Phát sinh): ${stat.statistics?.adHocTasksSelfScore ? stat.statistics.adHocTasksSelfScore.toFixed(1) : '-'}
- Trạng thái báo cáo: ${stat.hasReported ? 'Đã báo cáo' : 'Chưa báo cáo'}

${new Date().toLocaleString('vi-VN')}
    `
    
    // Tạo file và download
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BaoCaoDanhGia_${stat.fullName || stat.userName}_${reportDate}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }


  // Chuẩn bị dữ liệu cho biểu đồ kết hợp (công việc + điểm tự chấm)
  const combinedChartData = statistics
    .filter(stat => stat.hasReported)
    .map(stat => ({
      name: stat.fullName || stat.userName,
      userId: stat.userId,
      'Công việc được giao': stat.statistics?.totalAssignedTasks || 0,
      'Công việc phát sinh': stat.statistics?.totalAdHocTasks || 0,
      'Tổng công việc': stat.statistics?.totalTasks || 0,
      'Điểm tự chấm (Phát sinh)': stat.statistics?.adHocTasksSelfScore || 0
    }))
    .sort((a, b) => b['Tổng công việc'] - a['Tổng công việc'])

  // Phân trang danh sách nhân viên (dựa trên filteredStatistics)
  const totalPages = Math.ceil(filteredStatistics.length / pageSize) || 1
  const startIndex = currentPage * pageSize
  const endIndex = startIndex + pageSize
  const paginatedStatistics = filteredStatistics.slice(startIndex, endIndex)



  // Thống kê tổng quan
  const totalEmployees = statistics.length
  const reportedEmployees = statistics.filter(s => s.hasReported).length
  const notReportedEmployees = totalEmployees - reportedEmployees
  const totalTasks = statistics.reduce((sum, stat) => sum + (stat.statistics?.totalTasks || 0), 0)
  const totalAssignedTasks = statistics.reduce((sum, stat) => sum + (stat.statistics?.totalAssignedTasks || 0), 0)
  const totalAdHocTasks = statistics.reduce((sum, stat) => sum + (stat.statistics?.totalAdHocTasks || 0), 0)
  const totalSelfScore = statistics.reduce((sum, stat) => sum + (stat.statistics?.adHocTasksSelfScore || 0), 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Biểu đồ thống kê báo cáo</h1>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Ngày:</label>
            <DateInput
              value={reportDate}
              onChange={(value) => setReportDate(value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={loadStatistics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tải lại
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Thống kê tổng quan */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => {
                  setFilterType('all')
                  setShowEmployeeList(true)
                  setTimeout(() => {
                    employeeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }}
                className={`bg-blue-50 border rounded-lg p-4 text-left hover:bg-blue-100 transition-colors cursor-pointer ${
                  filterType === 'all' ? 'border-blue-400 ring-2 ring-blue-300' : 'border-blue-200'
                }`}
              >
                <div className="text-sm text-blue-600 font-medium">Tổng nhân viên</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{totalEmployees}</div>
              </button>
              <button
                onClick={() => {
                  setFilterType('reported')
                  setShowEmployeeList(true)
                  setTimeout(() => {
                    employeeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }}
                className={`bg-green-50 border rounded-lg p-4 text-left hover:bg-green-100 transition-colors cursor-pointer ${
                  filterType === 'reported' ? 'border-green-400 ring-2 ring-green-300' : 'border-green-200'
                }`}
              >
                <div className="text-sm text-green-600 font-medium">Đã báo cáo</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{reportedEmployees}</div>
              </button>
              <button
                onClick={() => {
                  setFilterType('notReported')
                  setShowEmployeeList(true)
                  setTimeout(() => {
                    employeeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }}
                className={`bg-yellow-50 border rounded-lg p-4 text-left hover:bg-yellow-100 transition-colors cursor-pointer ${
                  filterType === 'notReported' ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-yellow-200'
                }`}
              >
                <div className="text-sm text-yellow-600 font-medium">Chưa báo cáo</div>
                <div className="text-2xl font-bold text-yellow-900 mt-1">{notReportedEmployees}</div>
              </button>
              <button
                onClick={() => {
                  setFilterType('withTasks')
                  setShowEmployeeList(true)
                  setTimeout(() => {
                    employeeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }}
                className={`bg-purple-50 border rounded-lg p-4 text-left hover:bg-purple-100 transition-colors cursor-pointer ${
                  filterType === 'withTasks' ? 'border-purple-400 ring-2 ring-purple-300' : 'border-purple-200'
                }`}
              >
                <div className="text-sm text-purple-600 font-medium">Tổng công việc</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">{totalTasks}</div>
              </button>
            </div>

            {/* Bảng danh sách nhân viên - Có thể ẩn/hiện */}
            <div className="mb-6" ref={employeeListRef}>
              <button
                onClick={() => setShowEmployeeList(!showEmployeeList)}
                className="flex items-center justify-between w-full mb-4 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <h2 className="text-xl font-semibold text-gray-900">
                  Danh sách nhân viên
                  {filterType !== 'all' && (
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      ({filterType === 'reported' && 'Đã báo cáo'}
                       {filterType === 'notReported' && 'Chưa báo cáo'}
                       {filterType === 'withTasks' && 'Có công việc'})
                    </span>
                  )}
                </h2>
                {showEmployeeList ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {showEmployeeList && (
                <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Nhân viên
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Công việc được giao
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Công việc phát sinh
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Tổng công việc
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Điểm tự chấm (Phát sinh)
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedStatistics.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      paginatedStatistics.map((stat, index) => {
                        const isLastRow = index === paginatedStatistics.length - 1
                        return (
                          <tr key={stat.userId} className={stat.hasReported ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{stat.fullName || stat.userName}</div>
                              <div className="text-sm text-gray-500">{stat.email}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {stat.hasReported ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  Đã báo cáo
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                  Chưa báo cáo
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                              {stat.statistics?.totalAssignedTasks || 0}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                              {stat.statistics?.totalAdHocTasks || 0}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                              {stat.statistics?.totalTasks || 0}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                              {stat.statistics?.adHocTasksSelfScore ? stat.statistics.adHocTasksSelfScore.toFixed(1) : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenActionMenu(openActionMenu === stat.userId ? null : stat.userId)
                                }}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Thao tác"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                              
                              {openActionMenu === stat.userId && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setOpenActionMenu(null)}
                                  />
                                  <div className={`absolute right-0 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 ${isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigate(`/director/reports/employees?userId=${stat.userId}&date=${reportDate}`)
                                        setOpenActionMenu(null)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                    >
                                      <EyeIcon className="w-4 h-4" />
                                      <span>Xem chi tiết báo cáo</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedEmployee(stat)
                                        setShowHistoryModal(true)
                                        loadHistoryData(stat.userId)
                                        setOpenActionMenu(null)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                    >
                                      <CalendarIcon className="w-4 h-4" />
                                      <span>Xem lịch sử báo cáo</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedEmployee(stat)
                                        setShowPerformanceModal(true)
                                        loadPerformanceData(stat.userId)
                                        setOpenActionMenu(null)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                    >
                                      <ChartBarIcon className="w-4 h-4" />
                                      <span>Xem biểu đồ hiệu suất</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        exportEvaluationReport(stat)
                                        setOpenActionMenu(null)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                    >
                                      <DocumentArrowDownIcon className="w-4 h-4" />
                                      <span>Xuất báo cáo đánh giá</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                </div>
              )}

              {/* Phân trang */}
              {filteredStatistics.length > pageSize && (
                <div className="flex items-center justify-between mt-4 px-4">
                  <div className="text-sm text-gray-700">
                    Hiển thị {startIndex + 1} - {Math.min(endIndex, filteredStatistics.length)} trong tổng số {filteredStatistics.length} nhân viên
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Trước
                    </button>
                    <span className="px-4 py-2 text-gray-700">
                      Trang {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Biểu đồ kết hợp: Tổng công việc đăng ký và Điểm tự chấm */}
            {combinedChartData.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Biểu đồ tổng công việc đăng ký và điểm tự chấm
                </h2>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <ResponsiveContainer width="100%" height={450}>
                    <ComposedChart data={combinedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis 
                        yAxisId="left"
                        label={{ value: 'Số lượng công việc', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Điểm tự chấm', angle: 90, position: 'insideRight' }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="Công việc được giao" fill="#3B82F6" name="Công việc được giao" />
                      <Bar yAxisId="left" dataKey="Công việc phát sinh" fill="#F59E0B" name="Công việc phát sinh" />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="Điểm tự chấm (Phát sinh)" 
                        stroke="#10B981" 
                        strokeWidth={3}
                        dot={{ fill: '#10B981', r: 5 }}
                        name="Điểm tự chấm (Phát sinh)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-gray-600">
                    <p><span className="inline-block w-3 h-3 bg-blue-500 rounded mr-2"></span> Công việc được giao: Số lượng công việc được giao từ hệ thống</p>
                    <p className="mt-1"><span className="inline-block w-3 h-3 bg-orange-500 rounded mr-2"></span> Công việc phát sinh: Số lượng công việc tự đăng ký</p>
                    <p className="mt-1"><span className="inline-block w-3 h-3 bg-green-500 rounded mr-2"></span> Điểm tự chấm: Tổng điểm tự chấm của công việc phát sinh (đơn vị: điểm)</p>
                  </div>
                </div>
              </div>
            )}

            {combinedChartData.length === 0 && statistics.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                Không có dữ liệu báo cáo cho ngày này. Hãy chọn ngày khác.
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Lịch sử báo cáo */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false)
          setSelectedEmployee(null)
          setHistoryData([])
        }}
        title={`Lịch sử báo cáo - ${selectedEmployee?.fullName || selectedEmployee?.userName || ''}`}
        size="lg"
      >
        {historyLoading ? (
          <LoadingSpinner />
        ) : historyData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có dữ liệu lịch sử báo cáo
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Công việc được giao</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Công việc phát sinh</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tổng công việc</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.reportDate || item.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {item.totalAssignedTasks || item.statistics?.totalAssignedTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {item.totalAdHocTasks || item.statistics?.totalAdHocTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {item.totalTasks || item.statistics?.totalTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {item.hasReported || (item.reportDate ? true : false) ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Đã báo cáo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Chưa báo cáo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Modal Biểu đồ hiệu suất */}
      <Modal
        isOpen={showPerformanceModal}
        onClose={() => {
          setShowPerformanceModal(false)
          setSelectedEmployee(null)
          setPerformanceData([])
        }}
        title={`Biểu đồ hiệu suất - ${selectedEmployee?.fullName || selectedEmployee?.userName || ''}`}
        size="xl"
      >
        {performanceLoading ? (
          <LoadingSpinner />
        ) : performanceData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có dữ liệu hiệu suất
          </div>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={performanceData.map(item => ({
                date: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                'Công việc được giao': item.totalAssignedTasks,
                'Công việc phát sinh': item.totalAdHocTasks,
                'Tổng công việc': item.totalTasks,
                'Điểm tự chấm': item.selfScore,
                'Đã báo cáo': item.hasReported ? 1 : 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Số lượng', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Điểm', angle: 90, position: 'insideRight' }}
                />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="Công việc được giao" fill="#3B82F6" name="Công việc được giao" />
                <Bar yAxisId="left" dataKey="Công việc phát sinh" fill="#F59E0B" name="Công việc phát sinh" />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Điểm tự chấm" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                  name="Điểm tự chấm"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-blue-600 font-medium">Trung bình công việc/ngày</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {(performanceData.reduce((sum, item) => sum + item.totalTasks, 0) / performanceData.length).toFixed(1)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-green-600 font-medium">Tỷ lệ báo cáo</div>
                <div className="text-2xl font-bold text-green-900 mt-1">
                  {((performanceData.filter(item => item.hasReported).length / performanceData.length) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}

export default ReportStatisticsPage

