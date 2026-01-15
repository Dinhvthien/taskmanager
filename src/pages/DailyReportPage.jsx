import { useState, useEffect } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { taskService } from '../services/taskService'
import dailyReportService from '../services/dailyReportService'
import { getCurrentUser } from '../utils/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import WorkTimeline from '../components/WorkTimeline'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { formatDate, formatTime, formatDateTime, formatTimeString } from '../utils/dateFormat'
import DateInput from '../components/DateInput'
import TimeInput24h from '../components/TimeInput24h'

const DailyReportPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlMode = searchParams.get('mode') || 'register'
  const [mode, setMode] = useState(urlMode) // 'register' hoặc 'report'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({}) // Lưu lỗi validation cho từng trường
  const [allTasks, setAllTasks] = useState([])
  const [selectedTasks, setSelectedTasks] = useState([]) // Array of { taskId, task, priority, comment }
  const [adHocTasks, setAdHocTasks] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [todayReport, setTodayReport] = useState(null) // Báo cáo đang xem/sửa trong ngày (cho mode report)
  const [todayReports, setTodayReports] = useState([]) // Tất cả báo cáo trong ngày hôm nay
  const [selectedReportId, setSelectedReportId] = useState(null) // ID của báo cáo đang chọn để xem/sửa
  
  // Hàm kiểm tra báo cáo đã gửi chưa (dùng chung)
  // Báo cáo chỉ được coi là "đã gửi" khi có comment (comment chỉ được cập nhật khi gọi updateDailyReportComments)
  // selfScore KHÔNG được dùng để xác định "đã gửi" vì nó có thể được nhập trong mode register
  const isReportSent = (report) => {
    if (!report) return false
    
    // Báo cáo được coi là đã gửi CHỈ KHI có comment (comment chỉ được cập nhật qua updateDailyReportComments)
    // selfScore không được dùng vì nó có thể được nhập khi đăng ký lịch làm việc
    
    // Kiểm tra task comments - có ít nhất một task có comment không rỗng
    const hasTaskComment = report.selectedTasks && report.selectedTasks.length > 0 && 
      report.selectedTasks.some(task => task.comment && task.comment.trim() !== '')
    
    // Kiểm tra adHocTask comments - có ít nhất một adHocTask có comment không rỗng
    // KHÔNG kiểm tra selfScore vì selfScore có thể được nhập trong mode register
    const hasAdHocComment = report.adHocTasks && report.adHocTasks.length > 0 && 
      report.adHocTasks.some(ah => ah.comment && ah.comment.trim() !== '')
    
    // Báo cáo chỉ được coi là đã gửi nếu có comment (comment chỉ được cập nhật khi gọi updateDailyReportComments)
    return hasTaskComment || hasAdHocComment
  }

  const today = new Date()
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null)
  const [isCreatingReport, setIsCreatingReport] = useState(false) // Flag để tránh tạo duplicate
  // Lưu trữ snapshot dữ liệu ban đầu để so sánh
  const [initialDataSnapshot, setInitialDataSnapshot] = useState(null)
  // Theo dõi xem người dùng đã tương tác với form chưa (thêm/xóa/sửa)
  const [hasUserInteraction, setHasUserInteraction] = useState(false)
  // Ngày được chọn để đăng ký lịch làm việc (mặc định là hôm nay)
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0])

  // Tối ưu: Gộp tất cả logic load dữ liệu ban đầu vào một useEffect duy nhất
  useEffect(() => {
    let isMounted = true
    
    const initializeData = async () => {
      // Load tasks luôn (cần cho mode register)
      if (isMounted) {
        await loadTasks()
      }
      
      // Load báo cáo dựa trên mode từ URL
      const urlMode = searchParams.get('mode') || 'register'
      if (isMounted && urlMode !== mode) {
        setMode(urlMode)
      }
      
      if (isMounted) {
        if (urlMode === 'register') {
          await loadTodayReportForRegister(false, selectedDate)
        } else if (urlMode === 'report' && !todayReport) {
          // Chỉ load nếu chưa có dữ liệu
          await loadTodayReport()
        }
      }
    }
    
    initializeData()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Chỉ chạy 1 lần khi mount

  // Xử lý thay đổi mode từ URL
  useEffect(() => {
    const urlMode = searchParams.get('mode') || 'register'
    if (urlMode !== mode) {
      setMode(urlMode)
      setError('') // Clear error khi chuyển mode
      
      // Load dữ liệu tương ứng với mode mới
      if (urlMode === 'register') {
        loadTodayReportForRegister(false, selectedDate)
      } else if (urlMode === 'report' && !todayReport) {
        loadTodayReport()
      }
    }
  }, [searchParams]) // Chỉ phụ thuộc vào searchParams


  // TẮT AUTO-SAVE - Không tự động lưu nữa
  // useEffect(() => {
  //   if (mode === 'register' && (selectedTasks.length > 0 || adHocTasks.length > 0)) {
  //     // Clear timeout cũ
  //     if (autoSaveTimeout) {
  //       clearTimeout(autoSaveTimeout)
  //     }
  //     
  //     // Validate công việc phát sinh: nội dung không được để trống
  //     const invalidAdHocTasks = adHocTasks.filter(task => task.content && !task.content.trim())
  //     if (invalidAdHocTasks.length > 0) {
  //       return // Không auto-save nếu có công việc phát sinh chưa nhập nội dung
  //     }
  //     
  //     // Set timeout mới (debounce 2 giây)
  //     const timeout = setTimeout(() => {
  //       autoSaveSchedule()
  //     }, 2000)
  //     
  //     setAutoSaveTimeout(timeout)
  //     
  //     return () => {
  //       if (timeout) {
  //         clearTimeout(timeout)
  //       }
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedTasks, adHocTasks, mode])

  const loadTasks = async () => {
    try {
      // Chỉ set loading nếu chưa có tasks (tránh flicker)
      if (allTasks.length === 0) {
        setLoading(true)
      }
      setError('')
      const user = getCurrentUser()
      if (!user) {
        setError('Không tìm thấy thông tin người dùng')
        return
      }

      const response = await taskService.getMyTasks()
      // API trả về List<TaskResponse>, không phải Page
      const tasksList = response.data?.result || []
      
      // Chỉ load tasks chưa hoàn thành (cần cho mode register)
      const incompleteTasks = Array.isArray(tasksList) 
        ? tasksList.filter(task => task.status !== 'COMPLETED')
        : []
      setAllTasks(incompleteTasks)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading tasks:', err)
      }
      // Không set error nếu đã có tasks (chỉ log)
      if (allTasks.length === 0) {
        setError(err.response?.data?.message || 'Lỗi khi tải danh sách công việc')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTaskToggle = (task) => {
    setHasUserInteraction(true)
    setSelectedTasks(prev => {
      const existingIndex = prev.findIndex(st => st.taskId === task.taskId)
      if (existingIndex >= 0) {
        // Nếu đã có, xóa khỏi danh sách
        return prev.filter(st => st.taskId !== task.taskId)
      } else {
        // Nếu chưa có, thêm vào danh sách với thông tin mặc định
        return [...prev, {
          id: Date.now(),
          taskId: task.taskId,
          task: task,
          priority: 'MEDIUM',
          comment: '',
          startTime: '', // Thời gian bắt đầu (HH:mm)
          endTime: '' // Thời gian kết thúc (HH:mm)
        }]
      }
    })
  }

  const handleSelectedTaskChange = (taskId, field, value) => {
    setHasUserInteraction(true)
    setSelectedTasks(prev => prev.map(st => 
      st.taskId === taskId ? { ...st, [field]: value } : st
    ))
  }

  const handleRemoveSelectedTask = (taskId) => {
    setHasUserInteraction(true)
    setSelectedTasks(prev => prev.filter(st => st.taskId !== taskId))
  }

  const handleAddAdHocTask = () => {
    setHasUserInteraction(true)
    setAdHocTasks(prev => {
      // Tạo id duy nhất để tránh duplicate
      const newId = Date.now() + Math.random()
      // Kiểm tra xem id đã tồn tại chưa (rất hiếm nhưng vẫn kiểm tra)
      const existingIds = new Set(prev.map(t => t.id))
      const finalId = existingIds.has(newId) ? newId + Math.random() : newId
      
      return [...prev, {
        id: finalId,
        content: '',
        priority: 'MEDIUM',
        comment: '',
        selfScore: null,
        startTime: '', // Thời gian bắt đầu (HH:mm)
        endTime: '' // Thời gian kết thúc (HH:mm)
      }]
    })
  }

  const handleRemoveAdHocTask = (id) => {
    setHasUserInteraction(true)
    setAdHocTasks(prev => prev.filter(task => task.id !== id))
  }

  const handleAdHocTaskChange = (id, field, value) => {
    setHasUserInteraction(true)
    setAdHocTasks(prev => prev.map(task => 
      task.id === id ? { ...task, [field]: value } : task
    ))
  }

  // Hàm thêm công việc phát sinh tại thời gian cụ thể
  const handleAddAdHocAtTime = (startTime, endTime) => {
    setHasUserInteraction(true)
    setAdHocTasks(prev => {
      // Kiểm tra xem đã có công việc phát sinh với cùng thời gian và nội dung trống chưa
      const existingEmptyAtTime = prev.find(ah => 
        !ah.content && 
        ah.startTime === startTime && 
        ah.endTime === endTime
      )
      
      // Nếu đã có công việc trống với cùng thời gian, không thêm mới
      if (existingEmptyAtTime) {
        return prev
      }
      
      // Tạo id duy nhất để tránh duplicate
      const newId = Date.now() + Math.random()
      const existingIds = new Set(prev.map(t => t.id))
      const finalId = existingIds.has(newId) ? newId + Math.random() : newId
      
      return [...prev, {
        id: finalId,
        content: '',
        priority: 'MEDIUM',
        comment: '',
        selfScore: null,
        startTime: startTime,
        endTime: endTime
      }]
    })
  }

  // Hàm tạo snapshot dữ liệu để so sánh
  const createDataSnapshot = (tasks, adHocTasks) => {
    return JSON.stringify({
      tasks: tasks.map(t => ({
        taskId: t.taskId,
        startTime: t.startTime || '',
        endTime: t.endTime || ''
      })).sort((a, b) => a.taskId - b.taskId),
      adHocTasks: adHocTasks.map(ah => ({
        id: ah.id,
        content: ah.content || '',
        startTime: ah.startTime || '',
        endTime: ah.endTime || '',
        selfScore: ah.selfScore !== null && ah.selfScore !== undefined ? ah.selfScore : null
      })).sort((a, b) => {
        // Sắp xếp theo id nếu có, nếu không thì theo content
        if (a.id && b.id) return a.id - b.id
        if (a.id) return -1
        if (b.id) return 1
        return (a.content || '').localeCompare(b.content || '')
      })
    })
  }

  // Kiểm tra xem có thay đổi so với dữ liệu ban đầu không
  const hasChanges = () => {
    // Nếu người dùng đã tương tác và có dữ liệu, luôn coi như có thay đổi
    if (hasUserInteraction && (selectedTasks.length > 0 || adHocTasks.length > 0)) {
      return true
    }
    
    if (!initialDataSnapshot) {
      // Nếu chưa có snapshot, có nghĩa là chưa load dữ liệu hoặc đã clear
      // Nếu có dữ liệu thì coi như có thay đổi (cần lưu)
      return selectedTasks.length > 0 || adHocTasks.length > 0
    }
    
    const currentSnapshot = createDataSnapshot(selectedTasks, adHocTasks)
    return currentSnapshot !== initialDataSnapshot
  }

  // Load báo cáo cho mode register (chỉ lấy báo cáo chưa gửi)
  // preserveCurrentData: true = giữ dữ liệu hiện tại nếu đã có, false = luôn load từ server
  const loadTodayReportForRegister = async (preserveCurrentData = false, date = null) => {
    try {
      // Chỉ set loading nếu không preserve (tránh flicker khi save)
      if (!preserveCurrentData) {
        setLoading(true)
      }
      setError('')
      setValidationErrors({}) // Clear validation errors khi load dữ liệu mới
      const targetDate = date || selectedDate
      
      const response = await dailyReportService.getMyDailyReportsByDateRange(targetDate, targetDate)
      const reports = Array.isArray(response.data?.result) ? response.data.result : []
      
      // Lọc các báo cáo chưa gửi (chưa có comment)
      const unsentReports = reports.filter(report => !isReportSent(report))
      
      // CHỈ load báo cáo chưa gửi (không load báo cáo đã gửi)
      let reportToLoad = null
      if (unsentReports.length > 0) {
        // Có báo cáo chưa gửi: lấy báo cáo chưa gửi mới nhất
        reportToLoad = unsentReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      }
      
      if (reportToLoad) {
        setTodayReport(reportToLoad)
        setSelectedReportId(reportToLoad.reportId)
        
        // Luôn load dữ liệu từ server (không preserve khi gọi từ button hoặc useEffect)
        if (!preserveCurrentData) {
          let loadedTasks = []
          let loadedAdHocTasks = []
          
          if (reportToLoad.selectedTasks && reportToLoad.selectedTasks.length > 0) {
            loadedTasks = reportToLoad.selectedTasks.map(st => ({
              id: Date.now() + Math.random(),
              taskId: st.taskId,
              task: { taskId: st.taskId, title: st.title, description: st.description },
              priority: st.priority || 'MEDIUM',
              comment: '', // Reset comment khi load vào mode register (chỉ giữ thời gian và task)
              startTime: st.startTime || '',
              endTime: st.endTime || ''
            }))
            setSelectedTasks(loadedTasks)
          } else {
            setSelectedTasks([])
          }
          
          if (reportToLoad.adHocTasks && reportToLoad.adHocTasks.length > 0) {
            // Loại bỏ duplicate dựa trên id hoặc (content + startTime + endTime)
            const seenIds = new Set()
            const seenContentTime = new Set()
            const uniqueAdHocTasks = reportToLoad.adHocTasks.filter(ah => {
              const id = ah.id != null ? Number(ah.id) : null
              const contentTimeKey = `${ah.content || ''}_${ah.startTime || ''}_${ah.endTime || ''}`
              
              // Nếu có id, kiểm tra duplicate theo id
              if (id != null && !isNaN(id) && id > 0) {
                if (seenIds.has(id)) {
                  return false // Duplicate id
                }
                seenIds.add(id)
                return true
              }
              
              // Nếu không có id, kiểm tra duplicate theo content + time
              if (seenContentTime.has(contentTimeKey)) {
                return false // Duplicate content + time
              }
              seenContentTime.add(contentTimeKey)
              return true
            })
            
            loadedAdHocTasks = uniqueAdHocTasks.map(ah => ({
              // QUAN TRỌNG: Giữ nguyên id từ DB, chỉ tạo id tạm thời nếu thực sự không có id
              // Điều này đảm bảo không bị duplicate khi gửi báo cáo
              id: ah.id != null ? Number(ah.id) : Date.now() + Math.random(),
              content: ah.content,
              priority: ah.priority || 'MEDIUM',
              comment: '', // Reset comment khi load vào mode register (chỉ giữ thời gian và selfScore)
              selfScore: ah.selfScore !== null && ah.selfScore !== undefined ? ah.selfScore : null, // Giữ lại selfScore để có thể chỉnh sửa
              startTime: ah.startTime || '',
              endTime: ah.endTime || ''
            }))
            setAdHocTasks(loadedAdHocTasks)
          } else {
            setAdHocTasks([])
          }
          
          // Lưu snapshot dữ liệu ban đầu sau khi load
          setInitialDataSnapshot(createDataSnapshot(loadedTasks, loadedAdHocTasks))
          setHasUserInteraction(false) // Reset tương tác khi load dữ liệu mới
        }
      } else {
        // Không có báo cáo nào - chỉ reset nếu không preserve dữ liệu hiện tại
        if (!preserveCurrentData) {
          setTodayReport(null)
          setSelectedReportId(null)
          setSelectedTasks([])
          setAdHocTasks([])
          setInitialDataSnapshot(null) // Clear snapshot khi không có báo cáo
          setHasUserInteraction(false) // Reset tương tác khi không có báo cáo
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading today report for register:', err)
      }
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải báo cáo hôm nay')
    } finally {
      if (!preserveCurrentData) {
        setLoading(false)
      }
    }
  }

  // Hàm chuyển đổi thời gian sang phút để so sánh
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [hours, minutes] = timeStr.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return null
    return hours * 60 + minutes
  }

  // Validate tất cả các trường trước khi lưu
  const validateSchedule = () => {
    const errors = {}
    let hasError = false

    // Validate: phải có ít nhất 1 task được chọn hoặc 1 công việc phát sinh
    if (selectedTasks.length === 0 && adHocTasks.length === 0) {
      errors.general = 'Vui lòng chọn ít nhất một công việc hoặc thêm công việc phát sinh trước khi lưu.'
      hasError = true
    }

    // Validate công việc thường
    selectedTasks.forEach((task, index) => {
      const taskKey = `task_${task.taskId}`
      
      // Validate thời gian bắt đầu
      if (!task.startTime || !task.startTime.trim()) {
        errors[`${taskKey}_startTime`] = `Công việc "${task.task.title}": Vui lòng nhập thời gian bắt đầu.`
        hasError = true
      }
      
      // Validate thời gian kết thúc
      if (!task.endTime || !task.endTime.trim()) {
        errors[`${taskKey}_endTime`] = `Công việc "${task.task.title}": Vui lòng nhập thời gian kết thúc.`
        hasError = true
      }
      
      // Validate thời gian bắt đầu phải nhỏ hơn thời gian kết thúc
      if (task.startTime && task.endTime) {
        const startMinutes = timeToMinutes(task.startTime)
        const endMinutes = timeToMinutes(task.endTime)
        if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
          errors[`${taskKey}_timeRange`] = `Công việc "${task.task.title}": Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.`
          hasError = true
        }
      }
    })

    // Validate công việc phát sinh
    adHocTasks.forEach((task, index) => {
      const taskKey = `adHoc_${task.id}`
      
      // Validate nội dung
      if (!task.content || !task.content.trim()) {
        errors[`${taskKey}_content`] = `Công việc phát sinh #${index + 1}: Vui lòng nhập nội dung công việc.`
        hasError = true
      }
      
      // Validate thời gian bắt đầu
      if (!task.startTime || !task.startTime.trim()) {
        errors[`${taskKey}_startTime`] = `Công việc phát sinh #${index + 1}: Vui lòng nhập thời gian bắt đầu.`
        hasError = true
      }
      
      // Validate thời gian kết thúc
      if (!task.endTime || !task.endTime.trim()) {
        errors[`${taskKey}_endTime`] = `Công việc phát sinh #${index + 1}: Vui lòng nhập thời gian kết thúc.`
        hasError = true
      }
      
      // Validate thời gian bắt đầu phải nhỏ hơn thời gian kết thúc
      if (task.startTime && task.endTime) {
        const startMinutes = timeToMinutes(task.startTime)
        const endMinutes = timeToMinutes(task.endTime)
        if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
          errors[`${taskKey}_timeRange`] = `Công việc phát sinh #${index + 1}: Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.`
          hasError = true
        }
      }
      
      // Validate điểm tự chấm (nếu có)
      if (task.selfScore !== null && task.selfScore !== undefined) {
        if (task.selfScore < 0) {
          errors[`${taskKey}_selfScore`] = `Công việc phát sinh #${index + 1}: Điểm tự chấm không được nhỏ hơn 0.`
          hasError = true
        }
      }
    })

    setValidationErrors(errors)
    
    // Tạo thông báo lỗi tổng hợp
    if (hasError) {
      const errorMessages = Object.values(errors)
      setError(errorMessages.join('\n'))
    }
    
    return !hasError
  }

  // Lưu lịch làm việc (thủ công - khi người dùng nhấn nút Lưu)
  const handleSaveSchedule = async () => {
    // Ngăn chặn gọi nhiều lần cùng lúc
    if (isCreatingReport || autoSaving) {
      return
    }

    // Clear lỗi cũ
    setError('')
    setValidationErrors({})

    // Validate tất cả các trường
    if (!validateSchedule()) {
      return
    }

    try {
      setIsCreatingReport(true)
      setAutoSaving(true)
      setError('')
      
      const reportData = {
        date: selectedDate,
        selectedTaskIds: selectedTasks.map(st => st.taskId),
        selectedTasksWithDetails: selectedTasks.map(st => ({
          taskId: st.taskId,
          priority: 'MEDIUM',
          comment: '',
          startTime: st.startTime ? (st.startTime.includes(':') ? st.startTime : `${st.startTime}:00`) : null,
          endTime: st.endTime ? (st.endTime.includes(':') ? st.endTime : `${st.endTime}:00`) : null
        })),
        adHocTasks: adHocTasks.map(task => ({
          content: task.content.trim(),
          priority: 'MEDIUM',
          comment: '',
          selfScore: task.selfScore || null,
          startTime: task.startTime ? (task.startTime.includes(':') ? task.startTime : `${String(task.startTime).padStart(2, '0')}:00`) : null,
          endTime: task.endTime ? (task.endTime.includes(':') ? task.endTime : `${String(task.endTime).padStart(2, '0')}:00`) : null
        }))
      }
      
      // Nếu đã có báo cáo chưa gửi, xóa nó và tạo mới để đảm bảo chỉ có 1 báo cáo
      if (todayReport && !isReportSent(todayReport)) {
        try {
          await dailyReportService.deleteDailyReport(todayReport.reportId)
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error deleting old report:', err)
          }
        }
      }
      
      // Tạo báo cáo mới
      await dailyReportService.createDailyReport(reportData)
      
      // Load lại để có reportId mới (preserve dữ liệu hiện tại)
      await loadTodayReportForRegister(true)
      
      // Cập nhật snapshot sau khi lưu thành công
      setInitialDataSnapshot(createDataSnapshot(selectedTasks, adHocTasks))
      setHasUserInteraction(false) // Reset tương tác sau khi lưu thành công
      
      // Clear validation errors sau khi lưu thành công
      setValidationErrors({})
      
      setLastSaved(new Date())
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu lịch làm việc')
    } finally {
      setAutoSaving(false)
      setIsCreatingReport(false)
    }
  }

  // Load báo cáo cho ngày được chọn (mode report chỉ dùng hôm nay)
  // Chỉ load khi thực sự cần (không tự động khi chuyển tab)
  const loadTodayReport = async (forceReload = false, preserveCurrentData = false) => {
    try {
      // Chỉ set loading nếu force reload hoặc chưa có dữ liệu
      if (forceReload || !todayReport) {
        setLoading(true)
      }
      setError('')
      // Mode report luôn dùng ngày hôm nay
      const today = new Date().toISOString().split('T')[0]
      
      // Thêm timestamp để tránh cache
      const response = await dailyReportService.getMyDailyReportsByDateRange(today, today)
      const reports = Array.isArray(response.data?.result) ? response.data.result : []
      
      // Sắp xếp báo cáo theo thời gian tạo (mới nhất trước)
      const sortedReports = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setTodayReports(sortedReports)
      
      // Lọc các báo cáo chưa gửi (chưa có comment hoặc selfScore)
      const unsentReports = sortedReports.filter(report => !isReportSent(report))
      
      // Load báo cáo: ưu tiên báo cáo chưa gửi, nhưng vẫn có thể load báo cáo đã gửi nếu được chọn
      if (sortedReports.length > 0) {
        let reportToLoad
        
        // Nếu có selectedReportId, tìm báo cáo đó trong tất cả báo cáo
        if (selectedReportId) {
          reportToLoad = sortedReports.find(r => r.reportId === selectedReportId)
          if (!reportToLoad) {
            // Nếu không tìm thấy báo cáo được chọn, load báo cáo mới nhất chưa gửi
            reportToLoad = unsentReports.length > 0 ? unsentReports[0] : sortedReports[0]
            setSelectedReportId(reportToLoad.reportId)
          }
        } else {
          // Chưa chọn báo cáo nào - ưu tiên load báo cáo mới nhất chưa gửi
          reportToLoad = unsentReports.length > 0 ? unsentReports[0] : sortedReports[0]
          setSelectedReportId(reportToLoad.reportId)
        }
        
        // Load dữ liệu vào form (kể cả báo cáo đã gửi để xem)
        setTodayReport(reportToLoad)
        
        // Chỉ load dữ liệu nếu không preserve hoặc chưa có dữ liệu
        if (!preserveCurrentData || selectedTasks.length === 0) {
          if (reportToLoad.selectedTasks) {
            setSelectedTasks(reportToLoad.selectedTasks.map(st => ({
              id: Date.now() + Math.random(),
              taskId: st.taskId,
              task: { taskId: st.taskId, title: st.title, description: st.description },
              priority: st.priority || 'MEDIUM',
              comment: st.comment || '',
              startTime: st.startTime || '',
              endTime: st.endTime || ''
            })))
          } else {
            setSelectedTasks([])
          }
        }
        
        if (!preserveCurrentData || adHocTasks.length === 0) {
          if (reportToLoad.adHocTasks) {
            // Loại bỏ duplicate dựa trên id hoặc (content + startTime + endTime)
            const seenIds = new Set()
            const seenContentTime = new Set()
            const uniqueAdHocTasks = reportToLoad.adHocTasks.filter(ah => {
              const id = ah.id != null ? Number(ah.id) : null
              const contentTimeKey = `${ah.content || ''}_${ah.startTime || ''}_${ah.endTime || ''}`
              
              // Nếu có id, kiểm tra duplicate theo id
              if (id != null && !isNaN(id) && id > 0) {
                if (seenIds.has(id)) {
                  return false // Duplicate id
                }
                seenIds.add(id)
                return true
              }
              
              // Nếu không có id, kiểm tra duplicate theo content + time
              if (seenContentTime.has(contentTimeKey)) {
                return false // Duplicate content + time
              }
              seenContentTime.add(contentTimeKey)
              return true
            })
            
            setAdHocTasks(uniqueAdHocTasks.map(ah => ({
              // QUAN TRỌNG: Giữ nguyên id từ DB, chỉ tạo id tạm thời nếu thực sự không có id
              // Điều này đảm bảo không bị duplicate khi gửi báo cáo
              id: ah.id != null ? Number(ah.id) : Date.now() + Math.random(),
              content: ah.content,
              priority: ah.priority || 'MEDIUM',
              comment: ah.comment || '',
              selfScore: ah.selfScore,
              startTime: ah.startTime || '',
              endTime: ah.endTime || ''
            })))
          } else {
            setAdHocTasks([])
          }
        }
      } else {
        // Không có báo cáo nào - chỉ reset nếu không preserve
        if (!preserveCurrentData) {
          setTodayReport(null)
          setSelectedReportId(null)
          setSelectedTasks([])
          setAdHocTasks([])
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải báo cáo hôm nay')
    } finally {
      setLoading(false)
    }
  }

  // Cập nhật comment cho báo cáo cuối ngày
  const handleUpdateComments = async (e) => {
    e.preventDefault()
    
    if (!todayReport) {
      setError('Chưa có báo cáo đăng ký trong ngày. Vui lòng đăng ký lịch làm việc trước.')
      return
    }
    
    // Kiểm tra nếu có nhiều báo cáo chưa gửi thì phải chọn báo cáo trước khi gửi
    const unsentReports = todayReports.filter(report => !isReportSent(report))
    
    if (unsentReports.length > 1 && !selectedReportId) {
      setError('Vui lòng chọn báo cáo để gửi.')
      return
    }
    
    // Đảm bảo báo cáo đang chọn là báo cáo chưa gửi
    if (todayReport && isReportSent(todayReport)) {
      setError('Báo cáo này đã được gửi rồi. Vui lòng chọn báo cáo khác.')
      return
    }
    
    // Kiểm tra: báo cáo phải có ít nhất một công việc (thường hoặc phát sinh)
    if (!selectedTasks || selectedTasks.length === 0) {
      if (!adHocTasks || adHocTasks.length === 0) {
        setError('Báo cáo phải có ít nhất một công việc để gửi.')
        return
      }
    }

    try {
      setLoading(true)
      setError('')
      
      // Lọc taskComments - CHỈ gửi những task có trong báo cáo gốc (todayReport)
      // Backend sẽ throw error nếu taskId không tồn tại trong báo cáo
      const validTaskIds = todayReport?.selectedTasks?.map(st => st.taskId) || []
      const taskComments = selectedTasks
        .filter(st => {
          // Đảm bảo taskId tồn tại, là số hợp lệ, VÀ có trong báo cáo gốc
          const taskId = Number(st.taskId)
          return st.taskId != null && !isNaN(taskId) && taskId > 0 && validTaskIds.includes(taskId)
        })
        .map(st => {
          // Chuyển đổi taskId sang số để đảm bảo đúng kiểu Long
          const taskId = Number(st.taskId)
          return {
            taskId: taskId,
            comment: st.comment ? st.comment.trim() : ''
          }
        })
      
      // Lọc adHocTaskComments - CHỈ gửi những công việc phát sinh đã tồn tại trong DB (có id số)
      // VÀ phải có trong báo cáo gốc (todayReport)
      const validAdHocTaskIds = todayReport?.adHocTasks?.map(ah => Number(ah.id)).filter(id => id != null && !isNaN(id) && id > 0) || []
      const adHocTaskComments = adHocTasks
        .filter(ah => {
          // Đảm bảo id tồn tại, là số hợp lệ, VÀ có trong báo cáo gốc
          if (!ah.id) return false
          const id = Number(ah.id)
          if (isNaN(id) || id <= 0) return false
          return validAdHocTaskIds.includes(id)
        })
        .map(ah => {
          // Chuyển đổi id sang số để đảm bảo đúng kiểu Long
          const adHocTaskId = Number(ah.id)
          return {
            adHocTaskId: adHocTaskId,
            comment: ah.comment ? ah.comment.trim() : '',
            selfScore: ah.selfScore !== null && ah.selfScore !== undefined ? Number(ah.selfScore) : null
          }
        })
      
      // Xử lý công việc phát sinh mới (không có trong báo cáo gốc)
      // Những công việc này sẽ được thêm vào newAdHocTasks
      // QUAN TRỌNG: Chỉ lấy những công việc KHÔNG có trong adHocTaskComments để tránh duplicate
      const adHocTaskCommentIds = new Set(adHocTaskComments.map(ah => ah.adHocTaskId))
      const newAdHocTasks = adHocTasks
        .filter(ah => {
          // Công việc phát sinh mới: không có id hoặc id không hợp lệ hoặc không có trong báo cáo gốc
          if (!ah.id) return true // Không có id = mới
          const id = Number(ah.id)
          if (isNaN(id) || id <= 0) return true // Id không hợp lệ = mới
          // Nếu id không có trong validAdHocTaskIds, đây là công việc mới được thêm sau khi load báo cáo
          return !validAdHocTaskIds.includes(id) && !adHocTaskCommentIds.has(id)
        })
        .map(ah => ({
          content: ah.content ? ah.content.trim() : '',
          priority: ah.priority || 'MEDIUM',
          comment: ah.comment ? ah.comment.trim() : '',
          selfScore: ah.selfScore !== null && ah.selfScore !== undefined ? Number(ah.selfScore) : null,
          startTime: ah.startTime ? (ah.startTime.includes(':') ? ah.startTime : `${String(ah.startTime).padStart(2, '0')}:00`) : null,
          endTime: ah.endTime ? (ah.endTime.includes(':') ? ah.endTime : `${String(ah.endTime).padStart(2, '0')}:00`) : null
        }))
        .filter(ah => ah.content && ah.content.trim() !== '') // Chỉ lấy những công việc có nội dung
      
      // Debug: Log để kiểm tra (chỉ trong development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Valid task IDs from report:', validTaskIds)
        console.log('Valid adHoc task IDs from report:', validAdHocTaskIds)
        console.log('Filtered taskComments:', taskComments)
        console.log('Filtered adHocTaskComments:', adHocTaskComments)
        console.log('New adHoc tasks:', newAdHocTasks)
      }
      
      // Validate: BẮT BUỘC nhập comment cho TẤT CẢ công việc
      const validationErrors = {}
      let hasError = false
      
      // Kiểm tra có ít nhất một công việc để gửi
      const hasTasksToSend = (taskComments.length > 0) || (adHocTaskComments.length > 0) || (newAdHocTasks.length > 0)
      if (!hasTasksToSend) {
        validationErrors.general = 'Vui lòng có ít nhất một công việc để gửi báo cáo.'
        hasError = true
      }
      
      // Validate comment cho TẤT CẢ công việc thường (kiểm tra trực tiếp từ selectedTasks)
      selectedTasks.forEach(st => {
        const taskId = Number(st.taskId)
        // Chỉ validate những task có trong báo cáo gốc
        if (st.taskId != null && !isNaN(taskId) && taskId > 0 && validTaskIds.includes(taskId)) {
          if (!st.comment || st.comment.trim() === '') {
            const taskKey = `task_${taskId}`
            validationErrors[`${taskKey}_comment`] = `Công việc "${st.task.title}": Vui lòng nhập báo cáo kết quả.`
            hasError = true
          }
        }
      })
      
      // Validate comment cho TẤT CẢ công việc phát sinh (kiểm tra trực tiếp từ adHocTasks)
      adHocTasks.forEach(aht => {
        if (!aht.id) {
          // Công việc phát sinh mới (không có id) - phải có comment
          if (!aht.comment || aht.comment.trim() === '') {
            const taskKey = `adHoc_new_${aht.content?.substring(0, 20) || 'unknown'}`
            validationErrors[`${taskKey}_comment`] = `Công việc phát sinh "${aht.content || 'Chưa có nội dung'}": Vui lòng nhập báo cáo kết quả.`
            hasError = true
          }
        } else {
          const id = Number(aht.id)
          if (!isNaN(id) && id > 0) {
            // Công việc phát sinh đã có id
            if (validAdHocTaskIds.includes(id)) {
              // Công việc có trong báo cáo gốc - phải có comment
              if (!aht.comment || aht.comment.trim() === '') {
                const taskKey = `adHoc_${id}`
                validationErrors[`${taskKey}_comment`] = `Công việc phát sinh "${aht.content || 'Chưa có nội dung'}": Vui lòng nhập báo cáo kết quả.`
                hasError = true
              }
            } else {
              // Công việc mới được thêm sau khi load báo cáo - phải có comment
              if (!aht.comment || aht.comment.trim() === '') {
                const taskKey = `adHoc_new_${id}`
                validationErrors[`${taskKey}_comment`] = `Công việc phát sinh "${aht.content || 'Chưa có nội dung'}": Vui lòng nhập báo cáo kết quả.`
                hasError = true
              }
            }
          } else {
            // Id không hợp lệ - coi như công việc mới
            if (!aht.comment || aht.comment.trim() === '') {
              const taskKey = `adHoc_invalid_${aht.content?.substring(0, 20) || 'unknown'}`
              validationErrors[`${taskKey}_comment`] = `Công việc phát sinh "${aht.content || 'Chưa có nội dung'}": Vui lòng nhập báo cáo kết quả.`
              hasError = true
            }
          }
        }
      })
      
      if (hasError) {
        setValidationErrors(validationErrors)
        const errorMessages = Object.values(validationErrors)
        setError(errorMessages.join('\n'))
        setLoading(false)
        return
      }
      
      // Clear validation errors nếu không có lỗi
      setValidationErrors({})
      
      // Chuẩn bị dữ liệu gửi - cho phép gửi cả khi không có công việc phát sinh
      const updateData = {
        taskComments: taskComments.length > 0 ? taskComments : null,
        adHocTaskComments: adHocTaskComments.length > 0 ? adHocTaskComments : null,
        // Cho phép thêm công việc phát sinh mới nếu có
        newAdHocTasks: newAdHocTasks.length > 0 ? newAdHocTasks : []
      }
      
      // Debug: Log dữ liệu trước khi gửi (chỉ trong development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Sending update data:', JSON.stringify(updateData, null, 2))
        console.log('Report ID:', todayReport.reportId)
      }
      
      await dailyReportService.updateDailyReportComments(todayReport.reportId, updateData)
      
      setSubmitted(true)
      
      // Dọn sạch dữ liệu ở cả 2 trang (đăng ký và gửi báo cáo) sau khi gửi thành công
      setSelectedReportId(null)
      setSelectedTasks([])
      setAdHocTasks([])
      setTodayReport(null)
      setLastSaved(null) // Clear thông báo đã lưu
      setInitialDataSnapshot(null) // Clear snapshot khi gửi báo cáo thành công
      
      // Load lại báo cáo hôm nay để có dữ liệu mới nhất (force reload)
      // Báo cáo vừa gửi sẽ tự động bị loại khỏi danh sách chưa gửi
      if (mode === 'report') {
        await loadTodayReport(true)
      } else {
        // Nếu đang ở mode register, load lại để clear form
        await loadTodayReportForRegister()
      }
      
      setTimeout(() => {
        setSubmitted(false)
      }, 3000)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating daily report comments:', err)
        console.error('Error response:', err.response)
      }
      
      // Hiển thị thông báo lỗi chi tiết từ backend
      let errorMessage = 'Lỗi khi gửi báo cáo'
      if (err.response?.data) {
        if (err.response.data.message) {
          errorMessage = err.response.data.message
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Hàm này không còn cần thiết vì đã có auto-save
  // Nhưng vẫn giữ lại để tương thích với form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    // Không làm gì vì đã có auto-save
  }


  const getStatusLabel = (status) => {
    const statusMap = {
      'PENDING': 'Chờ xử lý',
      'ACCEPTED': 'Đã chấp nhận',
      'IN_PROGRESS': 'Đang thực hiện',
      'WAITING': 'Đang chờ',
      'COMPLETED': 'Hoàn thành',
      'REJECTED': 'Từ chối'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status) => {
    const colorMap = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'ACCEPTED': 'bg-blue-100 text-blue-800',
      'IN_PROGRESS': 'bg-green-100 text-green-800',
      'WAITING': 'bg-orange-100 text-orange-800',
      'COMPLETED': 'bg-gray-100 text-gray-800',
      'REJECTED': 'bg-red-100 text-red-800'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityLabel = (priority) => {
    const priorityMap = {
      'HIGH': 'Cao',
      'MEDIUM': 'Trung bình',
      'LOW': 'Thấp'
    }
    return priorityMap[priority] || priority
  }

  const getPriorityColor = (priority) => {
    const colorMap = {
      'HIGH': 'bg-red-100 text-red-800 border-red-300',
      'MEDIUM': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'LOW': 'bg-green-100 text-green-800 border-green-300'
    }
    return colorMap[priority] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getDirectorRatingLabel = (rating) => {
    const ratingMap = {
      EXCELLENT: 'Xuất sắc',
      GOOD: 'Tốt',
      AVERAGE: 'Trung bình',
      POOR: 'Kém'
    }
    return ratingMap[rating] || rating
  }

  const getDirectorRatingColor = (rating) => {
    const colorMap = {
      EXCELLENT: 'bg-green-100 text-green-800 border-green-300',
      GOOD: 'bg-blue-100 text-blue-800 border-blue-300',
      AVERAGE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      POOR: 'bg-red-100 text-red-800 border-red-300'
    }
    return colorMap[rating] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  if (loading && allTasks.length === 0) {
    return <LoadingSpinner />
  }


  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div>
        {/* Form gửi báo cáo */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'register' ? 'Đăng ký lịch làm việc' : 'Báo cáo cuối ngày'}
            </h1>
          </div>

          <div className="p-6">
          
          {/* Không hiển thị dropdown chọn báo cáo nữa vì chỉ có 1 báo cáo duy nhất */}
          
            {/* Chọn ngày đăng ký - chỉ hiển thị ở mode register */}
            {mode === 'register' && (
              <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm">
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Chọn ngày đăng ký lịch làm việc
                </label>
                <div className="flex items-center gap-3">
                  <DateInput
                    value={selectedDate}
                    min={today.toISOString().split('T')[0]} // Chỉ cho phép chọn từ hôm nay trở đi
                    onChange={async (newDate) => {
                      setSelectedDate(newDate)
                      setError('')
                      // Load lại dữ liệu cho ngày mới
                      await loadTodayReportForRegister(false, newDate)
                    }}
                    className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm transition-all"
                  />
                </div>
              </div>
            )}
            
            {/* Chỉ hiển thị form khi có báo cáo hoặc ở mode register */}
            {mode === 'report' && !todayReport && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium text-gray-600">Không còn báo cáo nào cần gửi trong ngày hôm nay.</p>
                <p className="text-sm text-gray-500 mt-2">Vui lòng đăng ký lịch làm việc trước khi báo cáo.</p>
              </div>
            )}

            {error && (
              <div className="mb-6">
                <ErrorMessage message={error} />
              </div>
            )}

            {submitted && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Báo cáo đã được gửi thành công!</p>
                    <p className="text-sm text-green-700 mt-1">Bạn có thể xem lại báo cáo trong lịch sử bên cạnh.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Thông báo khi lưu thành công ở mode register */}
            {mode === 'register' && lastSaved && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Đã lưu lịch làm việc</p>
                    <p className="text-sm text-green-700">Lúc {formatTime(lastSaved)}</p>
                  </div>
                </div>
              </div>
            )}

          {(mode === 'register' || (mode === 'report' && todayReport)) && (
            <form onSubmit={mode === 'register' ? handleSubmit : handleUpdateComments} className="space-y-6">
            {/* Timeline hiển thị thời gian làm việc - TRUNG TÂM CỦA BÁO CÁO */}
            <div className="mb-6">
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">Timeline công việc</h2>
                </div>
                <WorkTimeline
                  selectedTasks={selectedTasks}
                  adHocTasks={adHocTasks}
                  onAddAdHocAtTime={mode === 'register' ? handleAddAdHocAtTime : null}
                  mode={mode}
                />
              </div>
            </div>
          
            {/* Danh sách công việc có sẵn - chỉ hiển thị ở mode register */}
            {mode === 'register' && (
              <div className="mb-6">
                <label className="block text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Công việc chưa hoàn thành ({allTasks.length} công việc)
                </label>
            <div className="border-2 border-gray-200 rounded-xl p-5 max-h-96 overflow-y-auto bg-gray-50 shadow-sm">
              {allTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Không có công việc nào</p>
              ) : (
                <div className="space-y-3">
                  {allTasks.map((task) => {
                    const isSelected = selectedTasks.some(st => st.taskId === task.taskId)
                    return (
                      <div 
                        key={task.taskId} 
                        className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-400 shadow-md transform scale-[1.02]' 
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                        onClick={() => handleTaskToggle(task)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTaskToggle(task)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 ml-3">
                          <h3 className="font-medium text-gray-900">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                            {task.progress !== null && (
                              <span className="text-xs text-gray-500">
                                Tiến độ: {task.progress}%
                              </span>
                            )}
                            {task.endDate && (
                              <span className="text-xs text-gray-500">
                                Hạn: {formatDate(task.endDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {selectedTasks.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                Đã chọn: <span className="font-medium">{selectedTasks.length}</span> công việc
              </p>
            )}
          </div>
          )}

          {/* Công việc đã chọn - CHỈ HIỂN THỊ CÁC CÔNG VIỆC CÓ THỜI GIAN TRONG TIMELINE */}
          {(() => {
            // Ở mode report, chỉ hiển thị công việc có thời gian trong timeline
            const tasksToShow = mode === 'report' 
              ? selectedTasks.filter(task => task.startTime && task.endTime)
              : selectedTasks
            
            return tasksToShow.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {mode === 'register' 
                  ? `Công việc đã chọn (${tasksToShow.length} công việc) - Sắp xếp theo thời gian`
                  : `Báo cáo về công việc đã đăng ký trong timeline (${tasksToShow.length} công việc)`
                }
              </label>
              <div className="space-y-4">
                {/* Sắp xếp các công việc theo thời gian bắt đầu (timeline) */}
                {[...tasksToShow].sort((a, b) => {
                  // Sắp xếp theo thời gian bắt đầu
                  const timeA = a.startTime || '23:59'
                  const timeB = b.startTime || '23:59'
                  return timeA.localeCompare(timeB)
                }).map((selectedTask, index) => (
                  <div key={selectedTask.id} className="border-2 border-blue-200 rounded-xl p-5 bg-gradient-to-r from-blue-50 to-indigo-50 relative pl-8 shadow-sm hover:shadow-md transition-shadow">
                    {/* Timeline indicator */}
                    {selectedTask.startTime && (
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-l-xl"></div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          {(selectedTask.startTime || selectedTask.endTime) && mode === 'register' && (
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {selectedTask.startTime || '--'} - {selectedTask.endTime || '--'}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900">{selectedTask.task.title}</h4>
                        {selectedTask.task.description && (
                          <p className="text-sm text-gray-600 mt-1">{selectedTask.task.description}</p>
                        )}
                      </div>
                      {/* Cho phép xóa ở mode register hoặc mode report (nếu báo cáo chưa gửi) */}
                      {(mode === 'register' || (mode === 'report' && todayReport && !isReportSent(todayReport))) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedTask(selectedTask.taskId)}
                          className="text-red-600 hover:text-red-700 p-1 ml-2"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Thời gian làm việc - chỉ hiển thị ở mode register */}
                      {mode === 'register' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian bắt đầu <span className="text-red-500">*</span>
                            </label>
                            <TimeInput24h
                              value={selectedTask.startTime || ''}
                              onChange={(value) => {
                                handleSelectedTaskChange(selectedTask.taskId, 'startTime', value)
                                // Clear lỗi khi người dùng nhập
                                const taskKey = `task_${selectedTask.taskId}`
                                if (validationErrors[`${taskKey}_startTime`] || validationErrors[`${taskKey}_timeRange`]) {
                                  const newErrors = { ...validationErrors }
                                  delete newErrors[`${taskKey}_startTime`]
                                  delete newErrors[`${taskKey}_timeRange`]
                                  setValidationErrors(newErrors)
                                  if (Object.keys(newErrors).length === 0) {
                                    setError('')
                                  }
                                }
                              }}
                              className="w-full"
                            />
                            {validationErrors[`task_${selectedTask.taskId}_startTime`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`task_${selectedTask.taskId}_startTime`]}</p>
                            )}
                            {validationErrors[`task_${selectedTask.taskId}_timeRange`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`task_${selectedTask.taskId}_timeRange`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian kết thúc <span className="text-red-500">*</span>
                            </label>
                            <TimeInput24h
                              value={selectedTask.endTime || ''}
                              onChange={(value) => {
                                handleSelectedTaskChange(selectedTask.taskId, 'endTime', value)
                                // Clear lỗi khi người dùng nhập
                                const taskKey = `task_${selectedTask.taskId}`
                                if (validationErrors[`${taskKey}_endTime`] || validationErrors[`${taskKey}_timeRange`]) {
                                  const newErrors = { ...validationErrors }
                                  delete newErrors[`${taskKey}_endTime`]
                                  delete newErrors[`${taskKey}_timeRange`]
                                  setValidationErrors(newErrors)
                                  if (Object.keys(newErrors).length === 0) {
                                    setError('')
                                  }
                                }
                              }}
                              className="w-full"
                            />
                            {validationErrors[`task_${selectedTask.taskId}_endTime`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`task_${selectedTask.taskId}_endTime`]}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Hiển thị thời gian ở mode report */}
                      {mode === 'report' && (selectedTask.startTime || selectedTask.endTime) && (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <span className="text-sm text-gray-700">
                            <strong>Thời gian:</strong> {
                              selectedTask.startTime 
                                ? formatTimeString(selectedTask.startTime)
                                : '--'
                            } - {
                              selectedTask.endTime 
                                ? formatTimeString(selectedTask.endTime)
                                : '--'
                            }
                          </span>
                        </div>
                      )}
                      
                      {/* Báo cáo kết quả - chỉ hiển thị ở mode report */}
                      {mode === 'report' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Báo cáo kết quả <span className="text-red-500">*</span>
                          </label>
                            <textarea
                            value={selectedTask.comment || ''}
                            onChange={(e) => {
                              handleSelectedTaskChange(selectedTask.taskId, 'comment', e.target.value)
                              // Clear lỗi validation khi người dùng nhập
                              const taskKey = `task_${selectedTask.taskId}`
                              if (validationErrors[`${taskKey}_comment`]) {
                                const newErrors = { ...validationErrors }
                                delete newErrors[`${taskKey}_comment`]
                                setValidationErrors(newErrors)
                                if (Object.keys(newErrors).length === 0) {
                                  setError('')
                                }
                              }
                            }}
                            placeholder="Nhập báo cáo kết quả về công việc này (bắt buộc)..."
                            rows={3}
                            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm transition-all resize-none ${
                              validationErrors[`task_${selectedTask.taskId}_comment`] 
                                ? 'border-red-500' 
                                : 'border-gray-300'
                            }`}
                          />
                          {validationErrors[`task_${selectedTask.taskId}_comment`] && (
                            <p className="text-xs text-red-600 mt-1">{validationErrors[`task_${selectedTask.taskId}_comment`]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          {/* Công việc phát sinh - CHỈ HIỂN THỊ CÁC CÔNG VIỆC CÓ THỜI GIAN TRONG TIMELINE */}
          {(() => {
            // Ở mode report, chỉ hiển thị công việc phát sinh có thời gian trong timeline
            const adHocToShow = mode === 'report' 
              ? adHocTasks.filter(task => task.startTime && task.endTime)
              : adHocTasks
            
            return (
            <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                {mode === 'register' 
                  ? 'Công việc phát sinh'
                  : 'Công việc phát sinh đã đăng ký trong timeline'
                }
              </label>
              {/* Chỉ cho phép thêm ở mode register */}
              {mode === 'register' && (
                <button
                  type="button"
                  onClick={handleAddAdHocTask}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <PlusIcon className="h-5 w-5" />
                  Thêm công việc
                </button>
              )}
            </div>

            {adHocToShow.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-gray-50">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p className="text-gray-600 font-medium">
                  {mode === 'register' 
                    ? 'Chưa có công việc phát sinh nào. Nhấn "Thêm công việc" hoặc click vào timeline để thêm mới'
                    : 'Chưa có công việc phát sinh nào được đăng ký trong timeline'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sắp xếp các công việc phát sinh theo thời gian bắt đầu (timeline) */}
                {[...adHocToShow].sort((a, b) => {
                  // Sắp xếp theo thời gian bắt đầu
                  const timeA = a.startTime || '23:59'
                  const timeB = b.startTime || '23:59'
                  return timeA.localeCompare(timeB)
                }).map((adHocTask, index) => (
                  <div key={adHocTask.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-slate-50 relative pl-8 shadow-sm hover:shadow-md transition-shadow">
                    {/* Timeline indicator */}
                    {adHocTask.startTime && (
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-gray-400 to-gray-600 rounded-l-xl"></div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            Phát sinh #{index + 1}
                          </span>
                          {(adHocTask.startTime || adHocTask.endTime) && mode === 'register' && (
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {adHocTask.startTime || '--'} - {adHocTask.endTime || '--'}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900">Công việc phát sinh #{index + 1}</h4>
                      </div>
                      {/* Cho phép xóa ở mode register hoặc mode report (nếu báo cáo chưa gửi) */}
                      {(mode === 'register' || (mode === 'report' && todayReport && !isReportSent(todayReport))) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAdHocTask(adHocTask.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Thời gian làm việc - chỉ hiển thị ở mode register */}
                      {mode === 'register' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian bắt đầu <span className="text-red-500">*</span>
                            </label>
                            <TimeInput24h
                              value={adHocTask.startTime || ''}
                              onChange={(value) => {
                                handleAdHocTaskChange(adHocTask.id, 'startTime', value)
                                // Clear lỗi khi người dùng nhập
                                const taskKey = `adHoc_${adHocTask.id}`
                                if (validationErrors[`${taskKey}_startTime`] || validationErrors[`${taskKey}_timeRange`]) {
                                  const newErrors = { ...validationErrors }
                                  delete newErrors[`${taskKey}_startTime`]
                                  delete newErrors[`${taskKey}_timeRange`]
                                  setValidationErrors(newErrors)
                                  if (Object.keys(newErrors).length === 0) {
                                    setError('')
                                  }
                                }
                              }}
                              className="w-full"
                            />
                            {validationErrors[`adHoc_${adHocTask.id}_startTime`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_startTime`]}</p>
                            )}
                            {validationErrors[`adHoc_${adHocTask.id}_timeRange`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_timeRange`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian kết thúc <span className="text-red-500">*</span>
                            </label>
                            <TimeInput24h
                              value={adHocTask.endTime || ''}
                              onChange={(value) => {
                                handleAdHocTaskChange(adHocTask.id, 'endTime', value)
                                // Clear lỗi khi người dùng nhập
                                const taskKey = `adHoc_${adHocTask.id}`
                                if (validationErrors[`${taskKey}_endTime`] || validationErrors[`${taskKey}_timeRange`]) {
                                  const newErrors = { ...validationErrors }
                                  delete newErrors[`${taskKey}_endTime`]
                                  delete newErrors[`${taskKey}_timeRange`]
                                  setValidationErrors(newErrors)
                                  if (Object.keys(newErrors).length === 0) {
                                    setError('')
                                  }
                                }
                              }}
                              className="w-full"
                            />
                            {validationErrors[`adHoc_${adHocTask.id}_endTime`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_endTime`]}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Hiển thị thời gian ở mode report */}
                      {mode === 'report' && (adHocTask.startTime || adHocTask.endTime) && (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <span className="text-sm text-gray-700">
                            <strong>Thời gian:</strong> {
                              adHocTask.startTime 
                                ? formatTimeString(adHocTask.startTime)
                                : '--'
                            } - {
                              adHocTask.endTime 
                                ? formatTimeString(adHocTask.endTime)
                                : '--'
                            }
                          </span>
                        </div>
                      )}
                      
                      {/* Nội dung công việc */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nội dung công việc {mode === 'register' && <span className="text-red-500">*</span>}
                        </label>
                        {mode === 'register' ? (
                          <>
                            <input
                              type="text"
                              value={adHocTask.content}
                              onChange={(e) => {
                                handleAdHocTaskChange(adHocTask.id, 'content', e.target.value)
                                // Clear lỗi khi người dùng nhập
                                const taskKey = `adHoc_${adHocTask.id}`
                                if (validationErrors[`${taskKey}_content`]) {
                                  const newErrors = { ...validationErrors }
                                  delete newErrors[`${taskKey}_content`]
                                  setValidationErrors(newErrors)
                                  if (Object.keys(newErrors).length === 0) {
                                    setError('')
                                  }
                                }
                              }}
                              placeholder="Nhập nội dung công việc phát sinh..."
                              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm transition-all ${
                                validationErrors[`adHoc_${adHocTask.id}_content`] 
                                  ? 'border-red-500' 
                                  : 'border-gray-300'
                              }`}
                              required
                            />
                            {validationErrors[`adHoc_${adHocTask.id}_content`] && (
                              <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_content`]}</p>
                            )}
                          </>
                        ) : (
                          <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                            {adHocTask.content}
                          </div>
                        )}
                      </div>

                      {/* Báo cáo kết quả - chỉ hiển thị ở mode report */}
                      {mode === 'report' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Báo cáo kết quả <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={adHocTask.comment || ''}
                            onChange={(e) => {
                              handleAdHocTaskChange(adHocTask.id, 'comment', e.target.value)
                              // Clear lỗi validation khi người dùng nhập
                              const taskKey = `adHoc_${adHocTask.id}`
                              if (validationErrors[`${taskKey}_comment`]) {
                                const newErrors = { ...validationErrors }
                                delete newErrors[`${taskKey}_comment`]
                                setValidationErrors(newErrors)
                                if (Object.keys(newErrors).length === 0) {
                                  setError('')
                                }
                              }
                            }}
                            placeholder="Nhập báo cáo kết quả về công việc này (bắt buộc)..."
                            rows={3}
                            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm transition-all resize-none ${
                              validationErrors[`adHoc_${adHocTask.id}_comment`] 
                                ? 'border-red-500' 
                                : 'border-gray-300'
                            }`}
                          />
                          {validationErrors[`adHoc_${adHocTask.id}_comment`] && (
                            <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_comment`]}</p>
                          )}
                        </div>
                      )}

                      {/* Điểm tự chấm */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Thời gian định mức {mode === 'report' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={adHocTask.selfScore || ''}
                          onChange={(e) => {
                            handleAdHocTaskChange(adHocTask.id, 'selfScore', e.target.value ? parseFloat(e.target.value) : null)
                            // Clear lỗi khi người dùng nhập
                            const taskKey = `adHoc_${adHocTask.id}`
                            if (validationErrors[`${taskKey}_selfScore`]) {
                              const newErrors = { ...validationErrors }
                              delete newErrors[`${taskKey}_selfScore`]
                              setValidationErrors(newErrors)
                              if (Object.keys(newErrors).length === 0) {
                                setError('')
                              }
                            }
                          }}
                          placeholder="Ví dụ: 2.5 (tương đương 2.5 giờ = 2.5 điểm)"
                          className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm transition-all ${
                            validationErrors[`adHoc_${adHocTask.id}_selfScore`] 
                              ? 'border-red-500' 
                              : 'border-gray-300'
                          }`}
                          required={mode === 'report'}
                        />
                        {validationErrors[`adHoc_${adHocTask.id}_selfScore`] && (
                          <p className="text-xs text-red-600 mt-1">{validationErrors[`adHoc_${adHocTask.id}_selfScore`]}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Điểm tính bằng giờ (ví dụ: 2.5 giờ = 2.5 điểm)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            )
          })()}

            {/* Nút Lưu - chỉ hiển thị ở mode register và khi có thay đổi */}
            {mode === 'register' && hasChanges() && (
              <div className="flex justify-end pt-6 mt-6 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={isCreatingReport || autoSaving || (selectedTasks.length === 0 && adHocTasks.length === 0)}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                >
                  {autoSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Lưu lịch làm việc</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Nút gửi - chỉ hiển thị ở mode report */}
            {mode === 'report' && (
              <>
                {todayReport && isReportSent(todayReport) ? (
                  <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl text-center mt-6 shadow-sm">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-semibold text-blue-800">Báo cáo này đã được gửi rồi.</p>
                    </div>
                    <p className="text-sm text-blue-700">Bạn có thể xem lại thông tin báo cáo ở trên.</p>
                  </div>
                ) : (
                  <div className="flex justify-end pt-6 mt-6 border-t-2 border-gray-200">
                    <button
                      type="submit"
                      disabled={loading || !todayReport || isReportSent(todayReport)}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>Gửi báo cáo</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </form>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailyReportPage
