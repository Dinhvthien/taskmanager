import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { directorService } from '../../services/directorService'
import dailyReportService from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import WorkTimeline from '../../components/WorkTimeline'
import { EyeIcon, CalendarIcon } from '@heroicons/react/24/outline'

const ScheduleRegistrationsPage = () => {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [registrations, setRegistrations] = useState([]) // Danh sách đăng ký lịch làm việc
  const [error, setError] = useState('')
  const [expandedUserId, setExpandedUserId] = useState(null) // User ID đang được mở rộng để xem chi tiết
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Hàm kiểm tra báo cáo đã gửi chưa (dựa vào comment)
  const isReportSent = (report) => {
    if (!report) return false
    
    const hasTaskComment = report.selectedTasks && report.selectedTasks.length > 0 && 
      report.selectedTasks.some(task => task.comment && task.comment.trim() !== '')
    
    const hasAdHocComment = report.adHocTasks && report.adHocTasks.length > 0 && 
      report.adHocTasks.some(ah => ah.comment && ah.comment.trim() !== '')
    
    return hasTaskComment || hasAdHocComment
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (users.length > 0 && selectedDate) {
      loadRegistrations()
    }
  }, [users, selectedDate])

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
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách nhân viên')
    } finally {
      setLoading(false)
    }
  }

  const loadRegistrations = async () => {
    if (users.length === 0) return

    try {
      setLoading(true)
      setError('')
      
      // Lấy đăng ký lịch làm việc (báo cáo chưa gửi) của tất cả nhân viên
      const registrationsList = []
      
      for (const user of users) {
        try {
          const response = await dailyReportService.getAllDailyReportsByUserId(user.userId, selectedDate)
          const allReports = response.data.result || []
          
          // Lọc các báo cáo chưa gửi (chưa có comment)
          const unsentReports = allReports.filter(report => !isReportSent(report))
          
          if (unsentReports.length > 0) {
            // Lấy báo cáo chưa gửi mới nhất
            const latestUnsentReport = unsentReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
            
            registrationsList.push({
              userId: user.userId,
              user: user,
              report: latestUnsentReport,
              createdAt: latestUnsentReport.createdAt
            })
          }
        } catch (err) {
          // Bỏ qua lỗi của từng user, tiếp tục với user khác
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error loading report for user ${user.userId}:`, err)
          }
        }
      }
      
      // Sắp xếp theo thời gian tạo (mới nhất trước)
      registrationsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      setRegistrations(registrationsList)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách đăng ký lịch làm việc')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (userId) => {
    setExpandedUserId(expandedUserId === userId ? null : userId)
  }

  // Chuẩn bị dữ liệu cho timeline
  const prepareTimelineData = (report) => {
    if (!report) return { tasks: [], adHocTasks: [] }

    const tasks = (report.selectedTasks || [])
      .filter(task => task.startTime && task.endTime)
      .map(task => ({
        id: Date.now() + Math.random(),
        taskId: task.taskId,
        task: { taskId: task.taskId, title: task.title, description: task.description },
        startTime: task.startTime || '',
        endTime: task.endTime || ''
      }))

    const adHocTasks = (report.adHocTasks || [])
      .filter(task => task.startTime && task.endTime)
      .map(task => ({
        id: task.id || Date.now() + Math.random(),
        content: task.content || '',
        startTime: task.startTime || '',
        endTime: task.endTime || ''
      }))

    return { tasks, adHocTasks }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản lý đăng ký lịch làm việc</h1>

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
              Chọn ngày
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-sm text-gray-600">
            {selectedUserId 
              ? `Hiển thị đăng ký lịch làm việc của nhân viên được chọn`
              : `${registrations.length} nhân viên đã đăng ký lịch làm việc`
            }
          </span>
        </div>
      </div>

      {/* Danh sách đăng ký lịch làm việc */}
      {loading ? (
        <LoadingSpinner />
      ) : (() => {
        // Lọc đăng ký theo nhân viên được chọn (nếu có)
        const filteredRegistrations = selectedUserId
          ? registrations.filter(reg => reg.userId === selectedUserId)
          : registrations

        return filteredRegistrations.length > 0 ? (
          <div className="space-y-4">
            {filteredRegistrations.map((registration) => {
            const { tasks, adHocTasks } = prepareTimelineData(registration.report)
            const isExpanded = expandedUserId === registration.userId
            const hasTimeline = tasks.length > 0 || adHocTasks.length > 0

            return (
              <div key={registration.userId} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {registration.user.fullName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {registration.user.email}
                      {registration.user.department && (
                        <span className="ml-2">• {registration.user.department.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Đăng ký lúc: {new Date(registration.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {registration.report.selectedTasks?.length || 0} công việc
                      </div>
                      <div className="text-xs text-gray-600">
                        {registration.report.adHocTasks?.length || 0} công việc phát sinh
                      </div>
                    </div>
                    {hasTimeline && (
                      <button
                        onClick={() => toggleExpand(registration.userId)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        {isExpanded ? 'Ẩn timeline' : 'Xem timeline'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                {isExpanded && hasTimeline && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
                    <WorkTimeline
                      selectedTasks={tasks}
                      adHocTasks={adHocTasks}
                      onAddAdHocAtTime={null}
                      mode="report"
                    />
                  </div>
                )}

                {/* Chi tiết công việc */}
                {isExpanded && (
                  <div className="mt-4 space-y-4">
                    {/* Công việc đã chọn */}
                    {registration.report.selectedTasks && registration.report.selectedTasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Công việc đã chọn ({registration.report.selectedTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {registration.report.selectedTasks.map((task, index) => (
                            <div key={task.taskId} className="border border-gray-200 rounded-lg p-3 bg-blue-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      #{index + 1}
                                    </span>
                                    {(task.startTime || task.endTime) && (
                                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                        {task.startTime || '--'} - {task.endTime || '--'}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="font-medium text-gray-900">{task.title}</h5>
                                  {task.description && (
                                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Công việc phát sinh */}
                    {registration.report.adHocTasks && registration.report.adHocTasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Công việc phát sinh ({registration.report.adHocTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {registration.report.adHocTasks.map((task, index) => (
                            <div key={task.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                      Phát sinh #{index + 1}
                                    </span>
                                    {(task.startTime || task.endTime) && (
                                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                        {task.startTime || '--'} - {task.endTime || '--'}
                                      </span>
                                    )}
                                    {task.selfScore !== null && task.selfScore !== undefined && (
                                      <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded">
                                        Điểm: {task.selfScore}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="font-medium text-gray-900">{task.content}</h5>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">
              {selectedUserId
                ? `Nhân viên được chọn chưa có đăng ký lịch làm việc cho ngày ${new Date(selectedDate).toLocaleDateString('vi-VN')}`
                : `Không có đăng ký lịch làm việc nào cho ngày ${new Date(selectedDate).toLocaleDateString('vi-VN')}`
              }
            </p>
          </div>
        )
      })()}
    </div>
  )
}

export default ScheduleRegistrationsPage

