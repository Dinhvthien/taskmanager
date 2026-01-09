import { useState, useEffect } from 'react'
import { XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { taskScoreService } from '../services/taskScoreService'
import LoadingSpinner from './LoadingSpinner'

const ScoreHistoryModal = ({ isOpen, onClose }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [scores, setScores] = useState([])
  const [adHocTaskScores, setAdHocTaskScores] = useState([])
  const [rejectedAdHocTasks, setRejectedAdHocTasks] = useState([])
  const [averageScore, setAverageScore] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadScores()
    }
  }, [isOpen, selectedYear, selectedMonth])

  const loadScores = async () => {
    try {
      setLoading(true)
      setError('')
      const [scoresResponse, rejectedResponse] = await Promise.all([
        taskScoreService.getMyScoresByMonth(selectedYear, selectedMonth),
        taskScoreService.getMyRejectedAdHocTasksByMonth(selectedYear, selectedMonth)
      ])
      const data = scoresResponse.data.result
      setScores(data.scores || [])
      setAdHocTaskScores(data.adHocTaskScores || [])
      setAverageScore(data.averageScore)
      setRejectedAdHocTasks(rejectedResponse.data.result || [])
    } catch (err) {
      console.error('Error loading scores:', err)
      setError(err.response?.data?.message || 'Lỗi khi tải lịch sử điểm')
      setScores([])
      setAdHocTaskScores([])
      setRejectedAdHocTasks([])
      setAverageScore(null)
    } finally {
      setLoading(false)
    }
  }

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ]

  const getScoreColor = (score) => {
    if (score >= 120) return 'text-green-600 font-semibold'
    if (score >= 100) return 'text-blue-600 font-semibold'
    if (score >= 80) return 'text-yellow-600 font-semibold'
    return 'text-red-600 font-semibold'
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-6 w-6 text-white" />
              <h3 className="text-lg font-semibold text-white">Lịch sử điểm</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Month/Year Selector */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Năm:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Tháng:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {monthNames.map((name, index) => (
                    <option key={index + 1} value={index + 1}>{name}</option>
                  ))}
                </select>
              </div>
              {averageScore !== null && (
                <div className="ml-auto">
                  <span className="text-sm text-gray-600">Tổng điểm: </span>
                  <span className={`text-lg font-bold ${getScoreColor(averageScore)}`}>
                    {averageScore.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            )}

            {/* Scores List */}
            {!loading && !error && (
              <div className="space-y-4">
                {scores.length === 0 && adHocTaskScores.length === 0 && rejectedAdHocTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Không có điểm số nào trong tháng này
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Công việc thông thường */}
                    {scores.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Công việc thông thường</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Công việc
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Điểm
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Thời gian dự kiến
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Thời gian thực tế
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ngày tính điểm
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {scores.map((score) => (
                                <tr key={score.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {score.taskTitle}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`text-sm font-semibold ${getScoreColor(score.score)}`}>
                                      {score.score.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {score.expectedTimeHours.toFixed(2)} giờ
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {score.actualTimeHours.toFixed(2)} giờ
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(score.calculatedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Công việc phát sinh */}
                    {adHocTaskScores.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Công việc phát sinh</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Công việc
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Điểm
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ngày tính điểm
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {adHocTaskScores.map((score) => (
                                <tr key={score.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    <div className="max-w-md">
                                      <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded mr-2">
                                        Phát sinh
                                      </span>
                                      {score.taskContent}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`text-sm font-semibold ${getScoreColor(score.score)}`}>
                                      {score.score.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(score.calculatedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Công việc phát sinh bị từ chối */}
                    {rejectedAdHocTasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-700 mb-3">Công việc phát sinh bị từ chối</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-red-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Công việc
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Điểm tự chấm
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Đánh giá
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ghi chú GĐ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ngày báo cáo
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {rejectedAdHocTasks.map((task) => (
                                <tr key={task.adHocTaskId} className="hover:bg-red-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    <div className="max-w-md">
                                      <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded mr-2">
                                        Từ chối
                                      </span>
                                      {task.content}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {task.selfScore ? `${task.selfScore} giờ` : 'Chưa có'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {task.directorRating && (
                                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                        {task.directorRating === 'EXCELLENT' ? 'Xuất sắc' :
                                         task.directorRating === 'GOOD' ? 'Tốt' :
                                         task.directorRating === 'AVERAGE' ? 'Trung bình' :
                                         task.directorRating === 'POOR' ? 'Kém' : task.directorRating}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                                    {task.directorComment || '-'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(task.reportDate).toLocaleDateString('vi-VN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScoreHistoryModal

