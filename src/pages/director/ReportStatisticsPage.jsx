import { useState, useEffect } from 'react'
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
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import dailyReportService from '../../services/dailyReportService'
import { userService } from '../../services/userService'
import { directorService } from '../../services/directorService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'

const ReportStatisticsPage = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [statistics, setStatistics] = useState([])
  const [showEmployeeList, setShowEmployeeList] = useState(false) // Ẩn danh sách nhân viên mặc định
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10) // Số nhân viên mỗi trang

  useEffect(() => {
    loadUsers()
    loadStatistics()
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
    try {
      setLoading(true)
      setError('')
      const response = await dailyReportService.getEmployeesStatisticsByDate(reportDate)
      setStatistics(response.data.result || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thống kê báo cáo')
      setStatistics([])
    } finally {
      setLoading(false)
    }
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

  // Phân trang danh sách nhân viên
  const totalPages = Math.ceil(statistics.length / pageSize) || 1
  const startIndex = currentPage * pageSize
  const endIndex = startIndex + pageSize
  const paginatedStatistics = statistics.slice(startIndex, endIndex)

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
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Tổng nhân viên</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{totalEmployees}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Đã báo cáo</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{reportedEmployees}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Chưa báo cáo</div>
                <div className="text-2xl font-bold text-yellow-900 mt-1">{notReportedEmployees}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Tổng công việc</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">{totalTasks}</div>
              </div>
            </div>

            {/* Bảng danh sách nhân viên - Có thể ẩn/hiện */}
            <div className="mb-6">
              <button
                onClick={() => setShowEmployeeList(!showEmployeeList)}
                className="flex items-center justify-between w-full mb-4 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <h2 className="text-xl font-semibold text-gray-900">Danh sách nhân viên</h2>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedStatistics.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      paginatedStatistics.map((stat) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              )}

              {/* Phân trang */}
              {statistics.length > pageSize && (
                <div className="flex items-center justify-between mt-4 px-4">
                  <div className="text-sm text-gray-700">
                    Hiển thị {startIndex + 1} - {Math.min(endIndex, statistics.length)} trong tổng số {statistics.length} nhân viên
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
    </div>
  )
}

export default ReportStatisticsPage

