import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { departmentService } from '../../services/departmentService'
import TaskCard from '../../components/TaskCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import { TASK_STATUS } from '../../utils/constants'

const MyTasksPage = ({ basePath }) => {
  const [tasks, setTasks] = useState([])
  const [filteredTasks, setFilteredTasks] = useState([])
  const [tasksByDepartment, setTasksByDepartment] = useState({})
  const [userDeptMap, setUserDeptMap] = useState({})
  const [userDepartments, setUserDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()
  const location = useLocation()
  
  // Xác định basePath dựa trên location hoặc prop
  const taskBasePath = basePath || (location.pathname.startsWith('/manager') ? '/manager' : '/user')
  
  const sortTasks = (tasksList) => {
    const now = new Date()
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000) // 6 hours in milliseconds
    
    // Tách tasks thành 2 nhóm: chưa hoàn thành và đã hoàn thành
    const incompleteTasks = tasksList.filter(task => task.status !== 'COMPLETED')
    const completedTasks = tasksList.filter(task => task.status === 'COMPLETED')
    
    // Sắp xếp nhóm chưa hoàn thành:
    // 1. Quá hạn lên đầu
    // 2. Gần hết hạn (còn < 6 giờ) lên tiếp
    // 3. Sau đó sắp xếp theo deadline (gần hết hạn nhất lên trước)
    incompleteTasks.sort((a, b) => {
      const endDateA = a.endDate ? new Date(a.endDate) : null
      const endDateB = b.endDate ? new Date(b.endDate) : null
      
      if (!endDateA && !endDateB) return 0
      if (!endDateA) return 1
      if (!endDateB) return -1
      
      // Kiểm tra quá hạn
      const isOverdueA = endDateA < now
      const isOverdueB = endDateB < now
      
      if (isOverdueA && !isOverdueB) return -1
      if (!isOverdueA && isOverdueB) return 1
      
      // Kiểm tra gần hết hạn (< 6 giờ)
      const isNearDeadlineA = endDateA <= sixHoursFromNow && endDateA > now
      const isNearDeadlineB = endDateB <= sixHoursFromNow && endDateB > now
      
      if (isNearDeadlineA && !isNearDeadlineB) return -1
      if (!isNearDeadlineA && isNearDeadlineB) return 1
      
      // Sắp xếp theo deadline (gần hết hạn nhất lên trước)
      return endDateA - endDateB
    })
    
    // Sắp xếp nhóm đã hoàn thành theo deadline (mới hoàn thành nhất lên trước)
    completedTasks.sort((a, b) => {
      const endDateA = a.endDate ? new Date(a.endDate) : null
      const endDateB = b.endDate ? new Date(b.endDate) : null
      
      if (!endDateA && !endDateB) return 0
      if (!endDateA) return 1
      if (!endDateB) return -1
      
      return endDateB - endDateA // Ngược lại để mới nhất lên trước
    })
    
    // Ghép lại: chưa hoàn thành lên trên, đã hoàn thành xuống dưới
    return [...incompleteTasks, ...completedTasks]
  }

  const groupTasksByDepartment = (tasksList, deptMap, userDeptIds) => {
    // Sắp xếp tasks trước khi group
    const sortedTasks = sortTasks(tasksList)
    
    const grouped = {}
    sortedTasks.forEach(task => {
      if (task.departmentIds && task.departmentIds.length > 0) {
        // Chỉ group theo phòng ban mà user thực sự thuộc về
        task.departmentIds.forEach((deptId, index) => {
          // Kiểm tra xem user có ở trong phòng ban này không
          const isUserInDept = userDeptIds.some(userDeptId => 
            userDeptId === deptId || 
            userDeptId === deptId.toString() || 
            parseInt(userDeptId) === parseInt(deptId)
          )
          
          if (!isUserInDept) {
            return // Bỏ qua phòng ban này nếu user không thuộc về
          }
          
          const deptName = task.departmentNames && task.departmentNames[index] 
            ? task.departmentNames[index] 
            : deptMap[deptId] || `Phòng ban ${deptId}`
          
          if (!grouped[deptName]) {
            grouped[deptName] = []
          }
          if (!grouped[deptName].find(t => t.taskId === task.taskId)) {
            grouped[deptName].push(task)
          }
        })
      } else {
        if (!grouped['Khác']) {
          grouped['Khác'] = []
        }
        grouped['Khác'].push(task)
      }
    })
    return grouped
  }

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    // Normalize status: PENDING/ACCEPTED -> IN_PROGRESS cho hiển thị
    const normalizeStatus = (status) => {
      if (status === 'PENDING' || status === 'ACCEPTED') {
        return 'IN_PROGRESS'
      }
      return status
    }
    
    // Filter tasks theo status
    let filtered = tasks
    if (statusFilter !== 'all') {
      filtered = tasks.filter(task => {
        const normalizedTaskStatus = normalizeStatus(task.status)
        return normalizedTaskStatus === statusFilter
      })
    }
    
    // Filter theo phòng ban nếu có chọn
    if (selectedDepartment !== 'all') {
      const deptId = parseInt(selectedDepartment)
      filtered = filtered.filter(task => {
        // Kiểm tra xem task có departmentIds không và có chứa deptId được chọn không
        if (!task.departmentIds || task.departmentIds.length === 0) {
          return false
        }
        // So sánh cả number và string để đảm bảo
        return task.departmentIds.some(id => 
          id === deptId || id === deptId.toString() || parseInt(id) === deptId
        )
      })
    }
    
    setFilteredTasks(filtered)
    
    // Sắp xếp filtered tasks theo mức độ cấp thiết
    const sortedFiltered = sortTasks(filtered)
    
    // Nếu đã chọn phòng ban cụ thể, chỉ hiển thị tasks của phòng ban đó (không group)
    if (selectedDepartment !== 'all') {
      const deptId = parseInt(selectedDepartment)
      const deptName = userDeptMap[deptId] || userDepartments.find(d => d.departmentId === deptId)?.departmentName || `Phòng ban ${deptId}`
      setTasksByDepartment({
        [deptName]: sortedFiltered
      })
    } else {
      // Nếu chọn "Tất cả", group lại theo department (đã được sort trong groupTasksByDepartment)
      // Chỉ group theo phòng ban mà user thực sự thuộc về
      const userDeptIds = userDepartments.map(dept => dept.departmentId)
      const grouped = groupTasksByDepartment(sortedFiltered, userDeptMap, userDeptIds)
      setTasksByDepartment(grouped)
    }
  }, [statusFilter, selectedDepartment, tasks, userDeptMap, userDepartments])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      
      // Load tasks và departments song song
      const [tasksResponse, deptResponse] = await Promise.all([
        taskService.getMyTasks(),
        departmentService.getDepartmentsByUserId(user.userId)
      ])
      
      const tasksList = tasksResponse.data.result || []
      const userDepartments = deptResponse.data.result || []
      
      // Tạo map departmentId -> departmentName
      const deptMap = {}
      userDepartments.forEach(dept => {
        deptMap[dept.departmentId] = dept.departmentName
      })
      setUserDeptMap(deptMap)
      setUserDepartments(userDepartments)
      
      // Load task detail cho mỗi task để lấy đầy đủ thông tin department
      const tasksWithDetails = await Promise.all(
        tasksList.map(async (task) => {
          try {
            const detailResponse = await taskService.getTaskById(task.taskId)
            return detailResponse.data.result || task
          } catch (err) {
            console.error(`Error loading task detail ${task.taskId}:`, err)
            return task
          }
        })
      )
      
      setTasks(tasksWithDetails)
      setFilteredTasks(tasksWithDetails)
      
      // Group tasks theo department - chỉ group theo phòng ban mà user thực sự thuộc về
      const userDeptIds = userDepartments.map(dept => dept.departmentId)
      const grouped = groupTasksByDepartment(tasksWithDetails, deptMap, userDeptIds)
      setTasksByDepartment(grouped)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách tasks')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-3 sm:mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
        {/* Filter theo phòng ban */}
        {userDepartments.length > 0 && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Chọn phòng ban
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[150px] sm:min-w-[200px] text-sm"
            >
              <option value="all">Tất cả phòng ban</option>
              {userDepartments.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter theo trạng thái */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Lọc theo trạng thái
          </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setStatusFilter(TASK_STATUS.IN_PROGRESS)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
              statusFilter === TASK_STATUS.IN_PROGRESS
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Đang làm
          </button>
          <button
            onClick={() => setStatusFilter(TASK_STATUS.WAITING)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
              statusFilter === TASK_STATUS.WAITING
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Đang chờ
          </button>
          <button
            onClick={() => setStatusFilter(TASK_STATUS.COMPLETED)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              statusFilter === TASK_STATUS.COMPLETED
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoàn thành
          </button>
        </div>
        </div>
      </div>

      {Object.keys(tasksByDepartment).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(tasksByDepartment).map(([deptName, deptTasks]) => (
            <div key={deptName} className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-px flex-1 bg-gray-300"></div>
                <h2 className="text-lg font-semibold text-gray-800 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  {deptName}
                </h2>
                <div className="h-px flex-1 bg-gray-300"></div>
              </div>
      <div className="grid grid-cols-1 gap-4">
                {deptTasks.map((task) => (
                  <div key={task.taskId} onClick={() => navigate(`${taskBasePath}/tasks/${task.taskId}`)}>
                    <TaskCard task={task} basePath={taskBasePath} />
                  </div>
                ))}
              </div>
          </div>
        ))}
      </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Không có task nào</p>
        </div>
      )}
    </div>
  )
}

export default MyTasksPage

