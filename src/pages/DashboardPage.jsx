import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MyTasksPage from './user/MyTasksPage'
import { taskService } from '../services/taskService'
import { directorService } from '../services/directorService'
import { departmentService } from '../services/departmentService'
import { userService } from '../services/userService'
import LoadingSpinner from '../components/LoadingSpinner'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../utils/constants'

const DashboardPage = ({ role = 'user' }) => {
  // Nếu là user, hiển thị trang "Task của tôi"
  if (role === 'user') {
    return <MyTasksPage />
  }

  const [director, setDirector] = useState(null)
  const [tasks, setTasks] = useState([])
  const [recentTasks, setRecentTasks] = useState([])
  const [urgentTasks, setUrgentTasks] = useState([])
  const [waitingTasks, setWaitingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    pending: 0,
    totalUsers: 0,
    totalDepartments: 0
  })
  const navigate = useNavigate()

  useEffect(() => {
    if (role === 'director') {
      loadDirector()
    }
  }, [role])

  useEffect(() => {
    if (director && role === 'director') {
      loadTasks()
      loadUsersAndDepartments()
    }
  }, [director, role])

  const loadDirector = async () => {
    try {
      const response = await directorService.getMyDirector()
      setDirector(response.data.result)
    } catch (err) {
      console.error('Error loading director:', err)
    }
  }

  const loadTasks = async () => {
    if (!director) return

    try {
      setLoading(true)
      const response = await taskService.getTasksByDirectorId(director.directorId, 0, 1000) // Load nhiều để tính stats
      const tasksList = response.data.result?.content || []
      setTasks(tasksList)

      // Calculate statistics
      const total = tasksList.length
      const inProgress = tasksList.filter(t => t.status === 'IN_PROGRESS').length
      const completed = tasksList.filter(t => t.status === 'COMPLETED').length
      const pending = tasksList.filter(t => t.status === 'PENDING' || t.status === 'ACCEPTED').length

      setStats(prev => ({ ...prev, total, inProgress, completed, pending }))

      // Get 10 most recent tasks (sorted by createdAt or updatedAt, most recent first)
      const sortedTasks = [...tasksList].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0)
        const dateB = new Date(b.updatedAt || b.createdAt || 0)
        return dateB - dateA
      })
      setRecentTasks(sortedTasks.slice(0, 10))

      // Get urgent tasks (deadline within 48 hours and not completed)
      const now = new Date()
      const urgent = tasksList.filter(task => {
        if (task.status === 'COMPLETED') return false
        if (!task.endDate) return false
        const deadline = new Date(task.endDate)
        const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60)
        return hoursUntilDeadline > 0 && hoursUntilDeadline <= 48
      }).sort((a, b) => {
        const dateA = new Date(a.endDate)
        const dateB = new Date(b.endDate)
        return dateA - dateB
      })
      setUrgentTasks(urgent.slice(0, 5))

      // Get waiting tasks with reasons (từ departmentWaitingReasons)
      // Lọc các task có thể đang chờ trước
      const potentialWaitingTasks = tasksList.filter(task => {
        // Task có status WAITING hoặc có ít nhất một phòng ban đang chờ
        if (task.status === 'WAITING') return true
        if (task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0) {
          return Object.values(task.departmentWaitingReasons).some(reason => reason && reason.trim())
        }
        return false
      }).slice(0, 5) // Chỉ load chi tiết 5 task đầu tiên để tối ưu

      // Load chi tiết đầy đủ cho các task đang chờ để có departmentWaitingReasons
      const waitingTasksWithDetails = await Promise.all(
        potentialWaitingTasks.map(async (task) => {
          try {
            const detailResponse = await taskService.getTaskById(task.taskId)
            return detailResponse.data.result || task
          } catch (err) {
            console.error(`Error loading task detail ${task.taskId}:`, err)
            return task
          }
        })
      )

      // Xử lý lý do chờ từ dữ liệu đầy đủ
      const waiting = waitingTasksWithDetails
        .map(task => {
          // Lấy tất cả lý do chờ từ các phòng ban
          const deptReasons = task.departmentWaitingReasons || {}
          const reasonsList = Object.entries(deptReasons)
            .filter(([deptId, reason]) => reason && reason.trim())
            .map(([deptId, reason]) => {
              const deptName = task.departmentNames?.[task.departmentIds?.indexOf(parseInt(deptId))] || `Phòng ban ${deptId}`
              return { deptId, deptName, reason }
            })
          
          // Nếu không có lý do từ departmentWaitingReasons, kiểm tra waitingReason của task
          if (reasonsList.length === 0 && task.waitingReason) {
            return {
              ...task,
              waitingReasons: [{ deptId: null, deptName: 'Task', reason: task.waitingReason }],
              waitingReason: task.waitingReason
            }
          }
          
          return {
            ...task,
            waitingReasons: reasonsList, // Danh sách lý do chờ theo phòng ban
            waitingReason: reasonsList.length > 0 ? reasonsList[0].reason : (task.waitingReason || null) // Lý do đầu tiên để hiển thị
          }
        })
        .filter(task => {
          // Chỉ giữ lại task thực sự có lý do chờ
          return task.waitingReasons && task.waitingReasons.length > 0
        })
      
      setWaitingTasks(waiting)
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUsersAndDepartments = async () => {
    if (!director) return

    try {
      // Load users
      const usersResponse = await userService.getUsersByDirectorId(director.directorId, 0, 1)
      const totalUsers = usersResponse.data.result?.totalElements || 0

      // Load departments
      const deptsResponse = await departmentService.getDepartmentsByDirectorId(director.directorId)
      const totalDepartments = (deptsResponse.data.result || []).length

      setStats(prev => ({ ...prev, totalUsers, totalDepartments }))
    } catch (err) {
      console.error('Error loading users and departments:', err)
    }
  }


  const getTitle = () => {
    switch (role) {
      case 'super-admin':
        return ''
      case 'director':
        return ''
      case 'manager':
        return ''
      default:
        return ''
    }
  }

  const getDescription = () => {
    switch (role) {
      case 'super-admin':
        return ''
      case 'director':
        return ''
      case 'manager':
        return ''
      default:
        return ''
    }
  }

  if (role === 'director' && loading) {
    return <LoadingSpinner />
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{getTitle()}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{getDescription()}</p>
      </div>

      {role === 'director' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <div 
              onClick={() => navigate('/director/tasks')}
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-blue-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-blue-700 mb-1">Tổng Tasks</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-900">{stats.total}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/director/tasks/danglam')}
              className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-yellow-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-yellow-700 mb-1">Đang làm</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-900">{stats.inProgress}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-yellow-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/director/tasks/hoanthanh')}
              className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-green-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-green-700 mb-1">Hoàn thành</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-900">{stats.completed}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-green-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/director/tasks/choduyet')}
              className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Chờ xác nhận</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.pending}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gray-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/director/users')}
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-purple-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-purple-700 mb-1">Nhân viên</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-900">{stats.totalUsers}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-purple-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigate('/director/departments')}
              className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-indigo-200 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-indigo-700 mb-1">Phòng ban</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-indigo-900">{stats.totalDepartments}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-indigo-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
            <button
              onClick={() => navigate('/director/tasks')}
              className="bg-white rounded-lg shadow-md p-3 sm:p-4 hover:shadow-lg transition-shadow text-left border border-gray-200 hover:border-blue-300"
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Tasks công ty</p>
                  <p className="text-xs text-gray-500 hidden sm:block">Quản lý công việc</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/director/users')}
              className="bg-white rounded-lg shadow-md p-3 sm:p-4 hover:shadow-lg transition-shadow text-left border border-gray-200 hover:border-purple-300"
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Nhân viên</p>
                  <p className="text-xs text-gray-500">Quản lý nhân viên</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/director/departments')}
              className="bg-white rounded-lg shadow-md p-3 sm:p-4 hover:shadow-lg transition-shadow text-left border border-gray-200 hover:border-indigo-300"
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Phòng ban</p>
                  <p className="text-xs text-gray-500">Quản lý phòng ban</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/director/reports')}
              className="bg-white rounded-lg shadow-md p-3 sm:p-4 hover:shadow-lg transition-shadow text-left border border-gray-200 hover:border-green-300"
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Báo cáo</p>
                  <p className="text-xs text-gray-500">Xuất báo cáo</p>
                </div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
            {/* Bảng 10 công việc gần nhất */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">10 Công việc gần nhất</h2>
                <button
                  onClick={() => navigate('/director/tasks')}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-xs flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Xem tất cả</span>
                  <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tiêu đề
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tiến độ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentTasks.length > 0 ? (
                      recentTasks.map((task) => {
                        return (
                          <tr key={task.taskId} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/director/tasks/${task.taskId}`)}>
                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-1">{task.title}</div>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px] sm:min-w-[100px]">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{ width: `${task.progress || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-gray-900 min-w-[35px] sm:min-w-[40px]">
                                  {task.progress || 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="2" className="px-6 py-8 text-center text-gray-500">
                          Chưa có công việc nào
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tasks sắp đến hạn */}
            {urgentTasks.length > 0 && (
              <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-red-200 overflow-hidden">
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-red-700">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Tasks sắp đến hạn</h2>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="space-y-2 sm:space-y-3">
                    {urgentTasks.map((task) => {
                      const deadline = new Date(task.endDate)
                      const now = new Date()
                      const hoursLeft = Math.ceil((deadline - now) / (1000 * 60 * 60))
                      return (
                        <div
                          key={task.taskId}
                          onClick={() => navigate(`/director/tasks/${task.taskId}`)}
                          className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate flex-1">{task.title}</p>
                            <span className="text-xs font-bold text-red-600 ml-2 flex-shrink-0">
                              {hoursLeft <= 6 ? 'Cấp bách' : `${hoursLeft}h`}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Hạn: {deadline.toLocaleString('vi-VN')}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tasks đang chờ */}
            {waitingTasks.length > 0 && (
              <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-orange-200 overflow-hidden">
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-orange-600 to-orange-700">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Tasks đang chờ</h2>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="space-y-2 sm:space-y-3">
                    {waitingTasks.map((task) => (
                      <div
                        key={task.taskId}
                        onClick={() => navigate(`/director/tasks/${task.taskId}`)}
                        className="p-2 sm:p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                      >
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-2 truncate">{task.title}</p>
                        {task.waitingReasons && task.waitingReasons.length > 0 ? (
                          <div className="space-y-1">
                            {task.waitingReasons.map((item, idx) => (
                              <div key={idx} className="text-xs text-orange-700">
                                <span className="font-semibold">{item.deptName}:</span> <span className="break-words">{item.reason}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-orange-500 italic">Chưa có lý do chờ</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {role !== 'director' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tổng Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Đang làm</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Hoàn thành</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Chưa bắt đầu</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Chào mừng đến với hệ thống!</h2>
            <p className="text-gray-600">
              Bạn có thể bắt đầu sử dụng các tính năng từ menu bên trái.
            </p>
          </div>
        </>
      )}

    </div>
  )
}

export default DashboardPage

