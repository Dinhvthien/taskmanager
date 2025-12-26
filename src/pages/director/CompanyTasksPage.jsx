import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { directorService } from '../../services/directorService'
import { departmentService } from '../../services/departmentService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import EditTaskModal from '../../components/EditTaskModal'
import Pagination from '../../components/Pagination'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../../utils/constants'

const CompanyTasksPage = () => {
  const [tasks, setTasks] = useState([])
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
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    departmentIds: []
  })

  useEffect(() => {
    loadDirector()
  }, [])

  useEffect(() => {
    if (director) {
      loadDepartments()
    }
  }, [director])

  useEffect(() => {
    if (director && departmentsLoaded) {
      loadTasks()
    }
  }, [director, currentPage, departmentsLoaded])

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
    
    // Validate departments
    if (formData.departmentIds.length === 0) {
      errors.departmentIds = 'Vui lòng chọn ít nhất một phòng ban'
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
        departmentIds: formData.departmentIds.map(id => parseInt(id))
      }
      await taskService.createTask(data)
      setShowCreateModal(false)
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        departmentIds: []
      })
      setValidationErrors({})
      loadTasks()
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
    await loadTasks() // Reload tasks sau khi cập nhật
    setShowEditModal(false)
    setSelectedTaskForEdit(null)
  }

  if (loading && tasks.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Tasks công ty</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 hidden sm:block">Quản lý tasks trong công ty của bạn</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          <span>+</span>
          <span>Tạo Task</span>
        </button>
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
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2.5">
            {tasks.map((task) => {
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

          {/* Desktop Table View */}
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

          {tasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">Chưa có task nào</p>
            </div>
          )}

          {totalPages > 1 && (
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
        onClose={() => setShowCreateModal(false)}
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
              onChange={(e) => {
                          const deptId = String(dept.departmentId)
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              departmentIds: [...formData.departmentIds, deptId]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              departmentIds: formData.departmentIds.filter(id => id !== deptId)
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
                    departmentIds: []
                  })
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

