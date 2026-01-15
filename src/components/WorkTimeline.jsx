import { useEffect, useMemo, useState } from 'react'
import { ClockIcon, PlusIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'

const WorkTimeline = ({ 
  selectedTasks = [], 
  adHocTasks = [], 
  onAddAdHocAtTime,
  mode = 'register',
  currentTime = null // Thời gian hiện tại (HH:mm) để highlight
}) => {
  // Zoom theo khoảng giờ (GIỮ DUY NHẤT 1 CƠ CHẾ ZOOM để tránh lệch cảm nhận)
  const [zoomStartHour, setZoomStartHour] = useState(0) // Giờ bắt đầu (0-23)
  const [zoomEndHour, setZoomEndHour] = useState(23) // Giờ kết thúc (0-23) -> end boundary là (zoomEndHour + 1)
  const [isZoomed, setIsZoomed] = useState(false)

  // Reset về full day mỗi lần mount để tránh state cũ ảnh hưởng hiển thị
  useEffect(() => {
    setIsZoomed(false)
    setZoomStartHour(0)
    setZoomEndHour(23)
  }, [])
  
  // Tạo mảng các giờ trong ngày (0-23)
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

  // Chuẩn hoá thời gian đầu vào: hỗ trợ "HH:mm" và "HH:mm:ss" -> trả về "HH:mm"
  const normalizeTimeToHHmm = (timeStr) => {
    if (!timeStr) return null
    const parts = String(timeStr).trim().split(':')
    if (parts.length < 2) return null
    const parsedHours = Number(parts[0])
    const parsedMinutes = Number(parts[1])
    if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) return null
    if (parsedHours < 0 || parsedHours > 23) return null
    if (parsedMinutes < 0 || parsedMinutes > 59) return null
    const hh = String(parsedHours).padStart(2, '0')
    const mm = String(parsedMinutes).padStart(2, '0')
    return `${hh}:${mm}`
  }
  
  // Hàm chuyển đổi thời gian HH:mm sang phút trong ngày
  const timeToMinutes = (timeStr) => {
    const normalized = normalizeTimeToHHmm(timeStr)
    if (!normalized) return null
    const [hh, mm] = normalized.split(':')
    return Number(hh) * 60 + Number(mm)
  }
  
  // Hàm chuyển đổi phút (phút trong ngày) sang phần trăm của trục timeline (có tính zoom theo khoảng)
  const minutesToPercent = (minutes) => {
    if (isZoomed) {
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

  // Tính layout thanh task theo cùng hệ quy chiếu với minutesToPercent
  // - Chuẩn hoá time đầu vào
  // - Khi zoom: CLIP vào vùng zoom, duration% dựa trên zoomDuration (không dùng minutesToPercent(end-start))
  const getTaskBarLayout = (startTimeRaw, endTimeRaw) => {
    const startMinutes = timeToMinutes(startTimeRaw)
    const endMinutes = timeToMinutes(endTimeRaw)
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null

    if (isZoomed) {
      const zoomStartMinutes = zoomStartHour * 60
      const zoomEndMinutes = (zoomEndHour + 1) * 60
      const zoomDuration = zoomEndMinutes - zoomStartMinutes
      if (zoomDuration <= 0) return null

      // Clip để hiển thị đúng trong khoảng zoom
      const visibleStart = Math.max(startMinutes, zoomStartMinutes)
      const visibleEnd = Math.min(endMinutes, zoomEndMinutes)
      if (visibleEnd <= visibleStart) return null

      const leftPercent = minutesToPercent(visibleStart)
      const widthPercent = ((visibleEnd - visibleStart) / zoomDuration) * 100
      const durationHours = (visibleEnd - visibleStart) / 60

      return {
        leftPercent,
        widthPercent,
        durationHours,
        normalizedStart: normalizeTimeToHHmm(startTimeRaw),
        normalizedEnd: normalizeTimeToHHmm(endTimeRaw),
      }
    }

    const leftPercent = (startMinutes / (24 * 60)) * 100
    const widthPercent = ((endMinutes - startMinutes) / (24 * 60)) * 100
    const durationHours = (endMinutes - startMinutes) / 60
    return {
      leftPercent,
      widthPercent,
      durationHours,
      normalizedStart: normalizeTimeToHHmm(startTimeRaw),
      normalizedEnd: normalizeTimeToHHmm(endTimeRaw),
    }
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
    selectedTasks.forEach((task) => {
      const startTime = normalizeTimeToHHmm(task.startTime)
      const endTime = normalizeTimeToHHmm(task.endTime)
      if (startTime && endTime) {
        tasks.push({
          id: `task-${task.taskId}`,
          title: task.task?.title || 'Công việc',
          startTime,
          endTime,
          type: 'task',
          color: 'bg-blue-500',
          borderColor: 'border-blue-600',
          textColor: 'text-blue-700'
        })
      }
    })
    
    // Thêm công việc phát sinh
    adHocTasks.forEach((task, index) => {
      const startTime = normalizeTimeToHHmm(task.startTime)
      const endTime = normalizeTimeToHHmm(task.endTime)
      if (startTime && endTime) {
        // Tìm index thực tế của công việc phát sinh này trong danh sách đã sắp xếp
        const sortedAdHoc = [...adHocTasks].sort((a, b) => {
          const timeA = timeToMinutes(a.startTime || '23:59')
          const timeB = timeToMinutes(b.startTime || '23:59')
          return (timeA ?? 0) - (timeB ?? 0)
        })
        const actualIndex = sortedAdHoc.findIndex(t => t.id === task.id)
        const displayIndex = actualIndex >= 0 ? actualIndex + 1 : index + 1
        
        tasks.push({
          id: `adhoc-${task.id}`,
          title: task.content?.trim() || `Công việc phát sinh #${displayIndex}`,
          startTime,
          endTime,
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
      return (timeA ?? 0) - (timeB ?? 0)
    })
  }
  
  const tasksWithTime = getAllTasksWithTime()
  const currentTimeStr = getCurrentTime()
  const currentMinutes = timeToMinutes(currentTimeStr)
  const currentPercent = currentMinutes !== null ? minutesToPercent(currentMinutes) : null

  // Xếp task vào các "hàng" để tránh bị đè lên nhau khi trùng thời gian
  // Greedy: task theo thứ tự startTime, đặt vào lane đầu tiên có endTime <= startTime
  const computeTaskLanes = (tasks) => {
    const tasksWithMinutes = tasks
      .map((task) => ({
        ...task,
        startMinutes: timeToMinutes(task.startTime),
        endMinutes: timeToMinutes(task.endTime),
      }))
      .filter((task) => task.startMinutes !== null && task.endMinutes !== null && task.endMinutes > task.startMinutes)
      .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0))

    /** @type {number[]} */
    const laneEndMinutes = []

    return tasksWithMinutes.map((task) => {
      let assignedLaneIndex = -1
      for (let laneIndex = 0; laneIndex < laneEndMinutes.length; laneIndex++) {
        if (laneEndMinutes[laneIndex] <= task.startMinutes) {
          assignedLaneIndex = laneIndex
          laneEndMinutes[laneIndex] = task.endMinutes
          break
        }
      }
      if (assignedLaneIndex === -1) {
        assignedLaneIndex = laneEndMinutes.length
        laneEndMinutes.push(task.endMinutes)
      }
      return {
        ...task,
        laneIndex: assignedLaneIndex,
      }
    })
  }

  const tasksWithLanes = useMemo(() => computeTaskLanes(tasksWithTime), [tasksWithTime])
  const laneCount = useMemo(() => {
    if (tasksWithLanes.length === 0) return 0
    return Math.max(...tasksWithLanes.map((t) => t.laneIndex ?? 0)) + 1
  }, [tasksWithLanes])
  
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
  
  // Reset về full day
  const handleResetZoom = () => {
    setIsZoomed(false)
    setZoomStartHour(0)
    setZoomEndHour(23)
  }
  
  // Hàm zoom vào khoảng thời gian cụ thể
  const handleZoomToRange = (startHour, endHour) => {
    setZoomStartHour(startHour)
    setZoomEndHour(endHour)
    setIsZoomed(true)
  }
  
  // Lấy danh sách mốc giờ hiển thị, theo segment và có mốc biên
  const getDisplayHourMarkers = () => {
    if (isZoomed) {
      const segmentCount = zoomEndHour - zoomStartHour + 1
      return Array.from({ length: segmentCount + 1 }, (_, i) => zoomStartHour + i) // +1: mốc biên (endHour+1)
    }
    return [...hours, 24] // full day có mốc 24h
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
          {/* Range controls */}
          {isZoomed && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Hiển thị cả ngày"
            >
              <ArrowsPointingOutIcon className="h-4 w-4" />
            </button>
          )}
          
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
              // 24px cho header mốc giờ + mỗi lane 38px + padding dưới
              height: `${Math.max(128, 24 + laneCount * 38 + 16)}px`,
              minHeight: '150px'
            }}
            onClick={handleTimelineClick}
            title={onAddAdHocAtTime ? 'Nhấn để thêm công việc phát sinh tại vị trí này' : 'Timeline đã khóa (báo cáo đã gửi)'}
          >
            <div 
              className="absolute inset-0"
              style={{
                width: '150%',
              }}
            >
              {/* Hour markers */}
              <div className="absolute inset-0 flex">
                {getDisplayHourMarkers().map((hour) => {
                  const segmentCount = isZoomed ? (zoomEndHour - zoomStartHour + 1) : 24
                  const hourPercent = isZoomed
                    ? ((hour - zoomStartHour) / segmentCount) * 100
                    : (hour / 24) * 100
                  
                  return (
                    <div
                      key={hour}
                      className="absolute border-r border-gray-300 relative"
                      style={{ left: `${hourPercent}%` }}
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
                if (currentMinutes === null) return null
                
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
              {tasksWithLanes.map((task) => {
                const layout = getTaskBarLayout(task.startTime, task.endTime)
                if (!layout) return null
                
                // Tính toán xem có đủ không gian để hiển thị nhiều dòng không
                const durationInHours = layout.durationHours
                const canShowFullTitle = durationInHours >= 1.5 // Nếu >= 1.5 giờ thì hiển thị đầy đủ
                const canShowTwoLines = durationInHours >= 2.5 // Nếu >= 2.5 giờ thì có thể hiển thị 2 dòng
                const topOffsetPx = 24 + (task.laneIndex ?? 0) * 38
                
                return (
                  <div
                    key={task.id}
                    className={`absolute ${task.color} ${task.borderColor} border rounded px-2 py-1.5 text-white text-xs font-medium shadow-sm z-10 hover:shadow-lg hover:z-20 transition-all group`}
                    style={{
                      left: `${layout.leftPercent}%`,
                      width: `${layout.widthPercent}%`,
                      top: `${topOffsetPx}px`,
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
                const duration = (start !== null && end !== null) ? ((end - start) / 60).toFixed(1) : 0
                
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

