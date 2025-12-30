import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { directorService } from '../../services/directorService'
import { departmentService } from '../../services/departmentService'
import { userService } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import EditTaskModal from '../../components/EditTaskModal'
import Pagination from '../../components/Pagination'
import RecurringTaskGroup from '../../components/RecurringTaskGroup'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../../utils/constants'

const CompanyTasksPage = () => {
  const [tasks, setTasks] = useState([])
  const [recurringTasks, setRecurringTasks] = useState([])
  const [taskGroups, setTaskGroups] = useState([]) // Nhóm task theo recurring task
  const [regularTasks, setRegularTasks] = useState([]) // Task không thuộc recurring
  const [director, setDirector] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('recurring') // 'recurring', 'regular'
  const navigate = useNavigate()
  const location = useLocation()
  
  // Map từ URL path sang status filter
  const statusFilterMap = {
    'danglam': 'IN_PROGRESS',
    'hoanthanh': 'COMPLETED',
    'choduyet': 'PENDING'
  }
  
  // Xác định status filter từ URL
  const getStatusFilterFromPath = () => {
    const path = location.pathname
    if (path.includes('/tasks/danglam')) return 'IN_PROGRESS'
    if (path.includes('/tasks/hoanthanh')) return 'COMPLETED'
    if (path.includes('/tasks/choduyet')) return 'PENDING'
    return null
  }
  
  const statusFilter = getStatusFilterFromPath()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    departmentIds: [],
    userIds: [], // Danh sách nhân viên được chọn
    // Recurring settings
    recurrenceEnabled: false,
    recurrenceType: 'DAILY',
    recurrenceInterval: 1,
  })
  const [departmentUsers, setDepartmentUsers] = useState({}) // Map departmentId -> users
  const [loadingUsers, setLoadingUsers] = useState({}) // Map departmentId -> loading state
  const [assignmentMode, setAssignmentMode] = useState('department') // 'department' hoặc 'direct'
  const [allUsers, setAllUsers] = useState([]) // Tất cả users của director
  const [loadingAllUsers, setLoadingAllUsers] = useState(false)

  useEffect(() => {
    loadDirector()
  }, [])

  useEffect(() => {
    if (director) {
      loadDepartments()
    }
  }, [director])

  // Tự động chuyển sang tab "regular" khi có status filter
  useEffect(() => {
    if (statusFilter && activeTab === 'recurring') {
      setActiveTab('regular')
      setCurrentPage(0)
    }
  }, [statusFilter])

  useEffect(() => {
    if (director && departmentsLoaded) {
      if (activeTab === 'recurring') {
        // Tab "Lặp lại": Load tất cả tasks (không phân trang) để nhóm đúng
        loadAllTasks()
      } else {
        // Tab "Thường": Load tasks với pagination
        loadTasks()
      }
      loadRecurringTasks()
    }
  }, [director, currentPage, departmentsLoaded, activeTab])

  const loadDepartments = async () => {
    if (!director) return
    
    try {
      const response = await departmentService.getDepartmentsByDirectorId(director.directorId)
      setDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading departments:', err)
      setDepartments([])
    } finally {
      setDepartmentsLoaded(true)
    }
  }

  const loadUsersForDepartment = async (departmentId) => {
    if (!departmentId || departmentUsers[departmentId]) return // Đã load rồi thì không load lại
    
    try {
      setLoadingUsers(prev => ({ ...prev, [departmentId]: true }))
      const response = await departmentService.getUsersWithDetailsByDepartmentId(departmentId)
      const users = response.data?.result || []
      setDepartmentUsers(prev => ({ ...prev, [departmentId]: users }))
    } catch (err) {
      console.error(`Error loading users for department ${departmentId}:`, err)
      setDepartmentUsers(prev => ({ ...prev, [departmentId]: [] }))
    } finally {
      setLoadingUsers(prev => ({ ...prev, [departmentId]: false }))
    }
  }

  const loadDirector = async () => {
    try {
      const response = await directorService.getMyDirector()
      setDirector(response.data.result)
    } catch (err) {
      setError('Lỗi khi tải thông tin director')
      setLoading(false)
    }
  }

  const sortTasks = (tasks) => {
    const now = new Date()
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000) // 6 hours in milliseconds
    
    // Tách tasks thành 2 nhóm: chưa hoàn thành và đã hoàn thành
    const incompleteTasks = tasks.filter(task => task.status !== 'COMPLETED')
    const completedTasks = tasks.filter(task => task.status === 'COMPLETED')
    
    // Sắp xếp nhóm chưa hoàn thành:
    // 1. Gần hết hạn (còn < 6 giờ) lên trước
    // 2. Sau đó sắp xếp theo deadline (gần hết hạn nhất lên trước)
    incompleteTasks.sort((a, b) => {
      const endDateA = new Date(a.endDate)
      const endDateB = new Date(b.endDate)
      
      // Kiểm tra xem task có gần hết hạn không (< 6 giờ)
      const isNearDeadlineA = endDateA <= sixHoursFromNow && endDateA > now
      const isNearDeadlineB = endDateB <= sixHoursFromNow && endDateB > now
      
      // Nếu một task gần hết hạn và task kia không, task gần hết hạn lên trước
      if (isNearDeadlineA && !isNearDeadlineB) return -1
      if (!isNearDeadlineA && isNearDeadlineB) return 1
      
      // Nếu cả hai đều gần hết hạn hoặc cả hai đều không, sắp xếp theo deadline
      return endDateA - endDateB
    })
    
    // Sắp xếp nhóm đã hoàn thành theo deadline (mới hoàn thành nhất lên trước)
    completedTasks.sort((a, b) => {
      const endDateA = new Date(a.endDate)
      const endDateB = new Date(b.endDate)
      return endDateB - endDateA // Ngược lại để mới nhất lên trước
    })
    
    // Ghép lại: chưa hoàn thành lên trên, đã hoàn thành xuống dưới
    return [...incompleteTasks, ...completedTasks]
  }

  const loadRecurringTasks = async () => {
    if (!director) return
    
    try {
      const response = await taskService.getRecurringTasksByDirectorId(director.directorId)
      setRecurringTasks(response.data.result || [])
    } catch (err) {
      console.error('Error loading recurring tasks:', err)
      setRecurringTasks([])
    }
  }

  const groupTasksByRecurring = (tasksList) => {
    // Filter tasks theo status nếu có
    let filteredTasks = tasksList
    if (statusFilter) {
      filteredTasks = tasksList.filter(task => task.status === statusFilter)
    }
    
    if (!recurringTasks || recurringTasks.length === 0) {
      setTaskGroups([])
      setRegularTasks(filteredTasks)
      return
    }
    
    // Tạo map để nhóm tasks theo recurring task
    const taskGroupMap = new Map()
    const regularTasksList = []
    
    // Với mỗi recurring task, tìm các task có cùng title và description
    recurringTasks.forEach(recurring => {
      const matchingTasks = filteredTasks.filter(task => 
        task.title === recurring.title && 
        (task.description || '') === (recurring.description || '') &&
        task.directorId === recurring.directorId
      )
      
      if (matchingTasks.length > 0) {
        taskGroupMap.set(recurring.recurringTaskId, {
          recurringTask: recurring,
          tasks: matchingTasks
        })
      }
    })
    
    // Tìm các task không thuộc recurring task nào
    const groupedTaskIds = new Set()
    taskGroupMap.forEach(group => {
      group.tasks.forEach(task => groupedTaskIds.add(task.taskId))
    })
    
    filteredTasks.forEach(task => {
      if (!groupedTaskIds.has(task.taskId)) {
        regularTasksList.push(task)
      }
    })
    
    setTaskGroups(Array.from(taskGroupMap.values()))
    setRegularTasks(regularTasksList)
  }

  const loadAllTasks = async () => {
    if (!director) return
    
    try {
      setLoading(true)
      // Load tất cả tasks (size lớn) để nhóm đúng các recurring tasks
      const response = await taskService.getTasksByDirectorId(director.directorId, 0, 10000)
      const result = response.data.result
      const tasksList = result.content || []
      
      // Load đầy đủ thông tin cho mỗi task (bao gồm departmentNames)
      const tasksWithDetails = await Promise.all(
        tasksList.map(async (task) => {
          try {
            const detailResponse = await taskService.getTaskById(task.taskId)
            return detailResponse.data.result || task
          } catch (err) {
            console.error(`Error loading task detail ${task.taskId}:`, err)
            // Fallback: map từ departmentIds nếu có
            if (task.departmentIds && task.departmentIds.length > 0 && departments.length > 0) {
              const deptNames = task.departmentIds
                .map(deptId => {
                  const dept = departments.find(d => d.departmentId === deptId)
                  return dept ? dept.departmentName : null
                })
                .filter(name => name !== null)
              return {
                ...task,
                departmentNames: deptNames
              }
            }
            return task
          }
        })
      )
      
      // Sắp xếp tasks theo yêu cầu
      const sortedTasks = sortTasks(tasksWithDetails)
      setTasks(sortedTasks)
      setTotalPages(1) // Không phân trang cho tab "Lặp lại"
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!director) return
    
    try {
      setLoading(true)
      const response = await taskService.getTasksByDirectorId(director.directorId, currentPage, 20)
      const result = response.data.result
      const tasksList = result.content || []
      
      // Load đầy đủ thông tin cho mỗi task (bao gồm departmentNames)
      const tasksWithDetails = await Promise.all(
        tasksList.map(async (task) => {
          try {
            const detailResponse = await taskService.getTaskById(task.taskId)
            return detailResponse.data.result || task
          } catch (err) {
            console.error(`Error loading task detail ${task.taskId}:`, err)
            // Fallback: map từ departmentIds nếu có
            if (task.departmentIds && task.departmentIds.length > 0 && departments.length > 0) {
              const deptNames = task.departmentIds
                .map(deptId => {
                  const dept = departments.find(d => d.departmentId === deptId)
                  return dept ? dept.departmentName : null
                })
                .filter(name => name !== null)
              return {
                ...task,
                departmentNames: deptNames
              }
            }
            return task
          }
        })
      )
      
      // Sắp xếp tasks theo yêu cầu
      const sortedTasks = sortTasks(tasksWithDetails)
      setTasks(sortedTasks)
      setTotalPages(result.totalPages || 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivateRecurring = async (recurringTaskId) => {
    if (!window.confirm('Bạn có chắc chắn muốn dừng lặp lại công việc này?')) {
      return
    }
    
    try {
      await taskService.deactivateRecurringTask(recurringTaskId)
      await loadRecurringTasks()
      // Reload tasks dựa trên activeTab
      if (activeTab === 'recurring') {
        await loadAllTasks()
      } else {
        await loadTasks()
      }
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi dừng lặp lại công việc')
    }
  }

  const handleActivateRecurring = async (recurringTaskId) => {
    if (!window.confirm('Bạn có chắc chắn muốn kích hoạt lại công việc lặp lại này?')) {
      return
    }
    
    try {
      await taskService.activateRecurringTask(recurringTaskId)
      await loadRecurringTasks()
      // Reload tasks dựa trên activeTab
      if (activeTab === 'recurring') {
        await loadAllTasks()
      } else {
        await loadTasks()
      }
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi kích hoạt lại công việc')
    }
  }

  const handleEditRecurring = (recurringTask) => {
    // Tìm task gốc để edit
    const originalTask = tasks.find(t => t.taskId === recurringTask.originalTaskId)
    if (originalTask) {
      handleEditClick(originalTask, { stopPropagation: () => {} })
    } else {
      setError('Không tìm thấy công việc gốc để chỉnh sửa')
    }
  }

  const loadAllUsers = async () => {
    if (!director) return
    
    try {
      setLoadingAllUsers(true)
      const response = await userService.getUsersByDirectorId(director.directorId, 0, 1000)
      const usersList = response.data.result?.content || []
      // Lọc chỉ USER và MANAGER roles
      const filteredUsers = usersList.filter(user => 
        user.roles && (user.roles.includes('USER') || user.roles.includes('MANAGER'))
      )
      setAllUsers(filteredUsers)
    } catch (err) {
      console.error('Error loading all users:', err)
      setAllUsers([])
    } finally {
      setLoadingAllUsers(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    
    // Validate title
    if (!formData.title || formData.title.trim().length === 0) {
      errors.title = 'Tiêu đề không được để trống'
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Tiêu đề phải có ít nhất 3 ký tự'
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Tiêu đề không được vượt quá 200 ký tự'
    }
    
    // Validate dates
    if (!formData.startDate) {
      errors.startDate = 'Ngày bắt đầu không được để trống'
    }
    
    if (!formData.endDate) {
      errors.endDate = 'Ngày kết thúc không được để trống'
    }
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (end <= start) {
        errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu'
      }
    }
    
    // Validate: Cần chọn phòng ban HOẶC nhân viên
    if (assignmentMode === 'department') {
      if (formData.departmentIds.length === 0) {
        errors.departmentIds = 'Vui lòng chọn ít nhất một phòng ban'
      }
    } else {
      if (formData.userIds.length === 0) {
        errors.userIds = 'Vui lòng chọn ít nhất một nhân viên'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!director || isSubmitting) return

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      setValidationErrors({})
      const data = {
        directorId: director.directorId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        departmentIds: assignmentMode === 'department' ? formData.departmentIds.map(id => parseInt(id)) : [],
        userIds: formData.userIds.map(id => parseInt(id))
      }
      
      // Thêm recurring settings nếu có
      if (formData.recurrenceEnabled && formData.recurrenceType) {
        data.recurrenceType = formData.recurrenceType
        data.recurrenceInterval = formData.recurrenceInterval || 1
      }
      
      const createResponse = await taskService.createTask(data)
      const createdTask = createResponse.data.result
      
      // Không cần gán users nữa vì đã gửi trong data.userIds và backend sẽ tự động gán
      
      setShowCreateModal(false)
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        departmentIds: [],
        userIds: [],
        recurrenceEnabled: false,
        recurrenceType: 'DAILY',
        recurrenceInterval: 1
      })
      setDepartmentUsers({})
      setValidationErrors({})
      setAssignmentMode('department')
      // Reload tasks dựa trên activeTab
      if (activeTab === 'recurring') {
        await loadAllTasks()
      } else {
        await loadTasks()
      }
      await loadRecurringTasks()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = async (task, e) => {
    e.stopPropagation() // Ngăn navigate khi click nút
    try {
      // Load full task detail để có đầy đủ thông tin
      const taskResponse = await taskService.getTaskById(task.taskId)
      setSelectedTaskForEdit(taskResponse.data.result)
      setShowEditModal(true)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thông tin task')
    }
  }

  const handleUpdateTask = async () => {
    // Reload tasks sau khi cập nhật, dựa trên activeTab
    if (activeTab === 'recurring') {
      await loadAllTasks()
    } else {
      await loadTasks()
    }
    await loadRecurringTasks()
    setShowEditModal(false)
    setSelectedTaskForEdit(null)
  }

  // Re-group tasks khi recurring tasks, tasks hoặc statusFilter thay đổi
  useEffect(() => {
    if (tasks.length > 0) {
      groupTasksByRecurring(tasks)
    } else {
      setRegularTasks([])
      setTaskGroups([])
    }
  }, [recurringTasks, tasks, statusFilter])

  if (loading && tasks.length === 0) return <LoadingSpinner />

  // Filter tasks based on active tab
  const displayTaskGroups = activeTab === 'recurring' ? taskGroups : []
  const displayRegularTasks = activeTab === 'regular' ? regularTasks : []

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          <span>+</span>
          <span>Tạo Task</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('recurring')
              setCurrentPage(0) // Reset về trang đầu khi chuyển tab
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'recurring'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lặp lại ({taskGroups.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('regular')
              setCurrentPage(0) // Reset về trang đầu khi chuyển tab
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'regular'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Thường ({regularTasks.length})
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Recurring Task Groups */}
          {displayTaskGroups.length > 0 && (
            <div className="mb-6">
              {displayTaskGroups.map((group) => (
                <RecurringTaskGroup
                  key={group.recurringTask.recurringTaskId}
                  recurringTask={group.recurringTask}
                  tasks={group.tasks}
                  onEdit={handleEditRecurring}
                  onDeactivate={handleDeactivateRecurring}
                  onActivate={handleActivateRecurring}
                />
              ))}
            </div>
          )}

          {/* Mobile Card View - Chỉ hiển thị khi tab "Thường" */}
          {activeTab === 'regular' && (
          <div className="md:hidden space-y-2.5">
            {displayRegularTasks.map((task) => {
              const now = new Date()
              const endDate = task.endDate ? new Date(task.endDate) : null
              const hoursUntilDeadline = endDate ? (endDate - now) / (1000 * 60 * 60) : null
              const isOverdue = endDate && endDate < now && task.status !== 'COMPLETED'
              const isNearDeadline = hoursUntilDeadline && hoursUntilDeadline > 0 && hoursUntilDeadline <= 6 && task.status !== 'COMPLETED'
              
              const getStatusColor = () => {
                if (isOverdue) return 'bg-gray-800'
                if (isNearDeadline) return 'bg-red-500'
                if (task.status === 'WAITING') return 'bg-yellow-400'
                if (task.status === 'COMPLETED') return 'bg-green-500'
                if (task.status === 'IN_PROGRESS') return 'bg-blue-500'
                return 'bg-gray-400'
              }

              const getCardBg = () => {
                if (isOverdue) return 'bg-gray-900'
                if (isNearDeadline) return 'bg-red-50'
                if (task.status === 'WAITING') return 'bg-yellow-50'
                if (task.status === 'COMPLETED') return 'bg-white'
                return 'bg-white'
              }

              const getTextColor = () => {
                if (isOverdue) return 'text-white'
                return 'text-gray-900'
              }

              const getSubTextColor = () => {
                if (isOverdue) return 'text-gray-300'
                return 'text-gray-600'
              }

              return (
                <div
                  key={task.taskId}
                  onClick={() => navigate(`/director/tasks/${task.taskId}`)}
                  className={`${getCardBg()} rounded-xl shadow-md border-l-4 ${getStatusColor()} border-r border-t border-b border-gray-200 p-3 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]`}
                >
                  {/* Title and Status Row */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-bold ${getTextColor()} line-clamp-1 flex-1 min-w-0 pr-2`}>
                      {task.title}
                    </h3>
                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {isOverdue ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-800 text-white">
                          {TASK_STATUS_LABELS[task.status] || task.status} - Quá hạn
                        </span>
                      ) : isNearDeadline ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
                          {TASK_STATUS_LABELS[task.status] || task.status} - Sắp hết hạn
                        </span>
                      ) : task.status === 'WAITING' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-400 text-yellow-900">
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </span>
                      ) : task.status === 'COMPLETED' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </span>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.PENDING}`}>
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Row */}
                  <div className="flex items-center justify-end mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            task.progress === 100 ? 'bg-green-500' : 
                            task.progress >= 50 ? 'bg-blue-500' : 
                            'bg-blue-400'
                          }`}
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold min-w-[35px] ${getTextColor()}`}>
                        {task.progress || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Waiting Reason - Hiển thị khi task có status WAITING */}
                  {(task.status === 'WAITING' || (task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0)) && (
                    <div className="mb-2">
                      {task.waitingReason ? (
                        <div className={`text-xs ${isOverdue ? 'text-gray-300' : 'text-orange-700'} bg-orange-50 border border-orange-200 rounded-md p-2`}>
                          <span className="font-semibold">Lý do chờ:</span> <span className="break-words">{task.waitingReason}</span>
                        </div>
                      ) : task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(task.departmentWaitingReasons).map(([deptId, reason]) => {
                            if (!reason || !reason.trim()) return null
                            const deptIndex = task.departmentIds?.indexOf(parseInt(deptId))
                            const deptName = deptIndex !== -1 && task.departmentNames?.[deptIndex] 
                              ? task.departmentNames[deptIndex] 
                              : `Phòng ban ${deptId}`
                            return (
                              <div key={deptId} className={`text-xs ${isOverdue ? 'text-gray-300' : 'text-orange-700'} bg-orange-50 border border-orange-200 rounded-md p-2`}>
                                <span className="font-semibold">{deptName}:</span> <span className="break-words">{reason}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Bottom Row: Department and Date */}
                  <div className="flex items-center justify-between">
                    {/* Department */}
                    {task.departmentNames && task.departmentNames.length > 0 ? (
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                        <svg className={`w-3.5 h-3.5 ${getSubTextColor()} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {task.departmentNames.slice(0, 1).map((deptName, index) => (
                            <span
                              key={index}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                isOverdue 
                                  ? 'bg-blue-900 text-blue-100' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {deptName}
                            </span>
                          ))}
                          {task.departmentNames.length > 1 && (
                            <span className={`${getSubTextColor()} text-xs`}>
                              +{task.departmentNames.length - 1}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}
                    
                    {/* Date */}
                    {endDate && (
                      <div className={`flex items-center space-x-1 ${getSubTextColor()} ml-2 flex-shrink-0`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-gray-200 mt-2">
                    <button
                      onClick={(e) => handleEditClick(task, e)}
                      className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Chỉnh sửa</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/director/tasks/${task.taskId}`)
                      }}
                      className="flex items-center space-x-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Chi tiết</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {/* Desktop Table View - Chỉ hiển thị khi tab "Thường" */}
          {activeTab === 'regular' && (
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tiêu đề
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Mô tả
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Phòng ban
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tiến độ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Bắt đầu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Kết thúc
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayRegularTasks.map((task) => {
                    const now = new Date()
                    const endDate = task.endDate ? new Date(task.endDate) : null
                    const hoursUntilDeadline = endDate ? (endDate - now) / (1000 * 60 * 60) : null
                    const isOverdue = endDate && endDate < now && task.status !== 'COMPLETED'
                    const isNearDeadline = hoursUntilDeadline && hoursUntilDeadline > 0 && hoursUntilDeadline <= 6 && task.status !== 'COMPLETED'
                    
                    const getRowClass = () => {
                      if (isOverdue) return 'bg-gray-900 text-white'
                      if (isNearDeadline) return 'bg-red-50'
                      if (task.status === 'WAITING') return 'bg-yellow-50'
                      return ''
                    }

                    const formatDate = (dateString) => {
                      if (!dateString) return 'N/A'
                      return new Date(dateString).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }

                    return (
                      <tr 
                        key={task.taskId} 
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${getRowClass()}`}
                        onClick={() => navigate(`/director/tasks/${task.taskId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${isOverdue ? 'text-white' : 'text-gray-900'}`}>
                            {task.title}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${isOverdue ? 'text-gray-300' : 'text-gray-600'} max-w-md truncate`}>
                            {task.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {task.departmentNames && task.departmentNames.length > 0 ? (
                              task.departmentNames.map((deptName, index) => (
                                <span
                                  key={index}
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    isOverdue 
                                      ? 'bg-blue-900 text-blue-100 border border-blue-700' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {deptName}
                                </span>
                              ))
                            ) : (
                              <span className={`text-sm ${isOverdue ? 'text-gray-400' : 'text-gray-400'}`}>-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {isOverdue ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-black text-white">
                                {TASK_STATUS_LABELS[task.status] || task.status} - Quá hạn
                              </span>
                            ) : isNearDeadline ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
                                {TASK_STATUS_LABELS[task.status] || task.status} - Sắp hết hạn
                              </span>
                            ) : task.status === 'WAITING' ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-400 text-yellow-900">
                                {TASK_STATUS_LABELS[task.status] || task.status}
                              </span>
                            ) : (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.PENDING}`}>
                                {TASK_STATUS_LABELS[task.status] || task.status}
                              </span>
                            )}
                            {/* Hiển thị lý do chờ */}
                            {(task.status === 'WAITING' || (task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0)) && (
                              <div className="mt-2 space-y-1">
                                {task.waitingReason ? (
                                  <div className={`text-xs ${isOverdue ? 'text-gray-300' : 'text-orange-700'} bg-orange-50 border border-orange-200 rounded-md p-2 max-w-md`}>
                                    <span className="font-semibold">Lý do chờ:</span> <span className="break-words">{task.waitingReason}</span>
                                  </div>
                                ) : task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0 ? (
                                  Object.entries(task.departmentWaitingReasons).map(([deptId, reason]) => {
                                    if (!reason || !reason.trim()) return null
                                    const deptIndex = task.departmentIds?.indexOf(parseInt(deptId))
                                    const deptName = deptIndex !== -1 && task.departmentNames?.[deptIndex] 
                                      ? task.departmentNames[deptIndex] 
                                      : `Phòng ban ${deptId}`
                                    return (
                                      <div key={deptId} className={`text-xs ${isOverdue ? 'text-gray-300' : 'text-orange-700'} bg-orange-50 border border-orange-200 rounded-md p-2 max-w-md`}>
                                        <span className="font-semibold">{deptName}:</span> <span className="break-words">{reason}</span>
                                      </div>
                                    )
                                  })
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${isOverdue ? 'text-white' : 'text-gray-900'}`}>
                              {task.progress || 0}%
                            </span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isOverdue ? 'text-gray-300' : 'text-gray-600'}`}>
                          {formatDate(task.startDate)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isOverdue ? 'text-gray-300' : 'text-gray-600'}`}>
                          {formatDate(task.endDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={(e) => handleEditClick(task, e)}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/director/tasks/${task.taskId}`)
                              }}
                              className="text-purple-600 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50"
                            >
                              Chi tiết
                            </button>
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

          {(displayTaskGroups.length === 0 && displayRegularTasks.length === 0) && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">Chưa có task nào</p>
            </div>
          )}

          {activeTab === 'regular' && totalPages > 1 && (
            <div className="mt-6">
            <Pagination
              currentPage={currentPage + 1}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page - 1)}
            />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setFormData({
            title: '',
            description: '',
            startDate: '',
            endDate: '',
            departmentIds: [],
            userIds: [],
            recurrenceEnabled: false,
            recurrenceType: 'DAILY',
            recurrenceInterval: 1
          })
          setDepartmentUsers({})
          setValidationErrors({})
          setAssignmentMode('department')
        }}
        title="Tạo Task mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiêu đề *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value })
                if (validationErrors.title) {
                  setValidationErrors({ ...validationErrors, title: '' })
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={200}
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) => {
                  setFormData({ ...formData, startDate: e.target.value })
                  if (validationErrors.startDate) {
                    setValidationErrors({ ...validationErrors, startDate: '' })
                  }
                  if (validationErrors.endDate && formData.endDate) {
                    const end = new Date(formData.endDate)
                    const start = new Date(e.target.value)
                    if (end > start) {
                      setValidationErrors({ ...validationErrors, endDate: '' })
                    }
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.startDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.startDate && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày kết thúc *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.endDate}
                onChange={(e) => {
                  setFormData({ ...formData, endDate: e.target.value })
                  if (validationErrors.endDate) {
                    setValidationErrors({ ...validationErrors, endDate: '' })
                  }
                }}
                min={formData.startDate || ''}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.endDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.endDate && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
              )}
            </div>
          </div>
          
          {/* Chọn mode giao việc */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Cách giao việc *
            </label>
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignmentMode"
                  value="department"
                  checked={assignmentMode === 'department'}
                  onChange={(e) => {
                    setAssignmentMode('department')
                    setFormData({ ...formData, userIds: [] })
                    setValidationErrors({ ...validationErrors, userIds: '', departmentIds: '' })
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Giao qua phòng ban</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignmentMode"
                  value="direct"
                  checked={assignmentMode === 'direct'}
                  onChange={async (e) => {
                    setAssignmentMode('direct')
                    setFormData({ ...formData, departmentIds: [], userIds: [] })
                    setValidationErrors({ ...validationErrors, userIds: '', departmentIds: '' })
                    if (allUsers.length === 0) {
                      await loadAllUsers()
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Giao trực tiếp cho nhân viên</span>
              </label>
            </div>
          </div>

          {/* Giao qua phòng ban */}
          {assignmentMode === 'department' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Phòng ban (có thể chọn nhiều) *
            </label>
            <div className={`border rounded-lg p-4 max-h-60 overflow-y-auto ${
              validationErrors.departmentIds ? 'border-red-500' : 'border-gray-300'
            }`}>
              {departments.length > 0 ? (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <label
                      key={dept.departmentId}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.departmentIds.includes(String(dept.departmentId))}
                        onChange={async (e) => {
                          const deptId = String(dept.departmentId)
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              departmentIds: [...formData.departmentIds, deptId]
                            })
                            // Load users cho phòng ban này
                            await loadUsersForDepartment(parseInt(deptId))
                          } else {
                            setFormData({
                              ...formData,
                              departmentIds: formData.departmentIds.filter(id => id !== deptId),
                              // Xóa các nhân viên của phòng ban này khỏi danh sách chọn
                              userIds: formData.userIds.filter(userId => {
                                const deptUsers = departmentUsers[parseInt(deptId)] || []
                                return !deptUsers.some(u => u.userId === userId)
                              })
                            })
                          }
                          if (validationErrors.departmentIds) {
                            setValidationErrors({ ...validationErrors, departmentIds: '' })
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">{dept.departmentName}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Chưa có phòng ban nào</p>
              )}
            </div>
            {validationErrors.departmentIds && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.departmentIds}</p>
            )}
          </div>
          )}

          {/* Giao trực tiếp cho nhân viên */}
          {assignmentMode === 'direct' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Chọn nhân viên (có thể chọn nhiều) *
            </label>
            <div className={`border rounded-lg p-4 max-h-60 overflow-y-auto ${
              validationErrors.userIds ? 'border-red-500' : 'border-gray-300'
            }`}>
              {loadingAllUsers ? (
                <div className="text-sm text-gray-500 text-center py-4">Đang tải danh sách nhân viên...</div>
              ) : allUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Chưa có nhân viên nào</p>
              ) : (
                <div className="space-y-2">
                  {allUsers.map((user) => {
                    const isManager = user.roles && user.roles.includes('MANAGER')
                    const isSelected = formData.userIds.includes(user.userId)
                    
                    return (
                      <label
                        key={user.userId}
                        className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                userIds: [...formData.userIds, user.userId]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                userIds: formData.userIds.filter(id => id !== user.userId)
                              })
                            }
                            if (validationErrors.userIds) {
                              setValidationErrors({ ...validationErrors, userIds: '' })
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {user.fullName}
                            </span>
                            {isManager && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                Trưởng phòng
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">@{user.userName}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            {validationErrors.userIds && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.userIds}</p>
            )}
          </div>
          )}

          {/* Hiển thị danh sách nhân viên từ các phòng ban đã chọn (chỉ khi mode = department) */}
          {assignmentMode === 'department' && formData.departmentIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Chọn nhân viên (tùy chọn)
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                {formData.departmentIds.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Vui lòng chọn phòng ban trước
                  </p>
                ) : (
                  <div className="space-y-4">
                    {formData.departmentIds.map((deptIdStr) => {
                      const deptId = parseInt(deptIdStr)
                      const dept = departments.find(d => d.departmentId === deptId)
                      const users = departmentUsers[deptId] || []
                      const isLoading = loadingUsers[deptId]
                      
                      return (
                        <div key={deptId} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                          <div className="font-medium text-sm text-gray-700 mb-2">
                            {dept?.departmentName}
                          </div>
                          {isLoading ? (
                            <div className="text-sm text-gray-500 py-2">Đang tải...</div>
                          ) : users.length === 0 ? (
                            <div className="text-sm text-gray-500 py-2">Không có nhân viên nào</div>
                          ) : (
                            <div className="space-y-2">
                              {users.map((user) => {
                                const isManager = user.roles && user.roles.includes('MANAGER')
                                const isSelected = formData.userIds.includes(user.userId)
                                
                                return (
                                  <label
                                    key={user.userId}
                                    className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
                                      isSelected ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setFormData({
                                            ...formData,
                                            userIds: [...formData.userIds, user.userId]
                                          })
                                        } else {
                                          setFormData({
                                            ...formData,
                                            userIds: formData.userIds.filter(id => id !== user.userId)
                                          })
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium text-gray-900">
                                          {user.fullName}
                                        </span>
                                        {isManager && (
                                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                            Trưởng phòng
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-500">@{user.userName}</span>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recurring Task Settings */}
          <div className="border-t pt-4 mt-4">
            <label className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                checked={formData.recurrenceEnabled}
                onChange={(e) => setFormData({ ...formData, recurrenceEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Lặp lại công việc</span>
            </label>
            
            {formData.recurrenceEnabled && (
              <div className="space-y-3 pl-6 border-l-2 border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lặp lại theo
                    </label>
                    <select
                      value={formData.recurrenceType}
                      onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="MINUTELY">Phút</option>
                      <option value="HOURLY">Giờ</option>
                      <option value="DAILY">Ngày</option>
                      <option value="WEEKLY">Tuần</option>
                      <option value="MONTHLY">Tháng</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mỗi (số)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.recurrenceInterval}
                      onChange={(e) => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ví dụ: Mỗi 2 ngày, mỗi 3 tuần...
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Lưu ý:</strong> Công việc sẽ tự động được tạo lại với cùng phòng ban, nhân viên và deadline. 
                    Mỗi công việc được tạo là độc lập và có thể quản lý riêng.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  setShowCreateModal(false)
                  setFormData({
                    title: '',
                    description: '',
                    startDate: '',
                    endDate: '',
                    departmentIds: [],
                    userIds: [],
                    recurrenceEnabled: false,
                    recurrenceType: 'DAILY',
                    recurrenceInterval: 1
                  })
                  setDepartmentUsers({})
                  setValidationErrors({})
                  setAssignmentMode('department')
                  setError('')
                }
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isSubmitting ? 'Đang tạo...' : 'Tạo'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      {selectedTaskForEdit && (
        <EditTaskModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTaskForEdit(null)
            setError('')
          }}
          task={selectedTaskForEdit}
          onUpdate={handleUpdateTask}
        />
      )}
    </div>
  )
}

export default CompanyTasksPage

