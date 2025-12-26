import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { departmentService } from '../../services/departmentService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import EditTaskModal from '../../components/EditTaskModal'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../../utils/constants'

const DepartmentTasksPage = () => {
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [departmentInfo, setDepartmentInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState(null)
  const [availableUsers, setAvailableUsers] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: ''
  })
  const navigate = useNavigate()
  const location = useLocation()
  
  // Xác định basePath dựa trên location
  const basePath = location.pathname.startsWith('/director') ? '/director' : '/manager'

  useEffect(() => {
    loadDepartments()
    loadUserRole()
    // Kiểm tra query parameter nếu có (cho giám đốc)
    const urlParams = new URLSearchParams(window.location.search)
    const deptId = urlParams.get('departmentId')
    if (deptId) {
      setSelectedDepartment(parseInt(deptId))
    }
  }, [])

  const loadUserRole = () => {
    try {
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      const roles = user.roles || []
      // Kiểm tra role DIRECTOR hoặc MANAGER/DEPARTMENT_MANAGER
      if (roles.includes('DIRECTOR') || roles.includes('SUPER_ADMIN')) {
        setUserRole('DIRECTOR')
      } else if (roles.includes('MANAGER') || roles.includes('DEPARTMENT_MANAGER')) {
        setUserRole('MANAGER')
      } else {
        setUserRole('USER')
      }
    } catch (err) {
      console.error('Error loading user role:', err)
      setUserRole('USER')
    }
  }

  useEffect(() => {
    if (departmentsLoaded && selectedDepartment) {
      loadTasks()
      loadAvailableUsers()
      loadDepartmentInfo()
    } else if (departmentsLoaded && !selectedDepartment) {
      // Nếu đã load departments xong nhưng không có department nào, set loading = false
      setLoading(false)
    }
  }, [selectedDepartment, departmentsLoaded])

  const loadDepartments = async () => {
    try {
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      const roles = user.roles || []
      
      let response
      // Nếu là DIRECTOR, load tất cả departments của director
      if (roles.includes('DIRECTOR') || roles.includes('SUPER_ADMIN')) {
        const { directorService } = await import('../../services/directorService')
        const directorResponse = await directorService.getMyDirector()
        response = await departmentService.getDepartmentsByDirectorId(directorResponse.data.result.directorId)
      } else {
        // Nếu là MANAGER, load departments của manager
        response = await departmentService.getDepartmentsByManagerId(user.userId)
      }
      
      const depts = response.data.result || []
      setDepartments(depts)
      if (depts.length > 0) {
        setSelectedDepartment(depts[0].departmentId)
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách departments')
      setDepartments([])
    } finally {
      setDepartmentsLoaded(true)
    }
  }

  const loadTasks = async () => {
    if (!selectedDepartment) return

    try {
      setLoading(true)
      const response = await taskService.getTasksByDepartmentId(selectedDepartment)
      setTasks(response.data.result || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartmentInfo = async () => {
    if (!selectedDepartment) return

    try {
      const response = await departmentService.getDepartmentById(selectedDepartment)
      setDepartmentInfo(response.data.result)
    } catch (err) {
      console.error('Error loading department info:', err)
    }
  }

  const loadAvailableUsers = async () => {
    if (!selectedDepartment) return

    try {
      // Lấy tất cả users trong department (cả USER và MANAGER)
      const response = await departmentService.getUsersWithDetailsByDepartmentId(selectedDepartment)
      const allUsers = response.data?.result || []
      // Hiển thị tất cả users (không filter)
      setAvailableUsers(allUsers)
    } catch (err) {
      console.error('Error loading available users:', err)
      setAvailableUsers([])
    }
  }

  const handleAssignClick = async (task, e) => {
    e.stopPropagation() // Ngăn navigate khi click nút
    setSelectedTask(task)
    setError('')
    
    try {
      // Load task detail để lấy danh sách users đã được giao
      const taskResponse = await taskService.getTaskById(task.taskId)
      const taskDetail = taskResponse.data.result
      // Set selectedUserIds là danh sách users đã được giao
      const assignedUserIds = taskDetail.assignedUserIds || []
      setSelectedUserIds(assignedUserIds)
    } catch (err) {
      console.error('Error loading task detail:', err)
      setSelectedUserIds([])
    }
    
    setShowAssignModal(true)
  }

  const handleToggleUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleAssignTask = async () => {
    if (!selectedTask || selectedUserIds.length === 0) {
      setError('Vui lòng chọn ít nhất một nhân viên')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      
      await taskService.assignTask({
        taskId: selectedTask.taskId,
        userIds: selectedUserIds.map(id => parseInt(id))
      })
      
      setShowAssignModal(false)
      setSelectedTask(null)
      setSelectedUserIds([])
      loadTasks() // Reload tasks để cập nhật
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi giao task')
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
    await loadTasks() // Reload tasks sau khi cập nhật
    setShowEditModal(false)
    setSelectedTaskForEdit(null)
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
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!selectedDepartment || !departmentInfo || isSubmitting) return

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      setValidationErrors({})
      const data = {
        directorId: departmentInfo.directorId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        departmentIds: [selectedDepartment] // Tự động gán cho phòng ban đã chọn
      }
      await taskService.createTask(data)
      setShowCreateModal(false)
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: ''
      })
      setValidationErrors({})
      loadTasks()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo task')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading && tasks.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
        
        </div>
        {userRole === 'MANAGER' && selectedDepartment && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            <span>+</span>
            <span>Tạo Task</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {departments.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn phòng ban
          </label>
          <select
            value={selectedDepartment || ''}
            onChange={(e) => setSelectedDepartment(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {departments.map((dept) => (
              <option key={dept.departmentId} value={dept.departmentId}>
                {dept.departmentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có task nào trong phòng ban này</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
                    {tasks.map((task) => {
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
                          onClick={() => navigate(`${basePath}/tasks/${task.taskId}`)}
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
                          <td className="px-6 py-4 whitespace-nowrap">
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isOverdue ? 'text-gray-300' : 'text-gray-600'}`}>
                              {formatDate(task.startDate)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isOverdue ? 'text-red-300' : isNearDeadline ? 'text-red-600' : 'text-gray-600'}`}>
                              {formatDate(task.endDate)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-3">
                              {/* Chỉ hiển thị nút chỉnh sửa cho DIRECTOR và MANAGER */}
                              {(userRole === 'DIRECTOR' || userRole === 'MANAGER') && (
                                <button
                                  onClick={(e) => handleEditClick(task, e)}
                                  className="text-blue-600 hover:text-blue-900 transition-colors font-medium"
                                >
                                  Chỉnh sửa
                                </button>
                              )}
                              <button
                                onClick={(e) => handleAssignClick(task, e)}
                                className="text-green-600 hover:text-green-900 transition-colors font-medium"
                              >
                                Giao task
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
        </>
      )}

      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowAssignModal(false)
            setSelectedTask(null)
            setSelectedUserIds([])
            setError('')
          }
        }}
        title="Giao task cho nhân viên"
        size="lg"
      >
        <div className="space-y-4">
          {selectedTask && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-900">Task: {selectedTask.title}</p>
            </div>
          )}

          {availableUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Không có nhân viên nào trong phòng ban này</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
              <div className="space-y-2">
                {availableUsers.map((user) => {
                  const isAssigned = selectedUserIds.includes(user.userId)
                  const isManager = user.roles && user.roles.includes('MANAGER')
                  
                  return (
                    <label
                      key={user.userId}
                      className={`flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border transition-colors ${
                        isAssigned 
                          ? 'bg-green-50 border-green-200' 
                          : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleUser(user.userId)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                          {isManager && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Trưởng phòng
                            </span>
                          )}
                          {isAssigned && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Đã giao
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">@{user.userName}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  setShowAssignModal(false)
                  setSelectedTask(null)
                  setSelectedUserIds([])
                  setError('')
                }
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleAssignTask}
              disabled={isSubmitting || selectedUserIds.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang giao...' : 'Giao task'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowCreateModal(false)
            setFormData({
              title: '',
              description: '',
              startDate: '',
              endDate: ''
            })
            setValidationErrors({})
            setError('')
          }
        }}
        title="Tạo Task mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {selectedDepartment && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                <strong>Phòng ban:</strong> {departments.find(d => d.departmentId === selectedDepartment)?.departmentName}
              </p>
            </div>
          )}
          
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  validationErrors.endDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.endDate && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
              )}
            </div>
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
                    endDate: ''
                  })
                  setValidationErrors({})
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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

export default DepartmentTasksPage

