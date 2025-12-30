import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../utils/constants'

const RecurringTaskGroup = ({ recurringTask, tasks, onEdit, onDeactivate, onActivate }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()
  
  const isActive = recurringTask.isActive !== false

  // Tính toán thống kê
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length
  const pendingTasks = tasks.filter(t => t.status === 'PENDING').length
  
  // Tính tiến độ trung bình
  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
    : 0

  // Lấy thời gian bắt đầu và kết thúc
  const startDate = tasks.length > 0 ? new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime()))) : null
  const endDate = tasks.length > 0 ? new Date(Math.max(...tasks.map(t => new Date(t.endDate).getTime()))) : null

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`mb-4 border rounded-lg shadow-sm ${
      isActive ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
    }`}>
      {/* Header - Collapsed View */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="flex-shrink-0 text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {recurringTask.title}
                  </h3>
                  {!isActive && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-400 text-white">
                      Đã dừng
                    </span>
                  )}
                </div>
                {recurringTask.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {recurringTask.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 ml-8">
              {/* Phòng ban */}
              {recurringTask.departmentNames && recurringTask.departmentNames.length > 0 && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div className="flex flex-wrap gap-1">
                    {recurringTask.departmentNames.slice(0, 2).map((name, idx) => (
                      <span key={idx} className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {name}
                      </span>
                    ))}
                    {recurringTask.departmentNames.length > 2 && (
                      <span className="px-2 py-1 text-xs font-medium text-gray-600">
                        +{recurringTask.departmentNames.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Trạng thái */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">
                  {completedTasks}/{totalTasks} hoàn thành
                </span>
              </div>

              {/* Tiến độ */}
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${avgProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                  {avgProgress}%
                </span>
              </div>

              {/* Thời gian */}
              {startDate && endDate && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(recurringTask)
              }}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Chỉnh sửa
            </button>
            {isActive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeactivate(recurringTask.recurringTaskId)
                }}
                className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Dừng lặp lại
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(recurringTask.recurringTaskId)
                }}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                Kích hoạt lại
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded View - Task List */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4 space-y-2">
            {tasks.map((task) => {
              const now = new Date()
              const taskEndDate = task.endDate ? new Date(task.endDate) : null
              const hoursUntilDeadline = taskEndDate ? (taskEndDate - now) / (1000 * 60 * 60) : null
              const isOverdue = taskEndDate && taskEndDate < now && task.status !== 'COMPLETED'
              const isNearDeadline = hoursUntilDeadline && hoursUntilDeadline > 0 && hoursUntilDeadline <= 6 && task.status !== 'COMPLETED'

              return (
                <div
                  key={task.taskId}
                  onClick={() => navigate(`/director/tasks/${task.taskId}`)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                    isOverdue ? 'bg-gray-900 text-white border-gray-700' :
                    isNearDeadline ? 'bg-red-50 border-red-200' :
                    'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className={`text-sm font-semibold ${isOverdue ? 'text-white' : 'text-gray-900'}`}>
                          {task.title}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          isOverdue ? 'bg-gray-800 text-white' :
                          isNearDeadline ? 'bg-red-500 text-white' :
                          TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.PENDING
                        }`}>
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs">
                        <span className={isOverdue ? 'text-gray-300' : 'text-gray-600'}>
                          {formatDate(new Date(task.startDate))} - {formatDate(new Date(task.endDate))}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                          <span className={isOverdue ? 'text-gray-300' : 'text-gray-700'}>
                            {task.progress || 0}%
                          </span>
                        </div>
                      </div>
                      {/* Hiển thị lý do chờ */}
                      {(task.status === 'WAITING' || (task.departmentWaitingReasons && Object.keys(task.departmentWaitingReasons).length > 0)) && (
                        <div className="mt-2">
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
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/director/tasks/${task.taskId}`)
                      }}
                      className="ml-4 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecurringTaskGroup

