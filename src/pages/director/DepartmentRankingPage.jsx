import { useState, useEffect } from 'react'
import { 
  TrophyIcon, 
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import * as XLSX from 'xlsx'
import dailyReportService from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import Modal from '../../components/Modal'

const DepartmentRankingPage = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rankingCriteria, setRankingCriteria] = useState('performanceScore') // 'performanceScore', 'completionRate', 'totalTasks', 'totalScore'
  const [rankingPeriod, setRankingPeriod] = useState('month') // 'month' hoặc 'year'
  const [rankingMonth, setRankingMonth] = useState(new Date().getMonth() + 1) // 1-12
  const [rankingYear, setRankingYear] = useState(new Date().getFullYear()) // Năm
  const [rankingStatistics, setRankingStatistics] = useState([]) // Dữ liệu thống kê cho xếp hạng
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [employeeStatistics, setEmployeeStatistics] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [showReportHistoryModal, setShowReportHistoryModal] = useState(false)
  const [reportHistory, setReportHistory] = useState([])
  const [loadingReportHistory, setLoadingReportHistory] = useState(false)

  // Load thống kê xếp hạng khi thay đổi period/month/year
  useEffect(() => {
    loadRankingStatistics()
  }, [rankingPeriod, rankingMonth, rankingYear])

  // Load thống kê theo tháng/năm cho xếp hạng
  const loadRankingStatistics = async () => {
    try {
      setLoadingRanking(true)
      setError('')
      
      let startDate, endDate
      if (rankingPeriod === 'month') {
        // Tính ngày đầu và cuối tháng
        startDate = new Date(rankingYear, rankingMonth - 1, 1)
        endDate = new Date(rankingYear, rankingMonth, 0) // Ngày cuối tháng
      } else {
        // Tính ngày đầu và cuối năm
        startDate = new Date(rankingYear, 0, 1)
        endDate = new Date(rankingYear, 11, 31)
      }
      
      // Gọi API backend để lấy thống kê theo khoảng thời gian
      const response = await dailyReportService.getDepartmentsStatisticsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      const stats = response.data.result || []
      
      // Chuyển đổi dữ liệu từ backend sang format phù hợp với frontend
      const aggregatedStats = stats.map(stat => ({
        departmentId: stat.departmentId,
        departmentName: stat.departmentName,
        managerId: stat.managerId,
        managerName: stat.managerName,
        managerEmail: stat.managerEmail,
        totalEmployees: stat.totalEmployees || 0,
        totalAssignedTasks: stat.statistics?.totalAssignedTasks || 0,
        totalCompletedTasks: stat.statistics?.totalCompletedTasks || 0,
        totalInProgressTasks: stat.statistics?.totalInProgressTasks || 0,
        totalPendingTasks: stat.statistics?.totalPendingTasks || 0,
        totalScore: stat.statistics?.totalScore || 0,
        avgScore: stat.statistics?.avgScore || 0,
        totalEmployeeReports: stat.statistics?.totalEmployeeReports || 0,
        totalReportDays: stat.statistics?.totalReportDays || 0,
        reportRate: stat.statistics?.reportRate || 0,
        performanceScore: stat.statistics?.performanceScore || 0
      }))
      
      setRankingStatistics(aggregatedStats)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thống kê xếp hạng')
      setRankingStatistics([])
    } finally {
      setLoadingRanking(false)
    }
  }

  // Tính toán xếp hạng
  const getRankingData = () => {
    return rankingStatistics.map(stat => {
      // Tính điểm xếp hạng
      let rankingScore = 0
      if (rankingCriteria === 'totalTasks') {
        rankingScore = stat.totalAssignedTasks || 0
      } else if (rankingCriteria === 'totalScore') {
        rankingScore = stat.totalScore || 0
      } else {
        rankingScore = stat.reportRate || 0
      }
      
      return {
        ...stat,
        rankingScore
      }
    }).sort((a, b) => b.rankingScore - a.rankingScore)
  }

  const rankingData = getRankingData()

  // Xuất bảng xếp hạng ra Excel
  const exportRankingToExcel = () => {
    if (rankingData.length === 0) {
      alert('Không có dữ liệu để xuất')
      return
    }
    
    // Chuẩn bị dữ liệu cho Excel
    const excelData = rankingData.map((stat, index) => ({
      'Hạng': index + 1,
      'Phòng ban': stat.departmentName || '',
      'Trưởng phòng': stat.managerName || 'Chưa có',
      'Email': stat.managerEmail || '',
      'Số nhân viên': stat.totalEmployees,
      'Công việc được giao': stat.totalAssignedTasks,
      'Công việc hoàn thành': stat.totalCompletedTasks,
      'Công việc đang làm': stat.totalInProgressTasks,
      'Công việc chờ xử lý': stat.totalPendingTasks,
      'Điểm công việc đã hoàn thành': stat.totalScore ? parseFloat(stat.totalScore).toFixed(2) : '0.00',
      'Số báo cáo': stat.totalEmployeeReports,
      'Số ngày báo cáo': stat.totalReportDays,
      'Tỷ lệ báo cáo (%)': stat.reportRate ? parseFloat(stat.reportRate).toFixed(2) : '0.00',
      'Điểm hiệu suất': stat.performanceScore ? parseFloat(stat.performanceScore).toFixed(2) : '0.00'
    }))
    
    // Tạo worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Điều chỉnh độ rộng cột
    const colWidths = [
      { wch: 8 },   // Hạng
      { wch: 25 },  // Phòng ban
      { wch: 25 },  // Trưởng phòng
      { wch: 30 },  // Email
      { wch: 15 },  // Số nhân viên
      { wch: 20 },  // Công việc được giao
      { wch: 20 },  // Công việc hoàn thành
      { wch: 18 },  // Công việc đang làm
      { wch: 20 },  // Công việc chờ xử lý
      { wch: 15 },  // Số báo cáo
      { wch: 18 },  // Số ngày báo cáo
      { wch: 18 }   // Tỷ lệ báo cáo
    ]
    ws['!cols'] = colWidths
    
    // Tạo workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Xếp hạng')
    
    // Tạo tên file
    const periodText = rankingPeriod === 'month' 
      ? `Thang${rankingMonth}_${rankingYear}`
      : `Nam${rankingYear}`
    const criteriaText = rankingCriteria === 'totalTasks' ? 'TongCongViec'
      : rankingCriteria === 'totalScore' ? 'TongDiem'
      : 'TyLeBaoCao'
    const fileName = `BangXepHangPhongBan_${criteriaText}_${periodText}.xlsx`
    
    // Xuất file
    XLSX.writeFile(wb, fileName)
  }

  // Load lịch sử báo cáo của phòng ban
  const loadDepartmentReportHistory = async (department) => {
    try {
      setLoadingReportHistory(true)
      setError('')
      
      let startDate, endDate
      if (rankingPeriod === 'month') {
        startDate = new Date(rankingYear, rankingMonth - 1, 1)
        endDate = new Date(rankingYear, rankingMonth, 0)
      } else {
        startDate = new Date(rankingYear, 0, 1)
        endDate = new Date(rankingYear, 11, 31)
      }
      
      const response = await dailyReportService.getDepartmentReportHistory(
        department.departmentId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      const history = response.data.result || []
      setReportHistory(history)
      setSelectedDepartment(department)
      setShowReportHistoryModal(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải lịch sử báo cáo')
      setReportHistory([])
    } finally {
      setLoadingReportHistory(false)
    }
  }

  // Load thống kê nhân viên trong phòng ban
  const loadDepartmentEmployees = async (department) => {
    try {
      setLoadingEmployees(true)
      setError('')
      
      let startDate, endDate
      if (rankingPeriod === 'month') {
        startDate = new Date(rankingYear, rankingMonth - 1, 1)
        endDate = new Date(rankingYear, rankingMonth, 0)
      } else {
        startDate = new Date(rankingYear, 0, 1)
        endDate = new Date(rankingYear, 11, 31)
      }
      
      const response = await dailyReportService.getDepartmentEmployeesStatisticsByDateRange(
        department.departmentId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      const stats = response.data.result || []
      
      // Chuyển đổi và sắp xếp theo điểm hiệu suất (giảm dần)
      const sortedStats = stats.map(stat => ({
        userId: stat.userId,
        fullName: stat.fullName || stat.userName,
        userName: stat.userName,
        email: stat.email,
        totalAssignedTasks: stat.statistics?.totalAssignedTasks || 0,
        totalCompletedTasks: stat.statistics?.totalCompletedTasks || 0,
        completionRate: stat.statistics?.completionRate || 0,
        totalScore: stat.statistics?.totalScore || 0,
        performanceScore: stat.statistics?.performanceScore || 0
      })).sort((a, b) => b.performanceScore - a.performanceScore)
      
      setEmployeeStatistics(sortedStats)
      setSelectedDepartment(department)
      setShowEmployeeModal(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thống kê nhân viên')
      setEmployeeStatistics([])
    } finally {
      setLoadingEmployees(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Xếp hạng phòng ban</h1>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Bộ lọc tiêu chí xếp hạng */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Xếp hạng theo:</label>
            <select
              value={rankingCriteria}
              onChange={(e) => setRankingCriteria(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="totalTasks">Tổng công việc</option>
              <option value="totalScore">Tổng điểm</option>
              <option value="performanceScore">Điểm hiệu suất</option>
              <option value="reportRate">Tỷ lệ báo cáo</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Khoảng thời gian:</label>
            <select
              value={rankingPeriod}
              onChange={(e) => setRankingPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="month">Theo tháng</option>
              <option value="year">Theo năm</option>
            </select>
          </div>
          {rankingPeriod === 'month' ? (
            <>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Tháng:</label>
                <select
                  value={rankingMonth}
                  onChange={(e) => setRankingMonth(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>Tháng {month}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Năm:</label>
                <select
                  value={rankingYear}
                  onChange={(e) => setRankingYear(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Năm:</label>
              <select
                value={rankingYear}
                onChange={(e) => setRankingYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center ml-auto">
            <button
              onClick={exportRankingToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>
        
        {loadingRanking && (
          <div className="mt-4 text-center">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {/* Bảng xếp hạng */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-16">
                Hạng
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Phòng ban
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Trưởng phòng
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Số nhân viên
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Công việc được giao
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Công việc hoàn thành
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Điểm công việc đã hoàn thành
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Tỷ lệ báo cáo (%)
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Điểm hiệu suất
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rankingData.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                  {loadingRanking ? 'Đang tải...' : 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              rankingData.map((stat, index) => {
                const rank = index + 1
                
                return (
                  <tr 
                    key={stat.departmentId} 
                    className={`${rank <= 3 ? 'ring-2 ring-yellow-300' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {rank <= 3 ? (
                        <div className="flex items-center justify-center">
                          <TrophyIcon className={`w-6 h-6 ${
                            rank === 1 ? 'text-yellow-500' : 
                            rank === 2 ? 'text-gray-400' : 
                            'text-orange-600'
                          }`} />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">#{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{stat.departmentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {stat.managerName ? (
                        <>
                          <div className="text-sm font-medium text-gray-900">{stat.managerName}</div>
                          <div className="text-xs text-gray-500">{stat.managerEmail}</div>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalEmployees || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalAssignedTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalCompletedTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {stat.totalScore ? parseFloat(stat.totalScore).toFixed(1) : '0.0'}
                    </td>
                    <td 
                      className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => loadDepartmentReportHistory(stat)}
                      title="Nhấn để xem lịch sử báo cáo"
                    >
                      <span className={`${
                        stat.reportRate >= 80 ? 'text-green-600' :
                        stat.reportRate >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stat.reportRate ? parseFloat(stat.reportRate).toFixed(1) : '0.0'}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-bold">
                      <span className={`${
                        stat.performanceScore >= 80 ? 'text-green-600' :
                        stat.performanceScore >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stat.performanceScore ? parseFloat(stat.performanceScore).toFixed(1) : '0.0'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => loadDepartmentEmployees(stat)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-1 mx-auto"
                      >
                        <EyeIcon className="w-4 h-4" />
                        <span>Xem nhân viên</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Xếp hạng nhân viên trong phòng ban */}
      <Modal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false)
          setSelectedDepartment(null)
          setEmployeeStatistics([])
        }}
        title={`Xếp hạng nhân viên - ${selectedDepartment?.departmentName || ''}`}
        size="xl"
      >
        {loadingEmployees ? (
          <div className="text-center py-8">
            <LoadingSpinner />
          </div>
        ) : employeeStatistics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có dữ liệu nhân viên
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Hạng</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhân viên</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Công việc được giao</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tỷ lệ hoàn thành</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Số điểm của công việc</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Điểm hiệu suất</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeStatistics.map((emp, index) => {
                  const rank = index + 1
                  return (
                    <tr key={emp.userId} className={rank <= 3 ? 'ring-2 ring-yellow-300' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {rank <= 3 ? (
                          <TrophyIcon className={`w-5 h-5 mx-auto ${
                            rank === 1 ? 'text-yellow-500' : 
                            rank === 2 ? 'text-gray-400' : 
                            'text-orange-600'
                          }`} />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">#{rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{emp.fullName || emp.userName}</div>
                        <div className="text-xs text-gray-500">{emp.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                        {emp.totalAssignedTasks || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        <span className={`${
                          emp.completionRate >= 80 ? 'text-green-600' :
                          emp.completionRate >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {emp.totalCompletedTasks || 0}/{emp.totalAssignedTasks || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                        {emp.totalScore ? parseFloat(emp.totalScore).toFixed(1) : '0.0'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-bold">
                        <span className={`${
                          emp.performanceScore >= 80 ? 'text-green-600' :
                          emp.performanceScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {emp.performanceScore ? parseFloat(emp.performanceScore).toFixed(1) : '0.0'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Modal Lịch sử báo cáo phòng ban */}
      <Modal
        isOpen={showReportHistoryModal}
        onClose={() => {
          setShowReportHistoryModal(false)
          setSelectedDepartment(null)
          setReportHistory([])
        }}
        title={`Lịch sử báo cáo - ${selectedDepartment?.departmentName || ''}`}
        size="xl"
      >
        {loadingReportHistory ? (
          <div className="text-center py-8">
            <LoadingSpinner />
          </div>
        ) : reportHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có lịch sử báo cáo trong khoảng thời gian này
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày báo cáo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trưởng phòng</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Đánh giá</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportHistory.map((report) => {
                  const getRatingColor = (rating) => {
                    switch (rating) {
                      case 'EXCELLENT':
                        return 'text-green-600 bg-green-50'
                      case 'GOOD':
                        return 'text-blue-600 bg-blue-50'
                      case 'AVERAGE':
                        return 'text-yellow-600 bg-yellow-50'
                      case 'POOR':
                        return 'text-red-600 bg-red-50'
                      default:
                        return 'text-gray-600 bg-gray-50'
                    }
                  }
                  
                  const getRatingText = (rating) => {
                    switch (rating) {
                      case 'EXCELLENT':
                        return 'Xuất sắc'
                      case 'GOOD':
                        return 'Tốt'
                      case 'AVERAGE':
                        return 'Trung bình'
                      case 'POOR':
                        return 'Kém'
                      default:
                        return 'Chưa đánh giá'
                    }
                  }
                  
                  return (
                    <tr key={report.reportId}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(report.reportDate).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {report.managerName ? (
                          <>
                            <div className="text-sm font-medium text-gray-900">{report.managerName}</div>
                            <div className="text-xs text-gray-500">{report.managerEmail}</div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">Chưa có</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {report.rating ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRatingColor(report.rating)}`}>
                            {getRatingText(report.rating)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Chưa đánh giá</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {report.comment ? (
                          <div className="max-w-md">{report.comment}</div>
                        ) : (
                          <span className="text-gray-400">Không có ghi chú</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DepartmentRankingPage

