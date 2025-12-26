import { useState } from 'react'
import { taskService } from '../services/taskService'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../utils/constants'

const TaskProgressBar = ({ task, onStatusUpdate, canUpdate = false }) => {
  const [updating, setUpdating] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [waitingReason, setWaitingReason] = useState('')
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState(null)
  const [hoveredDeptId, setHoveredDeptId] = useState(null)

  if (!task || !task.departmentStatuses || !task.departmentIds) {
    return null
  }

  // Trạng thái theo thứ tự
  const statusOrder = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'WAITING', 'COMPLETED']
  const statusLabels = {
    PENDING: 'Chờ nhận việc',
    ACCEPTED: 'Đã nhận',
    IN_PROGRESS: 'Đang làm',
    WAITING: 'Đang chờ',
    COMPLETED: 'Hoàn thành'
  }

  const statusColors = {
    PENDING: 'bg-gray-400',
    ACCEPTED: 'bg-blue-500',
    IN_PROGRESS: 'bg-green-500',
    WAITING: 'bg-yellow-500',
    COMPLETED: 'bg-emerald-500'
  }

  const statusBgColors = {
    PENDING: 'bg-gray-50 border-gray-300',
    ACCEPTED: 'bg-blue-50 border-blue-300',
    IN_PROGRESS: 'bg-green-50 border-green-300',
    WAITING: 'bg-yellow-50 border-yellow-300',
    COMPLETED: 'bg-emerald-50 border-emerald-300'
  }

  // Tính toán vị trí trên thanh tiến độ
  const getStatusPosition = (status) => {
    const index = statusOrder.indexOf(status)
    return (index / (statusOrder.length - 1)) * 100
  }

  // Tính toán trạng thái chậm nhất
  const getSlowestStatus = () => {
    const statuses = Object.values(task.departmentStatuses || {})
    if (statuses.length === 0) return 'PENDING'
    
    const priorities = statuses.map(s => statusOrder.indexOf(s))
    const minPriority = Math.min(...priorities)
    return statusOrder[minPriority]
  }

  const slowestStatus = getSlowestStatus()

  const handleStatusClick = (deptId, currentStatus) => {
    if (!canUpdate) return
    
    setSelectedDeptId(deptId)
    setSelectedStatus(currentStatus)
    // Load lý do chờ hiện tại (nếu có)
    const currentWaitingReason = task.departmentWaitingReasons?.[deptId] || ''
    setWaitingReason(currentWaitingReason)
    setShowReasonModal(true)
  }

  const handleStatusChange = async (newStatus) => {
    if (!selectedDeptId || !newStatus) return

    const trimmedReason = waitingReason.trim()
    if (newStatus === 'WAITING' && !trimmedReason) {
      alert('Vui lòng nhập lý do chờ')
      return
    }

    try {
      setUpdating(true)
      await taskService.updateDepartmentStatus(task.taskId, {
        departmentId: selectedDeptId,
        status: newStatus,
        waitingReason: newStatus === 'WAITING' ? trimmedReason : null
      })
      
      if (onStatusUpdate) {
        await onStatusUpdate() // Đợi reload xong
      }
      
      setShowReasonModal(false)
      setSelectedDeptId(null)
      setSelectedStatus(null)
      setWaitingReason('')
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái')
    } finally {
      setUpdating(false)
    }
  }

  // Lấy tên phòng ban từ departmentId
  const getDepartmentName = (deptId) => {
    const index = task.departmentIds?.indexOf(deptId)
    return index !== -1 && index < task.departmentNames?.length 
      ? task.departmentNames[index] 
      : `Phòng ban ${deptId}`
  }

  // Nhóm các phòng ban theo trạng thái
  const departmentsByStatus = {}
  task.departmentIds.forEach(deptId => {
    const status = task.departmentStatuses[deptId] || 'PENDING'
    if (!departmentsByStatus[status]) {
      departmentsByStatus[status] = []
    }
    departmentsByStatus[status].push(deptId)
  })

  return (
    <div className="space-y-4">
      {/* Thanh tiến độ chính */}
      <div className="relative pb-24">
        {/* Background thanh tiến độ */}
        <div className="relative h-12 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl overflow-visible shadow-inner border border-gray-200">
          {/* Thanh tiến độ đã hoàn thành với gradient */}
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 transition-all duration-500 ease-out shadow-lg rounded-xl"
            style={{ width: `${getStatusPosition(slowestStatus)}%` }}
          />
          
          {/* Các điểm đánh dấu trạng thái */}
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            const isActive = statusOrder.indexOf(slowestStatus) >= index
            const deptIdsAtStatus = departmentsByStatus[status] || []
            
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

        {/* Khu vực hiển thị phòng ban theo trạng thái */}
        <div className="relative mt-4">
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            const deptIdsAtStatus = departmentsByStatus[status] || []
            
            if (deptIdsAtStatus.length === 0) return null
            
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
                  {deptIdsAtStatus.map((deptId) => {
                    const deptName = getDepartmentName(deptId)
                    const isHovered = hoveredDeptId === deptId
                    const waitingReason = task.departmentWaitingReasons?.[deptId]
                    
                    return (
                      <div
                        key={deptId}
                        className={`relative w-full px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all duration-200 ${
                          isHovered 
                            ? 'scale-105 z-30 shadow-lg' 
                            : 'scale-100'
                        } ${statusBgColors[status]} ${canUpdate ? 'cursor-pointer' : ''}`}
                        onMouseEnter={() => setHoveredDeptId(deptId)}
                        onMouseLeave={() => setHoveredDeptId(null)}
                        onClick={() => canUpdate && handleStatusClick(deptId, status)}
                      >
                        <div className="flex items-center justify-center space-x-1.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[status]}`} />
                          <span className="text-gray-800 font-semibold text-center truncate">
                            {deptName}
                          </span>
                        </div>
                        {isHovered && waitingReason && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800 whitespace-nowrap z-40 shadow-lg">
                            Lý do: {waitingReason}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Nhãn trạng thái phía dưới */}
        <div className="relative mt-20">
          {statusOrder.map((status, index) => {
            const position = (index / (statusOrder.length - 1)) * 100
            const isActive = statusOrder.indexOf(slowestStatus) >= index
            
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
                {departmentsByStatus[status] && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    ({departmentsByStatus[status].length} phòng)
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal chọn trạng thái */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Thay đổi trạng thái - {getDepartmentName(selectedDeptId)}
            </h3>
            
            <div className="space-y-3 mb-4">
              {statusOrder.filter(s => s !== 'PENDING').map((status) => (
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
              ))}
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

export default TaskProgressBar

