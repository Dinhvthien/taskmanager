import { useState } from 'react'
import { ClockIcon, PlusIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'

const WorkTimeline = ({ 
  selectedTasks = [], 
  adHocTasks = [], 
  onAddAdHocAtTime,
  mode = 'register',
  currentTime = null // Thời gian hiện tại (HH:mm) để highlight
}) => {
  // State cho zoom
  const [zoomLevel, setZoomLevel] = useState(1.0) // 1.0 = bình thường, có thể từ 0.5 đến 3.0
  const [zoomStartHour, setZoomStartHour] = useState(0) // Giờ bắt đầu zoom (0-23)
  const [zoomEndHour, setZoomEndHour] = useState(23) // Giờ kết thúc zoom (0-23)
  const [isZoomed, setIsZoomed] = useState(false) // Đang zoom vào một khoảng thời gian cụ thể
  
  // Tạo mảng các giờ trong ngày (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  // Hàm chuyển đổi thời gian HH:mm sang phút trong ngày
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }
  
  // Hàm chuyển đổi phút sang phần trăm của ngày (có tính zoom)
  const minutesToPercent = (minutes) => {
    if (isZoomed) {
      // Tính phần trăm trong khoảng zoom
      const zoomStartMinutes = zoomStartHour * 60
      const zoomEndMinutes = (zoomEndHour + 1) * 60
      const zoomDuration = zoomEndMinutes - zoomStartMinutes
      
      if (minutes < zoomStartMinutes) return 0
      if (minutes > zoomEndMinutes) return 100
      
      return ((minutes - zoomStartMinutes) / zoomDuration) * 100
    }
    // Không zoom: tính theo toàn bộ ngày
    return (minutes / (24 * 60)) * 100
  }
  
  // Hàm tính scale dựa trên zoom level
  const getTimelineScale = () => {
    return zoomLevel
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
    
    // Chuyển phần trăm sang giờ:phút (có tính zoom)
    let minutes
    if (isZoomed) {
      const zoomStartMinutes = zoomStartHour * 60
      const zoomEndMinutes = (zoomEndHour + 1) * 60
      const zoomDuration = zoomEndMinutes - zoomStartMinutes
      minutes = Math.round(zoomStartMinutes + (percent / 100) * zoomDuration)
    } else {
      minutes = Math.round((percent / 100) * (24 * 60))
    }
    
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
  
  // Hàm zoom in
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3.0))
  }
  
  // Hàm zoom out
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5))
  }
  
  // Hàm reset zoom
  const handleResetZoom = () => {
    setZoomLevel(1.0)
    setIsZoomed(false)
    setZoomStartHour(0)
    setZoomEndHour(23)
  }
  
  // Hàm zoom vào khoảng thời gian cụ thể
  const handleZoomToRange = (startHour, endHour) => {
    setZoomStartHour(startHour)
    setZoomEndHour(endHour)
    setIsZoomed(true)
    setZoomLevel(1.0)
  }
  
  // Hàm xử lý wheel event để zoom
  const handleWheel = (e) => {
    // Zoom khi giữ Ctrl (Windows/Linux) hoặc Cmd (Mac), hoặc chỉ cần hover vào timeline
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      
      // Tính delta dựa trên độ lớn của scroll
      const scrollAmount = Math.abs(e.deltaY)
      const baseDelta = scrollAmount > 50 ? 0.15 : 0.1 // Zoom nhanh hơn nếu scroll nhiều
      const delta = e.deltaY > 0 ? -baseDelta : baseDelta // Scroll down = zoom out, scroll up = zoom in
      
      setZoomLevel(prev => {
        const newLevel = Math.max(0.5, Math.min(3.0, prev + delta))
        return Math.round(newLevel * 10) / 10 // Làm tròn đến 1 chữ số thập phân
      })
    }
  }
  
  // Lấy danh sách giờ hiển thị (có tính zoom)
  const getDisplayHours = () => {
    if (isZoomed) {
      return Array.from({ length: zoomEndHour - zoomStartHour + 1 }, (_, i) => zoomStartHour + i)
    }
    return hours
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Timeline công việc trong ngày</h3>
          {isZoomed && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {zoomStartHour}h - {zoomEndHour + 1}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Thu nhỏ (Ctrl/Cmd + lăn chuột xuống)"
            >
              <MagnifyingGlassMinusIcon className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-600 px-2 min-w-[3rem] text-center" title="Giữ Ctrl/Cmd + lăn chuột để zoom">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.0}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Phóng to (Ctrl/Cmd + lăn chuột lên)"
            >
              <MagnifyingGlassPlusIcon className="h-4 w-4" />
            </button>
            {(isZoomed || zoomLevel !== 1.0) && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="Reset zoom"
              >
                <ArrowsPointingOutIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Quick zoom buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleZoomToRange(8, 17)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Zoom vào giờ làm việc (8h-18h)"
            >
              8-18h
            </button>
            <button
              type="button"
              onClick={() => handleZoomToRange(0, 11)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Zoom vào buổi sáng (0h-12h)"
            >
              Sáng
            </button>
            <button
              type="button"
              onClick={() => handleZoomToRange(12, 23)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Zoom vào buổi chiều/tối (12h-24h)"
            >
              Chiều
            </button>
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
              Thêm việc phát sinh
            </button>
          )}
        </div>
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
            className={`relative bg-gray-50 rounded-lg border-2 border-gray-300 transition-all overflow-x-auto ${
              onAddAdHocAtTime ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'
            }`}
            style={{ 
              height: `${32 * getTimelineScale()}px`,
              minHeight: '128px'
            }}
            onClick={handleTimelineClick}
            onWheel={handleWheel}
            title={onAddAdHocAtTime ? 'Nhấn để thêm công việc phát sinh tại vị trí này. Giữ Ctrl/Cmd + lăn chuột để zoom' : 'Timeline đã khóa (báo cáo đã gửi). Giữ Ctrl/Cmd + lăn chuột để zoom'}
          >
            <div 
              className="absolute inset-0"
              style={{
                transform: `scaleX(${getTimelineScale()})`,
                transformOrigin: 'left center',
                width: isZoomed ? `${100 / getTimelineScale()}%` : '100%'
              }}
            >
              {/* Hour markers */}
              <div className="absolute inset-0 flex">
                {getDisplayHours().map((hour) => {
                  const hourPercent = isZoomed 
                    ? ((hour - zoomStartHour) / (zoomEndHour - zoomStartHour + 1)) * 100
                    : (hour / 24) * 100
                  
                  return (
                    <div
                      key={hour}
                      className="absolute border-r border-gray-300 relative"
                      style={{ left: `${hourPercent}%`, width: isZoomed ? `${100 / (zoomEndHour - zoomStartHour + 1)}%` : '4.166%' }}
                    >
                      <div className="absolute top-0 left-0 text-xs text-gray-500 px-1 whitespace-nowrap">
                        {hour}h
                      </div>
                    </div>
                  )
                })}
              </div>
            
              {/* Current time indicator */}
              {currentPercent !== null && onAddAdHocAtTime && (() => {
                const currentMinutes = timeToMinutes(currentTimeStr)
                if (!currentMinutes) return null
                
                // Kiểm tra xem thời gian hiện tại có nằm trong khoảng zoom không
                if (isZoomed) {
                  const zoomStartMinutes = zoomStartHour * 60
                  const zoomEndMinutes = (zoomEndHour + 1) * 60
                  if (currentMinutes < zoomStartMinutes || currentMinutes > zoomEndMinutes) {
                    return null // Không hiển thị nếu nằm ngoài khoảng zoom
                  }
                }
                
                return (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: `${currentPercent}%` }}
                  >
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                      {currentTimeStr}
                    </div>
                  </div>
                )
              })()}
              
              {/* Task bars */}
              {tasksWithTime.map((task) => {
                const taskStartMinutes = timeToMinutes(task.startTime)
                const taskEndMinutes = timeToMinutes(task.endTime)
                
                // Kiểm tra xem task có nằm trong khoảng zoom không
                if (isZoomed && taskStartMinutes !== null && taskEndMinutes !== null) {
                  const zoomStartMinutes = zoomStartHour * 60
                  const zoomEndMinutes = (zoomEndHour + 1) * 60
                  if (taskEndMinutes < zoomStartMinutes || taskStartMinutes > zoomEndMinutes) {
                    return null // Không hiển thị task nằm ngoài khoảng zoom
                  }
                }
                
                const position = getTaskPosition(task.startTime)
                const duration = getTaskDuration(task.startTime, task.endTime)
                
                // Tính toán xem có đủ không gian để hiển thị nhiều dòng không
                const durationInHours = duration / (100 / 24) // Chuyển từ % sang giờ
                const canShowFullTitle = durationInHours >= 1.5 // Nếu >= 1.5 giờ thì hiển thị đầy đủ
                const canShowTwoLines = durationInHours >= 2.5 // Nếu >= 2.5 giờ thì có thể hiển thị 2 dòng
                
                return (
                  <div
                    key={task.id}
                    className={`absolute ${task.color} ${task.borderColor} border rounded px-2 py-1.5 text-white text-xs font-medium shadow-sm z-10 hover:shadow-lg hover:z-20 transition-all group`}
                    style={{
                      left: `${position}%`,
                      width: `${duration}%`,
                      top: '35%',
                      minWidth: '80px',
                      maxWidth: '100%'
                    }}
                    title={`${task.title}\n${task.startTime} - ${task.endTime}${task.type === 'task' ? '\n(Công việc đã chọn)' : '\n(Công việc phát sinh)'}`}
                  >
                    {/* Hiển thị tiêu đề */}
                    {canShowFullTitle ? (
                      <div className={`${canShowTwoLines ? 'line-clamp-2' : 'line-clamp-1'} break-words leading-tight`}>
                        {task.title}
                      </div>
                    ) : (
                      <div className="truncate" title={task.title}>
                        {task.title}
                      </div>
                    )}
                    
                    {/* Hiển thị thời gian */}
                    <div className="text-[10px] opacity-90 mt-1 flex items-center justify-between">
                      <span className="whitespace-nowrap">{task.startTime} - {task.endTime}</span>
                      {durationInHours >= 0.5 && (
                        <span className="ml-1 opacity-75">
                          ({durationInHours.toFixed(1)}h)
                        </span>
                      )}
                    </div>
                    
                    {/* Tooltip chi tiết khi hover (chỉ hiện khi tiêu đề bị cắt) */}
                    {!canShowFullTitle && (
                      <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        <div className="font-semibold mb-1">{task.title}</div>
                        <div className="text-gray-300">
                          <div>Thời gian: {task.startTime} - {task.endTime}</div>
                          <div>Loại: {task.type === 'task' ? 'Công việc đã chọn' : 'Công việc phát sinh'}</div>
                          <div>Thời lượng: {durationInHours.toFixed(1)} giờ</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {tasksWithTime.map((task) => {
                const start = timeToMinutes(task.startTime)
                const end = timeToMinutes(task.endTime)
                const duration = end && start ? ((end - start) / 60).toFixed(1) : 0
                
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg text-sm border ${
                      task.type === 'task' 
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                        : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                    } transition-colors`}
                  >
                    <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 ${task.color}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1 break-words">
                        {task.title}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          {task.startTime} - {task.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Thời lượng:</span>
                          {duration}h
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          task.type === 'task' 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-purple-200 text-purple-800'
                        }`}>
                          {task.type === 'task' ? 'Công việc đã chọn' : 'Công việc phát sinh'}
                        </span>
                      </div>
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

