import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { taskService } from '../../services/taskService'
import { departmentService } from '../../services/departmentService'
import { userService } from '../../services/userService'
import { attachmentService } from '../../services/attachmentService'
import LoadingSpinner from '../../components/LoadingSpinner'
import EvaluationModal from '../../components/EvaluationModal'
import TaskProgressBar from '../../components/TaskProgressBar'
import FileUpload from '../../components/FileUpload'
import AttachmentList from '../../components/AttachmentList'
import { TASK_STATUS, TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_RATING_LABELS } from '../../utils/constants'
import { PaperClipIcon } from '@heroicons/react/24/outline'

// Component để upload file cho task
const TaskFileUpload = ({ taskId, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    console.log('📎 TASK file selected:', file.name, 'Task ID:', taskId)
    setSelectedFiles(prev => [...prev, file])
  }

  const handleFileRemove = (index) => {
    console.log('🗑️ TASK file removed at index:', index, 'Task ID:', taskId)
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    if (!taskId) {
      setError('Task ID không hợp lệ')
      return
    }

    try {
      setUploading(true)
      setError('')
      
      for (const file of selectedFiles) {
        try {
          await attachmentService.uploadTaskAttachment(taskId, file)
        } catch (fileErr) {
          console.error('Error uploading file:', fileErr)
          setError(`Lỗi khi upload file "${file.name}": ${fileErr.response?.data?.message || 'Lỗi không xác định'}`)
          setUploading(false)
          return // Stop uploading other files if one fails
        }
      }
      
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (onUploadSuccess) {
        await onUploadSuccess()
      }
      setError('') // Clear error on success
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.message || 'Lỗi khi upload file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <FileUpload
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        selectedFiles={selectedFiles}
        disabled={uploading}
        maxFiles={10}
        maxSize={50 * 1024 * 1024} // 50MB
      />
      {selectedFiles.length > 0 && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <PaperClipIcon className="w-4 h-4" />
          <span>{uploading ? 'Đang upload...' : `Upload ${selectedFiles.length} file`}</span>
        </button>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}

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
  const [replyTo, setReplyTo] = useState(null)
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
  // Mention & reply
  const [allUsers, setAllUsers] = useState([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState(null)
  const [caretPosition, setCaretPosition] = useState(0)
  const commentTextareaRef = useRef(null)
  const [expandedComments, setExpandedComments] = useState({})
  const [visibleTopLevelCount, setVisibleTopLevelCount] = useState(10)
  const [focusedCommentId, setFocusedCommentId] = useState(null)
  // File attachments
  const [taskAttachments, setTaskAttachments] = useState([])
  const [commentAttachments, setCommentAttachments] = useState({}) // Map commentId -> attachments
  const [newCommentFiles, setNewCommentFiles] = useState([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  // Edit comment
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    loadTaskDetail()
    loadComments()
    loadEvaluation()
    loadHistory()
    loadUserDepartments()
    loadUserRole()
    loadAllUsers()
    loadTaskAttachments()
  }, [taskId])

  // Nhận focusCommentId từ navigation state (khi click từ notification)
  useEffect(() => {
    if (location.state && location.state.focusCommentId) {
      setFocusedCommentId(location.state.focusCommentId)
    }
  }, [location.state])

  // Sau khi load comments, nếu có focusedCommentId thì đảm bảo comment đó được hiển thị và scroll tới
  useEffect(() => {
    if (!focusedCommentId || !comments || comments.length === 0) return

    // Tìm comment cần focus
    const targetComment = comments.find(c => c.id === focusedCommentId)
    if (!targetComment) return

    // Xây chuỗi cha để auto-expand các thread chứa comment này
    const parentIds = []
    let currentParentId = targetComment.parentCommentId
    while (currentParentId) {
      parentIds.push(currentParentId)
      const parentComment = comments.find(c => c.id === currentParentId)
      if (!parentComment) break
      currentParentId = parentComment.parentCommentId
    }

    // Nếu comment nằm trong thread con, cần expand toàn bộ cha
    if (parentIds.length > 0) {
      setExpandedComments(prev => {
        const updated = { ...prev }
        parentIds.forEach(id => {
          updated[id] = true
        })
        return updated
      })
    }

    // Đảm bảo top-level comment chứa comment này nằm trong vùng đang hiển thị
    const topLevelComments = comments.filter(c => !c.parentCommentId)
    let topLevelCommentId = targetComment.id
    if (parentIds.length > 0) {
      topLevelCommentId = parentIds[parentIds.length - 1]
    }
    const topLevelIndex = topLevelComments.findIndex(c => c.id === topLevelCommentId)
    if (topLevelIndex !== -1 && topLevelIndex >= visibleTopLevelCount) {
      setVisibleTopLevelCount(topLevelIndex + 5)
    }

    // Đợi React render lại rồi mới scroll để chắc chắn element đã có trong DOM
    const timeoutId = setTimeout(() => {
      const el = document.getElementById(`comment-${focusedCommentId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50')
        }, 2000)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [focusedCommentId, comments, visibleTopLevelCount])

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
      const commentsList = response.data.result || []
      setComments(commentsList)
      setVisibleTopLevelCount(10)
      setExpandedComments({})
      
      // Load attachments cho từng comment - KHÔNG liên quan đến task attachments
      // Sử dụng Promise.all để load song song nhưng không block
      const commentAttachmentPromises = commentsList.map(comment => 
        loadCommentAttachments(comment.id).catch(err => {
          // Ignore errors - comment có thể chưa có attachments
          console.debug(`No attachments for comment ${comment.id}`)
        })
      )
      await Promise.all(commentAttachmentPromises)
      
      // QUAN TRỌNG: KHÔNG gọi loadTaskAttachments() ở đây
      // loadComments chỉ load comments và comment attachments, không liên quan đến task attachments
    } catch (err) {
      console.error('Error loading comments:', err)
    }
  }

  const loadTaskAttachments = async () => {
    if (!taskId) return
    try {
      const response = await attachmentService.getTaskAttachments(taskId)
      const attachments = response.data.result || []
      // Đảm bảo chỉ lấy attachments có entityType = 'TASK' (double check từ frontend)
      // LOẠI BỎ hoàn toàn các attachments có entityType = 'COMMENT'
      // FILTER CHẶT CHẼ: Chỉ lấy TASK attachments, LOẠI BỎ hoàn toàn COMMENT attachments
      const taskOnlyAttachments = attachments.filter(att => {
        // CHỈ chấp nhận nếu entityType === 'TASK' VÀ entityId === taskId
        if (att.entityType !== 'TASK') {
          if (att.entityType === 'COMMENT') {
            console.warn(`⚠️ COMMENT attachment found in TASK attachments API response, filtering out:`, {
              attachmentId: att.attachmentId,
              entityType: att.entityType,
              entityId: att.entityId,
              fileName: att.fileName
            })
          }
          return false // LOẠI BỎ tất cả non-TASK attachments
        }
        return parseInt(att.entityId) === parseInt(taskId)
      })
      console.log(`✅ Loaded ${taskOnlyAttachments.length} TASK attachments for taskId ${taskId}`)
      setTaskAttachments(taskOnlyAttachments)
    } catch (err) {
      // Ignore 404 errors (no attachments yet)
      if (err.response?.status !== 404) {
        console.error('Error loading task attachments:', err)
      }
      setTaskAttachments([])
    }
  }

  const loadCommentAttachments = async (commentId) => {
    if (!commentId) return
    try {
      const response = await attachmentService.getCommentAttachments(commentId)
      const attachments = response.data.result || []
      // FILTER CHẶT CHẼ: Chỉ lấy COMMENT attachments, LOẠI BỎ hoàn toàn TASK attachments
      const commentOnlyAttachments = attachments.filter(att => {
        // CHỈ chấp nhận nếu entityType === 'COMMENT' VÀ entityId === commentId
        if (att.entityType !== 'COMMENT') {
          if (att.entityType === 'TASK') {
            console.warn(`⚠️ TASK attachment found in COMMENT attachments API response, filtering out:`, {
              attachmentId: att.attachmentId,
              entityType: att.entityType,
              entityId: att.entityId,
              fileName: att.fileName
            })
          }
          return false // LOẠI BỎ tất cả non-COMMENT attachments
        }
        return parseInt(att.entityId) === parseInt(commentId)
      })
      console.log(`✅ Loaded ${commentOnlyAttachments.length} COMMENT attachments for commentId ${commentId}`)
      setCommentAttachments(prev => ({
        ...prev,
        [commentId]: commentOnlyAttachments
      }))
    } catch (err) {
      // Ignore 404 errors (no attachments yet)
      if (err.response?.status !== 404) {
        console.error('Error loading comment attachments:', err)
      }
      setCommentAttachments(prev => ({
        ...prev,
        [commentId]: []
      }))
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
      setCurrentUserId(user.userId) // Lưu userId để check quyền edit/delete comment
      const response = await departmentService.getDepartmentsByUserId(user.userId)
      setUserDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading user departments:', err)
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await userService.getAllUsers(0, 200)
      const result = response.data?.result
      const content = result?.content || result || []
      setAllUsers(Array.isArray(content) ? content : [])
    } catch (err) {
      console.error('Error loading users for mentions:', err)
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
    if (!newComment.trim() && newCommentFiles.length === 0) return

    try {
      setSubmitting(true)
      setUploadingAttachments(true)
      
      // Tạo comment trước
      const commentResponse = await taskService.createComment(taskId, { 
        taskId: parseInt(taskId),
        content: newComment || '',
        parentCommentId: replyTo ? replyTo.id : null
      })
      
      const newCommentId = commentResponse.data.result?.id
      
      // Upload files nếu có - QUAN TRỌNG: phải upload vào COMMENT, KHÔNG phải TASK
      const filesToUpload = [...newCommentFiles] // Lưu lại danh sách files trước khi clear state
      if (filesToUpload.length > 0 && newCommentId) {
        console.log(`📎 Uploading ${filesToUpload.length} file(s) to COMMENT ${newCommentId}`)
        for (const file of filesToUpload) {
          try {
            // QUAN TRỌNG: uploadCommentAttachment sẽ upload vào COMMENT, KHÔNG phải TASK
            // Đảm bảo dùng đúng API endpoint: /attachments/comments/{commentId}
            const uploadResponse = await attachmentService.uploadCommentAttachment(newCommentId, file)
            const uploadedAttachment = uploadResponse.data.result
            console.log(`✓ File uploaded to COMMENT ${newCommentId}:`, {
              fileName: file.name,
              attachmentId: uploadedAttachment?.attachmentId,
              entityType: uploadedAttachment?.entityType,
              entityId: uploadedAttachment?.entityId
            })
            
            // Verify that it's a COMMENT attachment, not TASK
            if (uploadedAttachment?.entityType !== 'COMMENT') {
              console.error('❌ ERROR: File was uploaded with wrong entityType!', uploadedAttachment)
              setError(`Lỗi: File "${file.name}" được upload với entityType sai: ${uploadedAttachment?.entityType}`)
            }
          } catch (fileErr) {
            console.error('✗ Error uploading file to COMMENT:', fileErr)
            setError(`Lỗi khi upload file "${file.name}": ${fileErr.response?.data?.message || 'Lỗi không xác định'}`)
            // Continue với các file khác
          }
        }
      }
      
      // Clear form state TRƯỚC khi reload
      setNewComment('')
      setNewCommentFiles([])
      setReplyTo(null)
      
      // Reload comments để có comment mới
      await loadComments()
      
      // Load attachments cho comment mới (nếu có files)
      // Đợi một chút để đảm bảo backend đã lưu xong
      if (newCommentId && filesToUpload.length > 0) {
        setTimeout(async () => {
          console.log(`🔄 Reloading attachments for COMMENT ${newCommentId}`)
          await loadCommentAttachments(newCommentId)
        }, 1000) // Tăng thời gian chờ để đảm bảo backend xử lý xong
      }
      
      // QUAN TRỌNG: KHÔNG gọi loadTaskAttachments() ở đây
      // File comment chỉ thuộc về comment, KHÔNG thuộc về task attachments
      // Task attachments chỉ được reload khi upload file trực tiếp vào task
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi thêm comment')
    } finally {
      setSubmitting(false)
      setUploadingAttachments(false)
    }
  }

  // Handler cho comment file upload - HOÀN TOÀN ĐỘC LẬP với task file upload
  const handleCommentFileSelect = (file) => {
    console.log('📎 COMMENT file selected:', file.name, 'Current comment files count:', newCommentFiles.length)
    setNewCommentFiles(prev => {
      const updated = [...prev, file]
      console.log('✅ COMMENT files updated, new count:', updated.length)
      return updated
    })
  }

  const handleCommentFileRemove = (index) => {
    console.log('🗑️ COMMENT file removed at index:', index, 'Current comment files count:', newCommentFiles.length)
    setNewCommentFiles(prev => {
      const updated = prev.filter((_, i) => i !== index)
      console.log('✅ COMMENT files updated after removal, new count:', updated.length)
      return updated
    })
  }

  const handleAttachmentDelete = async (attachmentId, entityType, entityId) => {
    try {
      await attachmentService.deleteAttachment(attachmentId)
      
      // Xóa khỏi state tương ứng - đảm bảo không cross-contamination
      if (entityType === 'TASK') {
        // Chỉ xóa khỏi task attachments
        setTaskAttachments(prev => {
          const filtered = prev.filter(a => a.attachmentId !== attachmentId)
          console.log(`🗑️ Deleted TASK attachment ${attachmentId}, remaining: ${filtered.length}`)
          return filtered
        })
      } else if (entityType === 'COMMENT') {
        // Chỉ xóa khỏi comment attachments
        setCommentAttachments(prev => {
          const updated = {
            ...prev,
            [entityId]: (prev[entityId] || []).filter(a => a.attachmentId !== attachmentId)
          }
          console.log(`🗑️ Deleted COMMENT attachment ${attachmentId} from comment ${entityId}, remaining: ${updated[entityId]?.length || 0}`)
          return updated
        })
      }
    } catch (err) {
      console.error('Error deleting attachment:', err)
      setError(err.response?.data?.message || 'Lỗi khi xóa file')
    }
  }

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id)
    setEditingCommentContent(comment.content)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditingCommentContent('')
  }

  const handleSaveEdit = async (commentId) => {
    if (!editingCommentContent.trim()) {
      setError('Nội dung comment không được để trống')
      return
    }

    try {
      await taskService.updateComment(taskId, commentId, editingCommentContent.trim())
      await loadComments()
      setEditingCommentId(null)
      setEditingCommentContent('')
      setError('')
    } catch (err) {
      console.error('Error updating comment:', err)
      setError(err.response?.data?.message || 'Lỗi khi cập nhật comment')
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      return
    }

    try {
      await taskService.deleteComment(taskId, commentId)
      // Xóa attachments của comment khỏi state
      setCommentAttachments(prev => {
        const updated = { ...prev }
        delete updated[commentId]
        return updated
      })
      await loadComments()
      setError('')
    } catch (err) {
      console.error('Error deleting comment:', err)
      setError(err.response?.data?.message || 'Lỗi khi xóa comment')
    }
  }

  const handleCommentChange = (e) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setNewComment(value)
    setCaretPosition(cursorPos)

    const lastAtIndex = value.lastIndexOf('@', cursorPos - 1)
    if (lastAtIndex === -1) {
      setShowMentionDropdown(false)
      setMentionQuery('')
      setMentionStartIndex(null)
      return
    }

    const textAfterAt = value.slice(lastAtIndex + 1, cursorPos)
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n') || textAfterAt.includes('\t')) {
      setShowMentionDropdown(false)
      setMentionQuery('')
      setMentionStartIndex(null)
      return
    }

    setMentionQuery(textAfterAt)
    setMentionStartIndex(lastAtIndex)
    setShowMentionDropdown(true)
  }

  const filteredMentionUsers = (() => {
    if (!showMentionDropdown || mentionStartIndex === null) return []
    const q = mentionQuery.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(u => {
      const name = (u.fullName || u.userName || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  })()

  const handleSelectMentionUser = (user) => {
    if (mentionStartIndex === null) return
    // Sử dụng userName để tránh khoảng trắng, backend parse dễ hơn
    const mentionText = `@${user.userName} `
    const before = newComment.slice(0, mentionStartIndex)
    const after = newComment.slice(caretPosition)
    const newValue = before + mentionText + after
    setNewComment(newValue)
    setShowMentionDropdown(false)
    setMentionQuery('')
    setMentionStartIndex(null)

    setTimeout(() => {
      if (commentTextareaRef.current) {
        const pos = before.length + mentionText.length
        commentTextareaRef.current.focus()
        commentTextareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const toggleExpandComment = (commentId) => {
    setExpandedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
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

            {/* Task Attachments */}
            {taskId && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Files đính kèm</h4>
                  {(userRole === 'DIRECTOR' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER') && (
                    <TaskFileUpload taskId={taskId} onUploadSuccess={loadTaskAttachments} />
                  )}
                </div>
                {taskAttachments.length > 0 ? (
                  <AttachmentList
                    attachments={taskAttachments}
                    onDelete={(attachmentId) => handleAttachmentDelete(attachmentId, 'TASK', taskId)}
                    canDelete={true}
                  />
                ) : (
                  <p className="text-sm text-gray-500 py-2">Chưa có file đính kèm</p>
                )}
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
            
            {/* Danh sách comments - hiển thị trước */}
            <div className="space-y-4 mb-6">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có bình luận nào</p>
              ) : (
                (() => {
                  const topLevelComments = comments.filter(c => !c.parentCommentId)
                  const commentsByParent = comments.reduce((acc, c) => {
                    const key = c.parentCommentId || 0
                    if (!acc[key]) acc[key] = []
                    acc[key].push(c)
                    return acc
                  }, {})

                  const CommentThread = ({ comment, level = 1 }) => {
                    const children = commentsByParent[comment.id] || []
                    const isExpanded = !!expandedComments[comment.id]

                    return (
                      <div
                        id={`comment-${comment.id}`}
                        className={`${level === 1 ? 'border-b border-gray-200 pb-4 last:border-0' : 'mt-3'} ${level > 1 ? 'ml-6' : ''}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`${level === 1 ? 'w-10 h-10' : 'w-8 h-8'} bg-purple-100 rounded-full flex items-center justify-center`}>
                            <span className={`${level === 1 ? 'text-base' : 'text-sm'} text-purple-600 font-semibold`}>
                              {comment.userName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`font-semibold text-gray-900 ${level === 1 ? '' : 'text-sm'}`}>
                                  {comment.fullName || comment.userName}
                                </span>
                                {comment.replyToFullName || comment.replyToUserName ? (
                                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                    Trả lời {comment.replyToFullName || comment.replyToUserName}
                                  </span>
                                ) : null}
                                <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                                {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                                  <span className="text-xs text-gray-400">(đã chỉnh sửa)</span>
                                )}
                              </div>
                              {/* Edit/Delete buttons - chỉ hiển thị cho người tạo comment */}
                              {currentUserId === comment.userId && (
                                <div className="flex items-center gap-2">
                                  {editingCommentId !== comment.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleEditComment(comment)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        Chỉnh sửa
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                                      >
                                        Xóa
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            
                            {/* Edit form hoặc display content */}
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2 mt-2">
                                <textarea
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  rows={3}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Nhập nội dung comment..."
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(comment.id)}
                                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`text-gray-700 whitespace-pre-wrap ${level === 1 ? '' : 'text-sm'}`}>{comment.content}</p>
                                
                                {/* Comment Attachments */}
                                {commentAttachments[comment.id] && commentAttachments[comment.id].length > 0 && (
                                  <div className="mt-2">
                                    <AttachmentList
                                      attachments={commentAttachments[comment.id]}
                                      onDelete={(attachmentId) => handleAttachmentDelete(attachmentId, 'COMMENT', comment.id)}
                                      canDelete={true} // Người upload có thể xóa
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            
                            {/* Action buttons - chỉ hiển thị khi không đang edit */}
                            {editingCommentId !== comment.id && (
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTo(comment)
                                    // Khi reply, luôn dùng @username để backend nhận diện chính xác
                                    const mention = `@${comment.userName} `
                                    // Luôn thêm @mention vào đầu comment nếu chưa có
                                    const currentText = newComment.trim()
                                    if (!currentText.includes(mention.trim())) {
                                      setNewComment(prev => {
                                        const trimmed = prev.trim()
                                        return trimmed ? `${mention}${trimmed}` : mention
                                      })
                                    } else {
                                      // Nếu đã có mention, chỉ set replyTo
                                      setNewComment(prev => prev || mention)
                                    }
                                    // Focus vào textarea
                                    setTimeout(() => {
                                      if (commentTextareaRef.current) {
                                        commentTextareaRef.current.focus()
                                      }
                                    }, 0)
                                  }}
                                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                                >
                                  Trả lời
                                </button>
                                {children.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandComment(comment.id)}
                                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                                  >
                                    {isExpanded
                                      ? 'Ẩn bớt bình luận'
                                      : `Có ${children.length} bình luận khác`}
                                  </button>
                                )}
                              </div>
                            )}

                            {children.length > 0 && isExpanded && (
                              <div className="mt-3 space-y-3">
                                {children.map(child => (
                                  <CommentThread key={child.id} comment={child} level={level + 1} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const visibleTopLevels = topLevelComments.slice(0, visibleTopLevelCount)

                  return (
                    <>
                      {visibleTopLevels.map(comment => (
                        <CommentThread key={comment.id} comment={comment} level={1} />
                      ))}
                      {visibleTopLevelCount < topLevelComments.length && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => setVisibleTopLevelCount(prev => prev + 10)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Xem thêm bình luận
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()
              )}
            </div>

            {/* Form comment - đặt ở dưới danh sách comments */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <form onSubmit={handleSubmitComment} className="relative">
                {replyTo && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-xs text-gray-700">
                      Đang trả lời bình luận của{' '}
                      <span className="font-semibold">
                        {replyTo.fullName || replyTo.userName}
                      </span>
                      {replyTo.content && (
                        <span className="text-gray-500">
                          : "{replyTo.content.length > 50 ? replyTo.content.slice(0, 50) + '...' : replyTo.content}"
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Hủy trả lời
                    </button>
                  </div>
                )}
                <textarea
                  ref={commentTextareaRef}
                  value={newComment}
                  onChange={handleCommentChange}
                  placeholder="Thêm bình luận..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
                />
                
                {/* File Upload cho comment - QUAN TRỌNG: chỉ upload vào COMMENT, KHÔNG upload vào TASK */}
                <div className="mb-3">
                  <FileUpload
                    onFileSelect={handleCommentFileSelect}
                    onFileRemove={handleCommentFileRemove}
                    selectedFiles={newCommentFiles}
                    disabled={submitting || uploadingAttachments}
                    maxFiles={5}
                    maxSize={50 * 1024 * 1024} // 50MB
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || uploadingAttachments || (!newComment.trim() && newCommentFiles.length === 0)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting || uploadingAttachments ? 'Đang gửi...' : 'Gửi bình luận'}
                </button>

                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                  <div
                    className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto z-20"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredMentionUsers.map((user) => (
                      <button
                        type="button"
                        key={user.userId}
                        onClick={() => handleSelectMentionUser(user)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-purple-50 text-left"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.fullName || user.userName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.email || user.userName}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </form>
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

