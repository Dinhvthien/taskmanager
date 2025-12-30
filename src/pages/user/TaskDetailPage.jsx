import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { departmentService } from '../../services/departmentService'
import LoadingSpinner from '../../components/LoadingSpinner'
import EvaluationModal from '../../components/EvaluationModal'
import TaskProgressBar from '../../components/TaskProgressBar'
import { TASK_STATUS, TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_RATING_LABELS } from '../../utils/constants'

// Component để thay đổi trạng thái task giao trực tiếp - giống TaskProgressBar
const DirectTaskStatusUpdate = ({ task, onStatusUpdate, canUpdate = false }) => {
  const [updating, setUpdating] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [waitingReason, setWaitingReason] = useState('')
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Trạng thái theo thứ tự - chỉ hiển thị 3 trạng thái: Đang làm -> Đang chờ -> Hoàn thành
  const statusOrder = ['IN_PROGRESS', 'WAITING', 'COMPLETED']
  const statusLabels = {
    IN_PROGRESS: 'Đang làm',
    WAITING: 'Đang chờ',
    COMPLETED: 'Hoàn thành'
  }

  const statusColors = {
    PENDING: 'bg-gray-400',
    IN_PROGRESS: 'bg-blue-500',
    WAITING: 'bg-yellow-500',
    COMPLETED: 'bg-emerald-500'
  }

  const statusBgColors = {
    PENDING: 'bg-gray-50 border-gray-300',
    IN_PROGRESS: 'bg-blue-50 border-blue-300',
    WAITING: 'bg-yellow-50 border-yellow-300',
    COMPLETED: 'bg-emerald-50 border-emerald-300'
  }

  // Tính toán vị trí trên thanh tiến độ
  const getStatusPosition = (status) => {
    // Nếu status là PENDING hoặc ACCEPTED, coi như IN_PROGRESS (vị trí đầu tiên)
    const normalizedStatus = (status === 'PENDING' || status === 'ACCEPTED') ? 'IN_PROGRESS' : status
    const index = statusOrder.indexOf(normalizedStatus)
    if (index === -1) return 0 // Nếu không tìm thấy, trả về 0
    return (index / (statusOrder.length - 1)) * 100
  }

  // Normalize status: PENDING/ACCEPTED -> IN_PROGRESS cho hiển thị
  // Sử dụng refreshKey để đảm bảo tính lại khi status thay đổi
  const currentStatus = task?.status || 'IN_PROGRESS'
  const displayStatus = (currentStatus === 'PENDING' || currentStatus === 'ACCEPTED') ? 'IN_PROGRESS' : currentStatus
  // Tính lại currentPosition mỗi khi task.status hoặc refreshKey thay đổi
  const currentPosition = getStatusPosition(displayStatus)
  
  // Debug log để kiểm tra (chỉ trong development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('DirectTaskStatusUpdate - Status changed:', { 
        currentStatus, 
        displayStatus, 
        currentPosition, 
        refreshKey,
        taskStatus: task?.status 
      })
    }
  }, [task?.status, refreshKey, currentPosition, displayStatus])

  const handleStatusClick = () => {
    if (!canUpdate) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cannot update status - canUpdate is false')
      }
      return
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Opening status change modal')
    }
    setSelectedStatus(null)
    // Load lý do chờ hiện tại (nếu có)
    const currentWaitingReason = task?.waitingReason || ''
    setWaitingReason(currentWaitingReason)
    setShowReasonModal(true)
  }

  const handleStatusChange = async (newStatus) => {
    if (!newStatus) return

    const trimmedReason = waitingReason.trim()
    if (newStatus === 'WAITING' && !trimmedReason) {
      alert('Vui lòng nhập lý do chờ')
      return
    }

    try {
      setUpdating(true)
      await taskService.updateTask(task.taskId, {
        status: newStatus,
        waitingReason: newStatus === 'WAITING' ? trimmedReason : null
      })
      
      if (onStatusUpdate) {
        await onStatusUpdate() // Đợi reload xong
      }
      
      // Force re-render để cập nhật thanh tiến độ
      setRefreshKey(prev => prev + 1)
      
      setShowReasonModal(false)
      setSelectedStatus(null)
      setWaitingReason('')
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Thanh tiến độ chính */}
      <div className="relative pb-24">
        {/* Background thanh tiến độ */}
        <div className="relative h-12 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl overflow-visible shadow-inner border border-gray-200">
          {/* Thanh tiến độ đã hoàn thành với gradient */}
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 transition-all duration-500 ease-out shadow-lg rounded-xl"
            style={{ width: `${currentPosition}%` }}
          />
          
          {/* Các điểm đánh dấu trạng thái */}
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            const isActive = statusOrder.indexOf(displayStatus) >= index
            
            return (
              <div
                key={status}
                className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
                style={{ left: `${position}%`, transform: 'translateX(-50%)', zIndex: 20 }}
              >
                {/* Điểm đánh dấu */}
                <div
                  className={`w-6 h-6 rounded-full border-2 shadow-lg transition-all duration-300 ${
                    isActive
                      ? `${statusColors[status]} border-white scale-110`
                      : 'bg-white border-gray-400 scale-100'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* Khu vực hiển thị trạng thái hiện tại */}
        <div className="relative mt-4">
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            
            if (status !== displayStatus) return null
            
            return (
              <div
                key={status}
                className="absolute flex flex-col items-center"
                style={{ 
                  left: `${position}%`, 
                  transform: 'translateX(-50%)',
                  width: '140px',
                  top: 0
                }}
              >
                <div className="flex flex-col items-center space-y-1.5 w-full">
                  <div
                    className={`relative w-full px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all duration-200 ${
                      isHovered 
                        ? 'scale-105 z-30 shadow-lg' 
                        : 'scale-100'
                    } ${statusBgColors[status]} ${canUpdate ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-not-allowed opacity-60'}`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (process.env.NODE_ENV === 'development') {
                        console.log('Status badge clicked, canUpdate:', canUpdate, 'displayStatus:', displayStatus)
                      }
                      if (canUpdate) {
                        handleStatusClick()
                      } else {
                        alert('Bạn không có quyền thay đổi trạng thái công việc này')
                      }
                    }}
                    title={canUpdate ? 'Nhấn để thay đổi trạng thái' : 'Bạn không có quyền thay đổi trạng thái'}
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[status]}`} />
                      <span className="text-gray-800 font-semibold text-center truncate">
                        {statusLabels[displayStatus]}
                      </span>
                    </div>
                    {isHovered && task?.waitingReason && task?.status === 'WAITING' && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800 whitespace-nowrap z-40 shadow-lg">
                        Lý do: {task.waitingReason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Nhãn trạng thái phía dưới */}
        <div className="relative mt-20">
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            const isActive = statusOrder.indexOf(displayStatus) >= index
            
            return (
              <div
                key={status}
                className="absolute text-center"
                style={{ left: `${position}%`, transform: 'translateX(-50%)', width: '140px' }}
              >
                <div className={`text-sm font-semibold transition-colors ${
                  isActive ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {statusLabels[status]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal chọn trạng thái */}
      {showReasonModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReasonModal(false)
              setSelectedStatus(null)
              setWaitingReason('')
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Thay đổi trạng thái - Công việc
            </h3>
            
            <div className="space-y-3 mb-4">
              {(() => {
                // Chỉ cho phép chuyển trạng thái tiến lên (không cho quay lại)
                const getAvailableNextStatuses = () => {
                  const currentIndex = statusOrder.indexOf(displayStatus)
                  if (currentIndex === -1) return []
                  
                  // Chỉ lấy các trạng thái sau trạng thái hiện tại
                  return statusOrder.slice(currentIndex + 1)
                }
                
                const availableStatuses = getAvailableNextStatuses()
                
                if (availableStatuses.length === 0) {
                  return (
                    <div className="text-center py-4 text-gray-500">
                      Công việc đã ở trạng thái cuối cùng, không thể chuyển trạng thái nữa.
                    </div>
                  )
                }
                
                return availableStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      if (status === 'WAITING') {
                        setSelectedStatus(status)
                      } else {
                        handleStatusChange(status)
                      }
                    }}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                      selectedStatus === status
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium">{statusLabels[status]}</div>
                  </button>
                ))
              })()}
            </div>

            {selectedStatus === 'WAITING' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lý do chờ *
                </label>
                <textarea
                  value={waitingReason}
                  onChange={(e) => setWaitingReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập lý do chờ..."
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReasonModal(false)
                  setSelectedStatus(null)
                  setWaitingReason('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              {selectedStatus && (
                <button
                  onClick={() => handleStatusChange(selectedStatus)}
                  disabled={updating || (selectedStatus === 'WAITING' && !waitingReason.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Đang cập nhật...' : 'Xác nhận'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TaskDetailPage = ({ basePath }) => {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Tự động detect basePath từ location nếu không có prop
  const currentBasePath = basePath || (location.pathname.startsWith('/director') ? '/director' : 
                                      location.pathname.startsWith('/manager') ? '/manager' : '/user')
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [evaluation, setEvaluation] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [canUpdateStatus, setCanUpdateStatus] = useState(false)
  const [userDepartments, setUserDepartments] = useState([])
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    loadTaskDetail()
    loadComments()
    loadEvaluation()
    loadHistory()
    loadUserDepartments()
    loadUserRole()
  }, [taskId])

  useEffect(() => {
    if (task) {
      checkUpdatePermission()
    }
  }, [task, userDepartments, userRole])

  const loadUserRole = () => {
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        const roles = user.roles || []
        // Kiểm tra role DIRECTOR hoặc SUPER_ADMIN
        if (roles.includes('DIRECTOR') || roles.includes('SUPER_ADMIN')) {
          setUserRole('DIRECTOR')
        } else if (roles.includes('MANAGER') || roles.includes('DEPARTMENT_MANAGER')) {
          setUserRole('MANAGER')
        } else {
          setUserRole('USER')
        }
      }
    } catch (err) {
      console.error('Error loading user role:', err)
      setUserRole(null)
    }
  }

  const loadTaskDetail = async () => {
    try {
      const response = await taskService.getTaskById(taskId)
      setTask(response.data.result)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thông tin task')
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      const response = await taskService.getTaskComments(taskId)
      setComments(response.data.result || [])
    } catch (err) {
      console.error('Error loading comments:', err)
    }
  }

  const loadEvaluation = async () => {
    try {
      const response = await taskService.getTaskEvaluation(taskId)
      setEvaluation(response.data.result)
    } catch (err) {
      // Evaluation có thể chưa có
      console.error('Error loading evaluation:', err)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await taskService.getTaskHistory(taskId)
      // Sắp xếp theo thời gian mới nhất trước
      const sortedHistory = (response.data.result || []).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )
      setHistory(sortedHistory)
    } catch (err) {
      console.error('Error loading history:', err)
      setHistory([])
    }
  }

  const loadUserDepartments = async () => {
    try {
      const userStr = localStorage.getItem('user')
      if (!userStr) return
      
      const user = JSON.parse(userStr)
      const response = await departmentService.getDepartmentsByUserId(user.userId)
      setUserDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading user departments:', err)
    }
  }

  const checkUpdatePermission = () => {
    if (!task) {
      setCanUpdateStatus(false)
      return
    }

    const userStr = localStorage.getItem('user')
    if (!userStr) {
      setCanUpdateStatus(false)
      return
    }

    // Cho phép tất cả các role đều có quyền thay đổi trạng thái
    setCanUpdateStatus(true)
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      await taskService.createComment(taskId, { 
        taskId: parseInt(taskId),
        content: newComment 
      })
      setNewComment('')
      loadComments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi thêm comment')
    } finally {
      setSubmitting(false)
    }
  }


  const handleEvaluate = async (data) => {
    try {
      await taskService.createEvaluation(taskId, data)
      loadEvaluation()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo đánh giá')
      throw err
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('vi-VN')
  }

  if (loading) return <LoadingSpinner />

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy task</p>
        <button
          onClick={() => navigate('/user/tasks')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Quay lại danh sách
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`${currentBasePath}/tasks`)}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Quay lại
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.PENDING}`}>
                  {TASK_STATUS_LABELS[task.status] || task.status}
                </span>
              </div>
            </div>

            {task.description && (
              <div key="description" className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Mô tả</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Tiến trình theo phòng ban */}
            {task.departmentIds && task.departmentIds.length > 0 && (
              <div key="progress-bar" className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Tiến trình theo phòng ban</h3>
                <TaskProgressBar 
                  task={task} 
                  onStatusUpdate={loadTaskDetail}
                  canUpdate={canUpdateStatus}
                />
              </div>
            )}

            {/* Thay đổi trạng thái cho task giao trực tiếp (không qua phòng ban) */}
            {(!task.departmentIds || task.departmentIds.length === 0) && (
              <div key="direct-status-update" className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Tiến trình công việc</h3>
                <DirectTaskStatusUpdate 
                  key={`direct-status-${task.taskId}-${task.status}`}
                  task={task} 
                  onStatusUpdate={loadTaskDetail}
                  canUpdate={canUpdateStatus}
                />
              </div>
            )}

          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Bình luận</h3>
            
            <form onSubmit={handleSubmitComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Thêm bình luận..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi bình luận'}
              </button>
            </form>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có bình luận nào</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.commentId} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold">
                          {comment.userName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-900">{comment.userName}</span>
                          <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Evaluation */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Đánh giá
              </h3>
              {/* Chỉ Director mới được tạo đánh giá */}
              {!evaluation && task.status === TASK_STATUS.COMPLETED && (userRole === 'DIRECTOR' || userRole === 'SUPER_ADMIN') && (
                <button
                  onClick={() => setShowEvaluationModal(true)}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Tạo đánh giá</span>
                </button>
              )}
            </div>
            
            {evaluation ? (
              <div key="evaluation-content" className="space-y-4">
                {/* Rating */}
                <div key="rating" className="bg-white rounded-lg p-4 shadow-sm border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Mức đánh giá</span>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const ratingValue = evaluation.rating === 'EXCELLENT' ? 5 :
                                          evaluation.rating === 'GOOD' ? 4 :
                                          evaluation.rating === 'AVERAGE' ? 3 :
                                          evaluation.rating === 'POOR' ? 2 : 1
                        return (
                          <svg
                            key={star}
                            className={`w-5 h-5 ${
                              star <= ratingValue
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      evaluation.rating === 'EXCELLENT' ? 'bg-green-100 text-green-800' :
                      evaluation.rating === 'GOOD' ? 'bg-blue-100 text-blue-800' :
                      evaluation.rating === 'AVERAGE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {TASK_RATING_LABELS[evaluation.rating] || evaluation.rating}
                    </span>
                  </div>
                </div>

                {/* Comment */}
                {evaluation.comment && (
                  <div key="evaluation-comment" className="bg-white rounded-lg p-4 shadow-sm border border-yellow-200">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 mb-1">Nhận xét</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{evaluation.comment}</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div key="no-evaluation" className="text-center py-6">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <p className="text-gray-500 text-sm mb-3">Chưa có đánh giá</p>
                {/* Chỉ Director mới được tạo đánh giá */}
                {task.status === TASK_STATUS.COMPLETED && (userRole === 'DIRECTOR' || userRole === 'SUPER_ADMIN') && (
                  <button
                    onClick={() => setShowEvaluationModal(true)}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Tạo đánh giá ngay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card thông tin chi tiết */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Thông tin chi tiết
            </h3>
            
            <div className="space-y-3">
              {/* Ngày bắt đầu */}
              <div key="start-date" className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ngày bắt đầu</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(task.startDate)}</p>
                </div>
              </div>

              {/* Ngày kết thúc */}
              <div key="end-date" className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ngày kết thúc</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(task.endDate)}</p>
                </div>
              </div>

              {/* Phòng ban */}
              {task.departmentNames && task.departmentNames.length > 0 && (
                <div key="departments" className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Phòng ban</p>
                    <div className="flex flex-wrap gap-2">
                      {task.departmentNames.map((deptName, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                        >
                          {deptName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Nhân viên thực hiện */}
              {task.assignedUserNames && task.assignedUserNames.length > 0 && (
                <div key="assigned-users" className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Nhân viên thực hiện</p>
                    <div className="flex flex-wrap gap-2">
                      {task.assignedUserNames.map((userName, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                        >
                          {userName}
                        </span>
                      ))}
                    </div>
                  </div>
                  </div>
                )}

              {/* Hoàn thành (nếu có) */}
              {task.completedAt && (
                <div key="completed-at" className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hoàn thành</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(task.completedAt)}</p>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Lịch sử thay đổi
            </h3>
            
            {history.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((item) => {
                  const formatDate = (dateString) => {
                    if (!dateString) return ''
                    const date = new Date(dateString)
                    return date.toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  }

                  const getActionLabel = (action) => {
                    const labels = {
                      'CREATED': 'Tạo công việc',
                      'STATUS_CHANGED': 'Thay đổi trạng thái',
                      'PROGRESS_UPDATED': 'Cập nhật tiến độ',
                      'ASSIGNED': 'Giao việc',
                      'DEPARTMENT_STATUS_CHANGED': 'Thay đổi trạng thái phòng ban'
                    }
                    return labels[action] || action
                  }

                  const getStatusLabel = (status) => {
                    return TASK_STATUS_LABELS[status] || status
                  }

                  return (
                    <div key={item.id} className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {item.fullName || item.userName || 'Người dùng'}
                            </span>
                            {item.departmentName && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {item.departmentName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-blue-600 mb-1">
                            {getActionLabel(item.action)}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-600 mb-2">{item.description}</p>
                          )}
                          {item.oldValue && item.newValue && (
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                                {item.action === 'STATUS_CHANGED' || item.action === 'DEPARTMENT_STATUS_CHANGED' 
                                  ? getStatusLabel(item.oldValue) 
                                  : item.oldValue}
                              </span>
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                                {item.action === 'STATUS_CHANGED' || item.action === 'DEPARTMENT_STATUS_CHANGED'
                                  ? getStatusLabel(item.newValue)
                                  : item.newValue}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
              </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-sm">Chưa có lịch sử thay đổi</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      <EvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        taskId={taskId}
        onEvaluate={handleEvaluate}
      />
    </div>
  )
}

export default TaskDetailPage

