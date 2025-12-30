import { useNavigate } from 'react-router-dom'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../utils/constants'

const TaskCard = ({ task, basePath = '/user' }) => {
  const navigate = useNavigate()
  
  // Normalize status: PENDING -> IN_PROGRESS cho hiển thị
  const normalizeStatus = (status) => {
    return status === 'PENDING' ? 'IN_PROGRESS' : status
  }
  
  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeStatus(status)
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${TASK_STATUS_COLORS[normalizedStatus] || TASK_STATUS_COLORS.PENDING}`}>
        {TASK_STATUS_LABELS[normalizedStatus] || normalizedStatus}
      </span>
    )
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

  // Kiểm tra task có sắp hết deadline hoặc quá deadline không
  const getCardStyle = () => {
    if (!task.endDate || task.status === 'COMPLETED') {
      return 'bg-white'
    }
    
    const now = new Date()
    const endDate = new Date(task.endDate)
    const isOverdue = endDate < now
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const isNearDeadline = endDate <= sixHoursFromNow && endDate > now
    
    if (isOverdue || isNearDeadline) {
      return 'bg-gray-900 text-white'
    }
    
    return 'bg-white'
  }

  const getTextColor = () => {
    if (!task.endDate || task.status === 'COMPLETED') {
      return 'text-gray-900'
    }
    
    const now = new Date()
    const endDate = new Date(task.endDate)
    const isOverdue = endDate < now
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const isNearDeadline = endDate <= sixHoursFromNow && endDate > now
    
    if (isOverdue || isNearDeadline) {
      return 'text-white'
    }
    
    return 'text-gray-900'
  }

  const getSecondaryTextColor = () => {
    if (!task.endDate || task.status === 'COMPLETED') {
      return 'text-gray-600'
    }
    
    const now = new Date()
    const endDate = new Date(task.endDate)
    const isOverdue = endDate < now
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const isNearDeadline = endDate <= sixHoursFromNow && endDate > now
    
    if (isOverdue || isNearDeadline) {
      return 'text-gray-300'
    }
    
    return 'text-gray-600'
  }

  const cardStyle = getCardStyle()
  const textColor = getTextColor()
  const secondaryTextColor = getSecondaryTextColor()

  return (
    <div className={`${cardStyle} rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <button
            onClick={() => navigate(`${basePath}/tasks/${task.taskId}`)}
            className={`text-lg font-semibold ${textColor} hover:text-blue-400 transition-colors text-left`}
          >
            {task.title}
          </button>
          {task.description && (
            <p className={`text-sm ${secondaryTextColor} mt-2 line-clamp-2`}>
              {task.description}
            </p>
          )}
        </div>
        {getStatusBadge(task.status)}
      </div>

      <div className={`space-y-2 text-sm ${secondaryTextColor}`}>
        {task.progress !== null && (
          <div className="flex items-center space-x-2">
            <span>Tiến độ:</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="font-medium">{task.progress}%</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">Bắt đầu:</span>
            <span className="ml-2">{formatDate(task.startDate)}</span>
          </div>
          <div>
            <span className="font-medium">Kết thúc:</span>
            <span className={`ml-2 ${!task.endDate || task.status === 'COMPLETED' ? '' : (new Date(task.endDate) < new Date() || (new Date(task.endDate) <= new Date(new Date().getTime() + 6 * 60 * 60 * 1000) && new Date(task.endDate) > new Date()) ? 'text-red-300 font-bold' : '')}`}>
              {formatDate(task.endDate)}
            </span>
          </div>
        </div>

        {task.departmentNames && task.departmentNames.length > 0 && (
          <div>
            <span className={`font-medium ${textColor}`}>Phòng ban đang làm:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {task.departmentNames.map((deptName, index) => {
                const isDark = cardStyle === 'bg-gray-900'
                return (
                  <span
                    key={index}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                      isDark 
                        ? 'bg-blue-900 text-blue-100 border-blue-700' 
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}
                  >
                    {deptName}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {task.assignedUserNames && task.assignedUserNames.length > 0 && (
          <div>
            <span className="font-medium">Người thực hiện:</span>
            <span className="ml-2">{task.assignedUserNames.join(', ')}</span>
          </div>
        )}

        {task.completedAt && (
          <div className={cardStyle === 'bg-gray-900' ? 'text-green-300' : 'text-green-600'}>
            <span className="font-medium">Hoàn thành:</span>
            <span className="ml-2">{formatDate(task.completedAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskCard

