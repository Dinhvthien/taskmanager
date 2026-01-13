import { useState, useEffect } from 'react'
import { 
  TrophyIcon, 
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import * as XLSX from 'xlsx'
import dailyReportService from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import Modal from '../../components/Modal'

const EmployeeRankingPage = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rankingCriteria, setRankingCriteria] = useState('totalTasks') // 'totalTasks', 'selfScore', 'reportRate'
  const [rankingPeriod, setRankingPeriod] = useState('month') // 'month' hoặc 'year'
  const [rankingMonth, setRankingMonth] = useState(new Date().getMonth() + 1) // 1-12
  const [rankingYear, setRankingYear] = useState(new Date().getFullYear()) // Năm
  const [rankingStatistics, setRankingStatistics] = useState([]) // Dữ liệu thống kê cho xếp hạng
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState([])

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
      const response = await dailyReportService.getEmployeesStatisticsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      const stats = response.data.result || []
      
      // Chuyển đổi dữ liệu từ backend sang format phù hợp với frontend
      const aggregatedStats = stats.map(stat => ({
        userId: stat.userId,
        fullName: stat.fullName || stat.userName,
        userName: stat.userName,
        email: stat.email,
        totalAssignedTasks: stat.statistics?.totalAssignedTasks || 0,
        totalAdHocTasks: stat.statistics?.totalAdHocTasks || 0, // Chỉ công việc phát sinh đã được duyệt
        totalTasks: stat.statistics?.totalTasks || 0, // Tổng công việc hoàn thành (công việc được giao đã hoàn thành + công việc phát sinh được duyệt)
        totalScore: stat.statistics?.totalScore || 0, // Tổng điểm công việc hoàn thành (điểm công việc được giao đã hoàn thành + điểm công việc phát sinh được chấp nhận)
        adHocTasksNotScored: stat.statistics?.adHocTasksNotScored || 0, // Số công việc phát sinh chưa tính điểm
        reportRate: stat.statistics?.reportRate || 0,
        performanceScore: stat.statistics?.performanceScore || 0,
        hasReported: stat.hasReported || false
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
      // Tính tỷ lệ báo cáo
      const reportRate = parseFloat(stat.reportRate || 0)
      
      // Tính điểm xếp hạng
      let rankingScore = 0
      if (rankingCriteria === 'totalTasks') {
        rankingScore = stat.totalTasks
      } else if (rankingCriteria === 'totalScore') {
        rankingScore = stat.totalScore || 0
      } else if (rankingCriteria === 'performanceScore') {
        rankingScore = stat.performanceScore || 0
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
      'Họ tên': stat.fullName || stat.userName || '',
      'Email': stat.email || '',
      'Công việc được giao': stat.totalAssignedTasks,
      'Công việc phát sinh': stat.totalAdHocTasks,
      'Công việc phát sinh chưa tính điểm': stat.adHocTasksNotScored || 0,
      'Tổng công việc hoàn thành': stat.totalTasks,
      'Tổng điểm hoàn thành': stat.totalScore ? parseFloat(stat.totalScore).toFixed(1) : '0.0',
      'Tỷ lệ báo cáo (%)': stat.reportRate ? parseFloat(stat.reportRate).toFixed(2) : '0.00',
      'Điểm hiệu suất': stat.performanceScore ? parseFloat(stat.performanceScore).toFixed(2) : '0.00'
    }))
    
    // Tạo worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Điều chỉnh độ rộng cột
    const colWidths = [
      { wch: 8 },  // Hạng
      { wch: 25 }, // Họ tên
      { wch: 30 }, // Email
      { wch: 20 }, // Công việc được giao
      { wch: 20 }, // Công việc phát sinh
      { wch: 15 }, // Tổng công việc
      { wch: 18 }, // Tổng điểm tự chấm
      { wch: 15 }, // Tổng điểm
      { wch: 30 }  // Công việc phát sinh chưa tính điểm
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
      : rankingCriteria === 'performanceScore' ? 'DiemHieuSuat'
      : 'TyLeBaoCao'
    const fileName = `BangXepHang_${criteriaText}_${periodText}.xlsx`
    
    // Xuất file
    XLSX.writeFile(wb, fileName)
  }

  const loadHistoryData = async (userId) => {
    try {
      setHistoryLoading(true)
      // Tính toán ngày bắt đầu (30 ngày trước)
      const endDate = new Date()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Xếp hạng nhân viên</h1>
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
              <option value="totalTasks">Tổng công việc hoàn thành</option>
              <option value="totalScore">Tổng điểm hoàn thành</option>
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
                Nhân viên
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Công việc được giao
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Công việc phát sinh
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Công việc phát sinh chưa tính điểm
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Tổng công việc hoàn thành
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Tổng điểm hoàn thành
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
                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                  {loadingRanking ? 'Đang tải...' : 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              rankingData.map((stat, index) => {
                const rank = index + 1
                
                return (
                  <tr 
                    key={stat.userId} 
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
                      <div className="text-sm font-medium text-gray-900">{stat.fullName || stat.userName}</div>
                      <div className="text-sm text-gray-500">{stat.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalAssignedTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalAdHocTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.adHocTasksNotScored || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {stat.totalTasks || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {stat.totalScore ? parseFloat(stat.totalScore).toFixed(1) : '0.0'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
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
                        onClick={() => {
                          setSelectedEmployee(stat)
                          setShowHistoryModal(true)
                          loadHistoryData(stat.userId)
                        }}
                        className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
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
                {historyData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.totalAssignedTasks}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.totalAdHocTasks}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.totalTasks}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {item.hasReported ? (
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
    </div>
  )
}

export default EmployeeRankingPage

