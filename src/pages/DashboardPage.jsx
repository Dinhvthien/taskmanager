import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MyTasksPage from './user/MyTasksPage'
import { taskService } from '../services/taskService'
import { directorService } from '../services/directorService'
import { departmentService } from '../services/departmentService'
import { userService } from '../services/userService'
import dailyReportService from '../services/dailyReportService'
import LoadingSpinner from '../components/LoadingSpinner'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../utils/constants'
import { formatDateTime } from '../utils/dateFormat'
import { TrophyIcon } from '@heroicons/react/24/outline'

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
  const [overdueTasks, setOverdueTasks] = useState([])
  const [incompleteTasks, setIncompleteTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [topEmployees, setTopEmployees] = useState([])
  const [topDepartments, setTopDepartments] = useState([])
  const [loadingRanking, setLoadingRanking] = useState(false)
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
      loadTopRankings()
    }
  }, [director, role])

  const loadDirector = async () => {
    try {
      const response = await directorService.getMyDirector()
      setDirector(response.data.result)
    } catch (err) {
      // Chỉ log lỗi nếu không phải 404 (not found) - có thể user chưa có director
      if (err.response?.status !== 404) {
        console.error('Error loading director:', err)
      }
      // Không set director nếu lỗi
      setDirector(null)
    }
  }

  const loadTasks = async () => {
    if (!director) return

    try {
      setLoading(true)
      // Gọi API 2 lần: một lần để lấy tất cả tasks (không filter status), một lần để lấy COMPLETED tasks
      // Vì backend filter COMPLETED khi không có status, nên cần gọi riêng để lấy số lượng chính xác
      const [allTasksResponse, completedTasksResponse] = await Promise.all([
        taskService.getTasksByDirectorId(director.directorId, 0, 1000), // Tất cả tasks (không bao gồm COMPLETED do backend filter)
        taskService.getTasksByDirectorId(director.directorId, 0, 1000, false, 'COMPLETED') // Chỉ COMPLETED tasks
      ])
      
      const allTasksList = allTasksResponse.data.result?.content || []
      const completedTasksList = completedTasksResponse.data.result?.content || []
      
      // Merge tất cả tasks lại (loại bỏ duplicate)
      const tasksMap = new Map()
      allTasksList.forEach(task => tasksMap.set(task.taskId, task))
      completedTasksList.forEach(task => tasksMap.set(task.taskId, task))
      const tasksList = Array.from(tasksMap.values())
      
      setTasks(tasksList)

      // Calculate statistics từ tất cả tasks
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

      // Get overdue tasks (deadline has passed and not completed)
      const overdue = tasksList.filter(task => {
        if (task.status === 'COMPLETED') return false
        if (!task.endDate) return false
        const deadline = new Date(task.endDate)
        return deadline < now
      }).sort((a, b) => {
        const dateA = new Date(a.endDate)
        const dateB = new Date(b.endDate)
        return dateA - dateB // Most overdue first
      })
      setOverdueTasks(overdue.slice(0, 10))

      // Get incomplete tasks (not completed, not overdue, not urgent, not waiting)
      const incomplete = tasksList.filter(task => {
        if (task.status === 'COMPLETED') return false
        if (task.status === 'WAITING') return false
        if (!task.endDate) return true // Include tasks without deadline
        
        const deadline = new Date(task.endDate)
        const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60)
        // Exclude overdue (handled separately) and urgent (handled separately)
        if (deadline < now) return false
        if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 48) return false
        
        return true
      }).sort((a, b) => {
        // Sort by endDate if available, otherwise by updatedAt
        const dateA = a.endDate ? new Date(a.endDate) : new Date(a.updatedAt || a.createdAt || 0)
        const dateB = b.endDate ? new Date(b.endDate) : new Date(b.updatedAt || b.createdAt || 0)
        return dateA - dateB // Earliest deadline first
      })
      setIncompleteTasks(incomplete.slice(0, 10))

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

  const loadTopRankings = async () => {
    if (!director) return

    try {
      setLoadingRanking(true)
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      
      // Tính ngày đầu và cuối tháng
      const startDate = new Date(currentYear, currentMonth - 1, 1)
      const endDate = new Date(currentYear, currentMonth, 0) // Ngày cuối tháng
      
      // Load top 3 nhân viên
      const employeesResponse = await dailyReportService.getEmployeesStatisticsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      const employeesStats = employeesResponse.data.result || []
      const top3Employees = employeesStats
        .map(stat => ({
          userId: stat.userId,
          fullName: stat.fullName || stat.userName,
          email: stat.email,
          performanceScore: stat.statistics?.performanceScore || 0,
          totalCompletedTasks: stat.statistics?.totalTasks || 0,
          totalScore: stat.statistics?.totalScore || 0
        }))
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 3)
      setTopEmployees(top3Employees)
      
      // Load top 3 phòng ban
      const departmentsResponse = await dailyReportService.getDepartmentsStatisticsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      const departmentsStats = departmentsResponse.data.result || []
      const top3Departments = departmentsStats
        .map(stat => ({
          departmentId: stat.departmentId,
          departmentName: stat.departmentName,
          performanceScore: stat.statistics?.performanceScore || 0,
          totalCompletedTasks: stat.statistics?.totalCompletedTasks || 0,
          totalScore: stat.statistics?.totalScore || 0
        }))
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 3)
      setTopDepartments(top3Departments)
    } catch (err) {
      console.error('Error loading top rankings:', err)
    } finally {
      setLoadingRanking(false)
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
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
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Công việc công ty</p>
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
            {/* Bảng công việc trễ hạn */}
            {overdueTasks.length > 0 && (
              <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-amber-200 overflow-hidden">
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-between">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Công việc trễ hạn</h2>
                  <button
                    onClick={() => navigate('/director/tasks')}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white text-amber-600 rounded-lg hover:bg-amber-50 transition-colors font-semibold text-xs flex items-center space-x-1"
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
                      {overdueTasks.map((task) => {
                        return (
                          <tr key={task.taskId} className="hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => navigate(`/director/tasks/${task.taskId}`)}>
                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-1">{task.title}</div>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px] sm:min-w-[100px]">
                                  <div 
                                    className="bg-amber-500 h-2 rounded-full transition-all"
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
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Xếp hạng trong tháng */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-purple-200 overflow-hidden relative z-0">
              <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-between">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Xếp hạng trong tháng</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate('/director/reports/ranking')}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold text-xs flex items-center space-x-1"
                  >
                    <span className="hidden sm:inline">Nhân viên</span>
                    <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate('/director/reports/department-ranking')}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold text-xs flex items-center space-x-1"
                  >
                    <span className="hidden sm:inline">Phòng ban</span>
                    <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {/* Top 3 Nhân viên */}
                <div className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Top 3 Nhân viên</h3>
                    <button
                      onClick={() => navigate('/director/reports/ranking')}
                      className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                  {loadingRanking ? (
                    <div className="py-8 text-center">
                      <LoadingSpinner />
                    </div>
                  ) : topEmployees.length > 0 ? (
                    <div className="flex items-end justify-center gap-3 sm:gap-5 md:gap-8 px-2 py-4">
                      {/* Hạng 2 - Bạc (bên trái) */}
                      {topEmployees[1] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-105 transition-all duration-300">
                          <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-2xl p-4 sm:p-5 mb-2 shadow-2xl border-2 border-slate-300 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-2 relative">
                                <TrophyIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 drop-shadow-lg" />
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-black text-slate-600">2</span>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm font-black text-white mb-2 tracking-wider bg-slate-500/50 px-2 py-1 rounded-full">HẠNG 2</div>
                              <div className="text-sm sm:text-base font-bold text-white text-center line-clamp-2 mb-1 drop-shadow-md">{topEmployees[1].fullName}</div>
                              <div className="text-xs text-slate-100 text-center line-clamp-1 mb-3">{topEmployees[1].email}</div>
                              <div className={`text-lg sm:text-xl font-black mt-2 px-3 py-1 rounded-lg bg-white/20 backdrop-blur-sm ${
                                topEmployees[1].performanceScore >= 80 ? 'text-green-100' :
                                topEmployees[1].performanceScore >= 60 ? 'text-yellow-100' :
                                'text-red-100'
                              }`}>
                                {topEmployees[1].performanceScore ? parseFloat(topEmployees[1].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600 h-20 sm:h-24 rounded-b-2xl shadow-inner border-t-2 border-slate-300"></div>
                        </div>
                      )}
                      
                      {/* Hạng 1 - Vàng (ở giữa, cao nhất) */}
                      {topEmployees[0] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-110 transition-all duration-300 z-10">
                          <div className="w-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 rounded-t-2xl p-5 sm:p-6 mb-2 shadow-2xl border-4 border-yellow-300 relative overflow-hidden ring-4 ring-yellow-200/50">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-200/50 via-transparent to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-3 relative animate-pulse">
                                <TrophyIcon className="w-14 h-14 sm:w-16 sm:h-16 text-yellow-800 drop-shadow-2xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center ring-2 ring-yellow-300">
                                  <span className="text-sm font-black text-yellow-800">1</span>
                                </div>
                              </div>
                              <div className="text-sm sm:text-base font-black text-yellow-900 mb-2 tracking-wider bg-yellow-200/80 px-3 py-1 rounded-full shadow-lg">🏆 HẠNG 1</div>
                              <div className="text-base sm:text-lg font-bold text-white text-center line-clamp-2 mb-1 drop-shadow-lg">{topEmployees[0].fullName}</div>
                              <div className="text-xs sm:text-sm text-yellow-50 text-center line-clamp-1 mb-3">{topEmployees[0].email}</div>
                              <div className={`text-xl sm:text-2xl font-black mt-2 px-4 py-2 rounded-xl bg-white/30 backdrop-blur-sm shadow-lg ${
                                topEmployees[0].performanceScore >= 80 ? 'text-green-50' :
                                topEmployees[0].performanceScore >= 60 ? 'text-yellow-50' :
                                'text-red-50'
                              }`}>
                                {topEmployees[0].performanceScore ? parseFloat(topEmployees[0].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-yellow-500 via-yellow-600 to-yellow-700 h-28 sm:h-32 rounded-b-2xl shadow-inner border-t-2 border-yellow-400"></div>
                        </div>
                      )}
                      
                      {/* Hạng 3 - Đồng (bên phải) */}
                      {topEmployees[2] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-105 transition-all duration-300">
                          <div className="w-full bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500 rounded-t-2xl p-4 sm:p-5 mb-2 shadow-2xl border-2 border-orange-300 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-2 relative">
                                <TrophyIcon className="w-10 h-10 sm:w-12 sm:h-12 text-orange-700 drop-shadow-lg" />
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-black text-orange-700">3</span>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm font-black text-white mb-2 tracking-wider bg-orange-500/50 px-2 py-1 rounded-full">HẠNG 3</div>
                              <div className="text-sm sm:text-base font-bold text-white text-center line-clamp-2 mb-1 drop-shadow-md">{topEmployees[2].fullName}</div>
                              <div className="text-xs text-orange-50 text-center line-clamp-1 mb-3">{topEmployees[2].email}</div>
                              <div className={`text-lg sm:text-xl font-black mt-2 px-3 py-1 rounded-lg bg-white/20 backdrop-blur-sm ${
                                topEmployees[2].performanceScore >= 80 ? 'text-green-100' :
                                topEmployees[2].performanceScore >= 60 ? 'text-yellow-100' :
                                'text-red-100'
                              }`}>
                                {topEmployees[2].performanceScore ? parseFloat(topEmployees[2].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-orange-500 via-orange-600 to-orange-700 h-20 sm:h-24 rounded-b-2xl shadow-inner border-t-2 border-orange-400"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-gray-500 text-sm">
                      Chưa có dữ liệu nhân viên
                    </div>
                  )}
                </div>

                {/* Top 3 Phòng ban */}
                <div className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Top 3 Phòng ban</h3>
                    <button
                      onClick={() => navigate('/director/reports/department-ranking')}
                      className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                  {loadingRanking ? (
                    <div className="py-8 text-center">
                      <LoadingSpinner />
                    </div>
                  ) : topDepartments.length > 0 ? (
                    <div className="flex items-end justify-center gap-3 sm:gap-5 md:gap-8 px-2 py-4">
                      {/* Hạng 2 - Bạc (bên trái) */}
                      {topDepartments[1] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-105 transition-all duration-300">
                          <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-2xl p-4 sm:p-5 mb-2 shadow-2xl border-2 border-slate-300 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-2 relative">
                                <TrophyIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 drop-shadow-lg" />
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-black text-slate-600">2</span>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm font-black text-white mb-2 tracking-wider bg-slate-500/50 px-2 py-1 rounded-full">HẠNG 2</div>
                              <div className="text-sm sm:text-base font-bold text-white text-center line-clamp-2 mb-3 drop-shadow-md">{topDepartments[1].departmentName}</div>
                              <div className={`text-lg sm:text-xl font-black mt-2 px-3 py-1 rounded-lg bg-white/20 backdrop-blur-sm ${
                                topDepartments[1].performanceScore >= 80 ? 'text-green-100' :
                                topDepartments[1].performanceScore >= 60 ? 'text-yellow-100' :
                                'text-red-100'
                              }`}>
                                {topDepartments[1].performanceScore ? parseFloat(topDepartments[1].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600 h-20 sm:h-24 rounded-b-2xl shadow-inner border-t-2 border-slate-300"></div>
                        </div>
                      )}
                      
                      {/* Hạng 1 - Vàng (ở giữa, cao nhất) */}
                      {topDepartments[0] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-110 transition-all duration-300 z-10">
                          <div className="w-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 rounded-t-2xl p-5 sm:p-6 mb-2 shadow-2xl border-4 border-yellow-300 relative overflow-hidden ring-4 ring-yellow-200/50">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-200/50 via-transparent to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-3 relative animate-pulse">
                                <TrophyIcon className="w-14 h-14 sm:w-16 sm:h-16 text-yellow-800 drop-shadow-2xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center ring-2 ring-yellow-300">
                                  <span className="text-sm font-black text-yellow-800">1</span>
                                </div>
                              </div>
                              <div className="text-sm sm:text-base font-black text-yellow-900 mb-2 tracking-wider bg-yellow-200/80 px-3 py-1 rounded-full shadow-lg">🏆 HẠNG 1</div>
                              <div className="text-base sm:text-lg font-bold text-white text-center line-clamp-2 mb-3 drop-shadow-lg">{topDepartments[0].departmentName}</div>
                              <div className={`text-xl sm:text-2xl font-black mt-2 px-4 py-2 rounded-xl bg-white/30 backdrop-blur-sm shadow-lg ${
                                topDepartments[0].performanceScore >= 80 ? 'text-green-50' :
                                topDepartments[0].performanceScore >= 60 ? 'text-yellow-50' :
                                'text-red-50'
                              }`}>
                                {topDepartments[0].performanceScore ? parseFloat(topDepartments[0].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-yellow-500 via-yellow-600 to-yellow-700 h-28 sm:h-32 rounded-b-2xl shadow-inner border-t-2 border-yellow-400"></div>
                        </div>
                      )}
                      
                      {/* Hạng 3 - Đồng (bên phải) */}
                      {topDepartments[2] && (
                        <div className="flex-1 max-w-[150px] sm:max-w-[200px] flex flex-col items-center transform hover:scale-105 transition-all duration-300">
                          <div className="w-full bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500 rounded-t-2xl p-4 sm:p-5 mb-2 shadow-2xl border-2 border-orange-300 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <div className="flex flex-col items-center relative z-10">
                              <div className="mb-2 relative">
                                <TrophyIcon className="w-10 h-10 sm:w-12 sm:h-12 text-orange-700 drop-shadow-lg" />
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-black text-orange-700">3</span>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm font-black text-white mb-2 tracking-wider bg-orange-500/50 px-2 py-1 rounded-full">HẠNG 3</div>
                              <div className="text-sm sm:text-base font-bold text-white text-center line-clamp-2 mb-3 drop-shadow-md">{topDepartments[2].departmentName}</div>
                              <div className={`text-lg sm:text-xl font-black mt-2 px-3 py-1 rounded-lg bg-white/20 backdrop-blur-sm ${
                                topDepartments[2].performanceScore >= 80 ? 'text-green-100' :
                                topDepartments[2].performanceScore >= 60 ? 'text-yellow-100' :
                                'text-red-100'
                              }`}>
                                {topDepartments[2].performanceScore ? parseFloat(topDepartments[2].performanceScore).toFixed(1) : '0.0'}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-b from-orange-500 via-orange-600 to-orange-700 h-20 sm:h-24 rounded-b-2xl shadow-inner border-t-2 border-orange-400"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-gray-500 text-sm">
                      Chưa có dữ liệu phòng ban
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tasks sắp đến hạn */}
            {urgentTasks.length > 0 && (
              <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-red-200 overflow-hidden">
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-red-700">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Công việc sắp đến hạn</h2>
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
                            Hạn: {formatDateTime(deadline)}
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
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">Công việc đang chờ</h2>
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

