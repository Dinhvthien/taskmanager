import { useState } from 'react'
import { ClockIcon, PlusIcon } from '@heroicons/react/24/outline'

const WorkTimeline = ({ 
  selectedTasks = [], 
  adHocTasks = [], 
  onAddAdHocAtTime,
  mode = 'register',
  currentTime = null // Thời gian hiện tại (HH:mm) để highlight
}) => {
  // Tạo mảng các giờ trong ngày (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  // Hàm chuyển đổi thời gian HH:mm sang phút trong ngày
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }
  
  // Hàm chuyển đổi phút sang phần trăm của ngày
  const minutesToPercent = (minutes) => {
    return (minutes / (24 * 60)) * 100
  }
  
  // Hàm tính độ dài của công việc (phần trăm)
  const getTaskDuration = (startTime, endTime) => {
    const start = timeToMinutes(startTime)
    const end = timeToMinutes(endTime)
    if (!start || !end || end <= start) return 0
    return minutesToPercent(end - start)
  }
  
  // Hàm tính vị trí bắt đầu (phần trăm)
  const getTaskPosition = (startTime) => {
    const start = timeToMinutes(startTime)
    if (!start) return 0
    return minutesToPercent(start)
  }
  
  // Lấy thời gian hiện tại nếu không được truyền vào
  const getCurrentTime = () => {
    if (currentTime) return currentTime
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }
  
  // Lấy tất cả các công việc có thời gian
  const getAllTasksWithTime = () => {
    const tasks = []
    
    // Thêm công việc đã chọn
    selectedTasks.forEach((task, index) => {
      if (task.startTime && task.endTime) {
        tasks.push({
          id: `task-${task.taskId}`,
          title: task.task?.title || 'Công việc',
          startTime: task.startTime,
          endTime: task.endTime,
          type: 'task',
          color: 'bg-blue-500',
          borderColor: 'border-blue-600',
          textColor: 'text-blue-700'
        })
      }
    })
    
    // Thêm công việc phát sinh
    adHocTasks.forEach((task, index) => {
      if (task.startTime && task.endTime) {
        // Tìm index thực tế của công việc phát sinh này trong danh sách đã sắp xếp
        const sortedAdHoc = [...adHocTasks].sort((a, b) => {
          const timeA = timeToMinutes(a.startTime || '23:59')
          const timeB = timeToMinutes(b.startTime || '23:59')
          return (timeA || 0) - (timeB || 0)
        })
        const actualIndex = sortedAdHoc.findIndex(t => t.id === task.id)
        const displayIndex = actualIndex >= 0 ? actualIndex + 1 : index + 1
        
        tasks.push({
          id: `adhoc-${task.id}`,
          title: task.content?.trim() || `Công việc phát sinh #${displayIndex}`,
          startTime: task.startTime,
          endTime: task.endTime,
          type: 'adhoc',
          color: 'bg-purple-500',
          borderColor: 'border-purple-600',
          textColor: 'text-purple-700'
        })
      }
    })
    
    return tasks.sort((a, b) => {
      const timeA = timeToMinutes(a.startTime)
      const timeB = timeToMinutes(b.startTime)
      return (timeA || 0) - (timeB || 0)
    })
  }
  
  const tasksWithTime = getAllTasksWithTime()
  const currentTimeStr = getCurrentTime()
  const currentMinutes = timeToMinutes(currentTimeStr)
  const currentPercent = currentMinutes ? minutesToPercent(currentMinutes) : null
  
  // Hàm xử lý click vào timeline để thêm công việc phát sinh
  const handleTimelineClick = (e) => {
    if (mode !== 'register' || !onAddAdHocAtTime) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = (clickX / rect.width) * 100
    
    // Chuyển phần trăm sang giờ:phút
    const minutes = Math.round((percent / 100) * (24 * 60))
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    
    // Tính thời gian kết thúc (mặc định 1 giờ sau)
    const endMinutes = minutes + 60
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const endTimeStr = endHours >= 24 
      ? '23:59' 
      : `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
    
    onAddAdHocAtTime(timeStr, endTimeStr)
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Timeline công việc trong ngày</h3>
        </div>
        {onAddAdHocAtTime && (
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const currentHour = now.getHours()
              const currentMin = now.getMinutes()
              const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
              
              // Tính thời gian kết thúc (1 giờ sau)
              let endHour = currentHour + 1
              let endMin = currentMin
              if (endHour >= 24) {
                endHour = 23
                endMin = 59
              }
              const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
              
              if (onAddAdHocAtTime) {
                onAddAdHocAtTime(startTime, endTime)
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Thêm việc phát sinh tại thời gian hiện tại
          </button>
        )}
      </div>
      
      {tasksWithTime.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">Chưa có công việc nào được đăng ký thời gian</p>
          {onAddAdHocAtTime && (
            <p className="text-sm">Nhấn vào timeline hoặc nút bên trên để thêm công việc phát sinh</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Timeline bar */}
          <div 
            className={`relative h-32 bg-gray-50 rounded-lg border-2 border-gray-300 transition-colors ${
              onAddAdHocAtTime ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'
            }`}
            onClick={handleTimelineClick}
            title={onAddAdHocAtTime ? 'Nhấn để thêm công việc phát sinh tại vị trí này' : 'Timeline đã khóa (báo cáo đã gửi)'}
          >
            {/* Hour markers */}
            <div className="absolute inset-0 flex">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 border-r border-gray-300 relative"
                >
                  <div className="absolute top-0 left-0 text-xs text-gray-500 px-1">
                    {hour}h
                  </div>
                </div>
              ))}
            </div>
            
            {/* Current time indicator */}
            {currentPercent !== null && onAddAdHocAtTime && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                style={{ left: `${currentPercent}%` }}
              >
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                  {currentTimeStr}
                </div>
              </div>
            )}
            
            {/* Task bars */}
            {tasksWithTime.map((task) => {
              const position = getTaskPosition(task.startTime)
              const duration = getTaskDuration(task.startTime, task.endTime)
              
              return (
                <div
                  key={task.id}
                  className={`absolute ${task.color} ${task.borderColor} border rounded px-2 py-1 text-white text-xs font-medium shadow-sm z-10 hover:shadow-md transition-shadow`}
                  style={{
                    left: `${position}%`,
                    width: `${duration}%`,
                    top: '40%',
                    minWidth: '60px'
                  }}
                  title={`${task.title}\n${task.startTime} - ${task.endTime}`}
                >
                  <div className="truncate">{task.title}</div>
                  <div className="text-[10px] opacity-90 mt-0.5">
                    {task.startTime} - {task.endTime}
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Công việc đã chọn</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-gray-600">Công việc phát sinh</span>
            </div>
            {onAddAdHocAtTime && currentPercent !== null && (
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-4 bg-red-500"></div>
                <span className="text-gray-600">Thời gian hiện tại</span>
              </div>
            )}
          </div>
          
          {/* Task list summary */}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Chi tiết thời gian:</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {tasksWithTime.map((task) => {
                const start = timeToMinutes(task.startTime)
                const end = timeToMinutes(task.endTime)
                const duration = end && start ? ((end - start) / 60).toFixed(1) : 0
                
                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-2 rounded text-xs ${
                      task.type === 'task' ? 'bg-blue-50' : 'bg-purple-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${task.color}`}></div>
                      <span className="font-medium text-gray-900">{task.title}</span>
                    </div>
                    <div className="text-gray-600">
                      {task.startTime} - {task.endTime} ({duration}h)
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkTimeline

