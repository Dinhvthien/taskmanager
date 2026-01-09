import { useState, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { taskService } from '../services/taskService'
import dailyReportService from '../services/dailyReportService'
import { getCurrentUser } from '../utils/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import WorkTimeline from '../components/WorkTimeline'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const DailyReportPage = () => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlMode = searchParams.get('mode') || 'register'
  const [mode, setMode] = useState(urlMode) // 'register' hoặc 'report'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  // Lịch sử báo cáo (dùng chung cho nhân viên và manager)
  const today = new Date()
  const [historyMonth, setHistoryMonth] = useState(today.getMonth()) // 0-11
  const [historyYear, setHistoryYear] = useState(today.getFullYear())
  const [historyLoading, setHistoryLoading] = useState(false)
  const [myReports, setMyReports] = useState([])
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(today.toISOString().split('T')[0])
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null)
  const [selectedHistoryReports, setSelectedHistoryReports] = useState([]) // Tất cả báo cáo của ngày được chọn
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null)
  // Lưu trữ snapshot dữ liệu ban đầu để so sánh
  const [initialDataSnapshot, setInitialDataSnapshot] = useState(null)

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
          await loadTodayReportForRegister()
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
        loadTodayReportForRegister()
      } else if (urlMode === 'report' && !todayReport) {
        loadTodayReport()
      }
    }
  }, [searchParams]) // Chỉ phụ thuộc vào searchParams

  // Nếu điều hướng từ thông báo với ngày cụ thể, focus vào ngày đó
  useEffect(() => {
    const focusDate = location.state?.focusReportDate
    if (focusDate) {
      const d = new Date(focusDate)
      if (!isNaN(d.getTime())) {
        setHistoryYear(d.getFullYear())
        setHistoryMonth(d.getMonth())
        setSelectedHistoryDate(focusDate)
      }
    }
  }, [location.state])

  // Load lịch sử báo cáo theo tháng
  useEffect(() => {
    loadHistoryForMonth(historyYear, historyMonth)
  }, [historyYear, historyMonth])

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
    setSelectedTasks(prev => prev.map(st => 
      st.taskId === taskId ? { ...st, [field]: value } : st
    ))
  }

  const handleRemoveSelectedTask = (taskId) => {
    setSelectedTasks(prev => prev.filter(st => st.taskId !== taskId))
  }

  const handleAddAdHocTask = () => {
    setAdHocTasks(prev => [...prev, {
      id: Date.now(),
      content: '',
      priority: 'MEDIUM',
      comment: '',
      selfScore: null,
      startTime: '', // Thời gian bắt đầu (HH:mm)
      endTime: '' // Thời gian kết thúc (HH:mm)
    }])
  }

  const handleRemoveAdHocTask = (id) => {
    setAdHocTasks(prev => prev.filter(task => task.id !== id))
  }

  const handleAdHocTaskChange = (id, field, value) => {
    setAdHocTasks(prev => prev.map(task => 
      task.id === id ? { ...task, [field]: value } : task
    ))
  }

  // Hàm thêm công việc phát sinh tại thời gian cụ thể
  const handleAddAdHocAtTime = (startTime, endTime) => {
    setAdHocTasks(prev => [...prev, {
      id: Date.now(),
      content: '',
      priority: 'MEDIUM',
      comment: '',
      selfScore: null,
      startTime: startTime,
      endTime: endTime
    }])
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
    if (!initialDataSnapshot) {
      // Nếu chưa có snapshot, có nghĩa là chưa load dữ liệu hoặc đã clear
      // Nếu có dữ liệu thì coi như có thay đổi (cần lưu)
      return selectedTasks.length > 0 || adHocTasks.length > 0
    }
    
    const currentSnapshot = createDataSnapshot(selectedTasks, adHocTasks)
    return currentSnapshot !== initialDataSnapshot
  }

  // Load báo cáo hôm nay cho mode register (chỉ lấy báo cáo chưa gửi)
  // preserveCurrentData: true = giữ dữ liệu hiện tại nếu đã có, false = luôn load từ server
  const loadTodayReportForRegister = async (preserveCurrentData = false) => {
    try {
      // Chỉ set loading nếu không preserve (tránh flicker khi save)
      if (!preserveCurrentData) {
        setLoading(true)
      }
      setError('')
      const today = new Date().toISOString().split('T')[0]
      
      const response = await dailyReportService.getMyDailyReportsByDateRange(today, today)
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
            loadedAdHocTasks = reportToLoad.adHocTasks.map(ah => ({
              id: ah.id || Date.now() + Math.random(),
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
        }
      } else {
        // Không có báo cáo nào - chỉ reset nếu không preserve dữ liệu hiện tại
        if (!preserveCurrentData) {
          setTodayReport(null)
          setSelectedReportId(null)
          setSelectedTasks([])
          setAdHocTasks([])
          setInitialDataSnapshot(null) // Clear snapshot khi không có báo cáo
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

  // Lưu lịch làm việc (thủ công - khi người dùng nhấn nút Lưu)
  const handleSaveSchedule = async () => {
    // Validate: phải có ít nhất 1 task được chọn hoặc 1 công việc phát sinh
    if (selectedTasks.length === 0 && adHocTasks.length === 0) {
      setError('Vui lòng chọn ít nhất một công việc hoặc thêm công việc phát sinh trước khi lưu.')
      return
    }

    // Validate công việc phát sinh: nội dung không được để trống
    const invalidAdHocTasks = adHocTasks.filter(task => !task.content.trim())
    if (invalidAdHocTasks.length > 0) {
      setError('Vui lòng nhập nội dung cho tất cả công việc phát sinh trước khi lưu.')
      return
    }

    try {
      setAutoSaving(true)
      setError('')
      
      const today = new Date().toISOString().split('T')[0]
      
      const reportData = {
        date: today,
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
      
      setLastSaved(new Date())
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu lịch làm việc')
    } finally {
      setAutoSaving(false)
    }
  }

  // Load báo cáo hôm nay
  // Chỉ load khi thực sự cần (không tự động khi chuyển tab)
  const loadTodayReport = async (forceReload = false, preserveCurrentData = false) => {
    try {
      // Chỉ set loading nếu force reload hoặc chưa có dữ liệu
      if (forceReload || !todayReport) {
        setLoading(true)
      }
      setError('')
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
            setAdHocTasks(reportToLoad.adHocTasks.map(ah => ({
              id: ah.id || Date.now() + Math.random(),
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
      const validAdHocTaskIds = todayReport?.adHocTasks?.map(ah => ah.id).filter(id => id != null) || []
      const adHocTaskComments = adHocTasks
        .filter(ah => {
          // Đảm bảo id tồn tại, là số hợp lệ, VÀ có trong báo cáo gốc
          const id = Number(ah.id)
          return ah.id != null && !isNaN(id) && id > 0 && validAdHocTaskIds.includes(id)
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
      const newAdHocTasks = adHocTasks
        .filter(ah => {
          // Công việc phát sinh mới: không có id hoặc id không có trong báo cáo gốc
          if (!ah.id) return true // Không có id = mới
          const id = Number(ah.id)
          return isNaN(id) || id <= 0 || !validAdHocTaskIds.includes(id)
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
      const tasksWithoutComment = taskComments.filter(tc => !tc.comment || tc.comment.trim() === '')
      const adHocTasksWithoutComment = adHocTaskComments.filter(ah => {
        const hasComment = ah.comment && ah.comment.trim() !== ''
        const hasScore = ah.selfScore !== null && ah.selfScore !== undefined
        return !hasComment && !hasScore
      })
      
      // Validate công việc phát sinh mới: cũng phải có comment hoặc selfScore
      const newAdHocTasksWithoutComment = newAdHocTasks.filter(ah => {
        const hasComment = ah.comment && ah.comment.trim() !== ''
        const hasScore = ah.selfScore !== null && ah.selfScore !== undefined
        return !hasComment && !hasScore
      })
      
      if (tasksWithoutComment.length > 0 || adHocTasksWithoutComment.length > 0 || newAdHocTasksWithoutComment.length > 0) {
        let errorMsg = 'Vui lòng nhập báo cáo kết quả cho tất cả công việc trước khi gửi:'
        if (tasksWithoutComment.length > 0) {
          errorMsg += `\n- ${tasksWithoutComment.length} công việc đã chọn chưa có báo cáo kết quả`
        }
        if (adHocTasksWithoutComment.length > 0) {
          errorMsg += `\n- ${adHocTasksWithoutComment.length} công việc phát sinh chưa có báo cáo kết quả hoặc điểm tự chấm`
        }
        if (newAdHocTasksWithoutComment.length > 0) {
          errorMsg += `\n- ${newAdHocTasksWithoutComment.length} công việc phát sinh mới chưa có báo cáo kết quả hoặc điểm tự chấm`
        }
        setError(errorMsg)
        setLoading(false)
        return
      }
      
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

  const loadHistoryForMonth = async (year, monthIndex) => {
    try {
      setHistoryLoading(true)
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const response = await dailyReportService.getMyDailyReportsByDateRange(startStr, endStr)
      const reports = Array.isArray(response.data?.result) ? response.data.result : []
      setMyReports(reports)

      // Cập nhật report được chọn nếu vẫn nằm trong tháng này
      if (selectedHistoryDate) {
        const reportsForDate = reports.filter(r => r.reportDate === selectedHistoryDate)
        setSelectedHistoryReports(reportsForDate)
        // Lấy báo cáo mới nhất (sắp xếp theo createdAt DESC)
        const latestReport = reportsForDate.length > 0 
          ? reportsForDate.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
          : null
        setSelectedHistoryReport(latestReport)
      } else {
        setSelectedHistoryReport(null)
        setSelectedHistoryReports([])
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading history:', err)
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleChangeMonth = (direction) => {
    setHistoryMonth(prev => {
      let newMonth = prev + direction
      let newYear = historyYear
      if (newMonth < 0) {
        newMonth = 11
        newYear = historyYear - 1
      } else if (newMonth > 11) {
        newMonth = 0
        newYear = historyYear + 1
      }
      setHistoryYear(newYear)
      return newMonth
    })
  }

  const handleSelectHistoryDate = (dateStr) => {
    setSelectedHistoryDate(dateStr)
    const reportsForDate = myReports.filter(r => r.reportDate === dateStr)
    setSelectedHistoryReports(reportsForDate)
    // Lấy báo cáo mới nhất (sắp xếp theo createdAt DESC)
    const latestReport = reportsForDate.length > 0 
      ? reportsForDate.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null
    setSelectedHistoryReport(latestReport)
  }

  const getMonthLabel = (monthIndex, year) => {
    const formatter = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' })
    return formatter.format(new Date(year, monthIndex, 1))
  }

  const buildCalendarDays = (year, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const daysInMonth = lastDay.getDate()
    // JS: 0=CN, 1=Thứ 2,... -> chuyển về 1..7 với 1=Thứ 2
    let startWeekDay = firstDay.getDay() // 0-6
    if (startWeekDay === 0) startWeekDay = 7

    const cells = []
    // Ô trống trước ngày 1
    for (let i = 1; i < startWeekDay; i++) {
      cells.push(null)
    }
    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day)
      const dateStr = date.toISOString().split('T')[0]
      cells.push(dateStr)
    }
    return cells
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

  // Tạo map để đếm số lượng báo cáo mỗi ngày
  const reportsByDate = myReports.reduce((acc, report) => {
    const date = report.reportDate
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(report)
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form gửi báo cáo */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Báo cáo công việc</h1>
          
          {/* Tabs để chuyển đổi giữa 2 mode */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setSearchParams({ mode: 'register' })
                setError('') // Clear error khi chuyển tab
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                mode === 'register'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Đăng ký lịch làm việc
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchParams({ mode: 'report' })
                setError('') // Clear error khi chuyển tab
                // Load báo cáo nếu chưa có
                if (!todayReport) {
                  loadTodayReport()
                }
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                mode === 'report'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Báo cáo cuối ngày
            </button>
          </div>
          
          {/* Không hiển thị dropdown chọn báo cáo nữa vì chỉ có 1 báo cáo duy nhất */}
          
          {/* Chỉ hiển thị form khi có báo cáo hoặc ở mode register */}
          {mode === 'report' && !todayReport && (
            <div className="text-center py-8 text-gray-500">
              Không còn báo cáo nào cần gửi trong ngày hôm nay.
            </div>
          )}

          {error && <ErrorMessage message={error} />}

          {submitted && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              Báo cáo đã được gửi thành công!
            </div>
          )}

          {/* Thông báo khi lưu thành công ở mode register */}
          {mode === 'register' && lastSaved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-green-800">
                  Đã lưu lịch làm việc lúc {lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}

          {(mode === 'register' || (mode === 'report' && todayReport)) && (
            <form onSubmit={mode === 'register' ? handleSubmit : handleUpdateComments} className="space-y-6">
          {/* Timeline hiển thị thời gian làm việc - TRUNG TÂM CỦA BÁO CÁO */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
            <WorkTimeline
              selectedTasks={selectedTasks}
              adHocTasks={adHocTasks}
              onAddAdHocAtTime={mode === 'register' ? handleAddAdHocAtTime : null}
              mode={mode}
            />
          </div>
          
          {/* Danh sách công việc có sẵn - chỉ hiển thị ở mode register */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Công việc chưa hoàn thành ({allTasks.length} công việc)
              </label>
            <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              {allTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Không có công việc nào</p>
              ) : (
                <div className="space-y-3">
                  {allTasks.map((task) => {
                    const isSelected = selectedTasks.some(st => st.taskId === task.taskId)
                    return (
                      <div 
                        key={task.taskId} 
                        className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
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
                                Hạn: {new Date(task.endDate).toLocaleDateString('vi-VN')}
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
                  <div key={selectedTask.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50 relative pl-6">
                    {/* Timeline indicator */}
                    {selectedTask.startTime && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"></div>
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
                              Thời gian bắt đầu
                            </label>
                            <input
                              type="time"
                              value={selectedTask.startTime || ''}
                              onChange={(e) => handleSelectedTaskChange(selectedTask.taskId, 'startTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian kết thúc
                            </label>
                            <input
                              type="time"
                              value={selectedTask.endTime || ''}
                              onChange={(e) => handleSelectedTaskChange(selectedTask.taskId, 'endTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Hiển thị thời gian ở mode report */}
                      {mode === 'report' && (selectedTask.startTime || selectedTask.endTime) && (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <span className="text-sm text-gray-700">
                            <strong>Thời gian:</strong> {
                              selectedTask.startTime 
                                ? new Date(`2000-01-01T${selectedTask.startTime}`).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                : '--'
                            } - {
                              selectedTask.endTime 
                                ? new Date(`2000-01-01T${selectedTask.endTime}`).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
                            onChange={(e) => handleSelectedTaskChange(selectedTask.taskId, 'comment', e.target.value)}
                            placeholder="Nhập báo cáo kết quả về công việc này (bắt buộc)..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
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
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Thêm công việc
                </button>
              )}
            </div>

            {adHocToShow.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">
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
                  <div key={adHocTask.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative pl-6">
                    {/* Timeline indicator */}
                    {adHocTask.startTime && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-500 rounded-l-lg"></div>
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
                              Thời gian bắt đầu
                            </label>
                            <input
                              type="time"
                              value={adHocTask.startTime || ''}
                              onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'startTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Thời gian kết thúc
                            </label>
                            <input
                              type="time"
                              value={adHocTask.endTime || ''}
                              onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'endTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Hiển thị thời gian ở mode report */}
                      {mode === 'report' && (adHocTask.startTime || adHocTask.endTime) && (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <span className="text-sm text-gray-700">
                            <strong>Thời gian:</strong> {
                              adHocTask.startTime 
                                ? new Date(`2000-01-01T${adHocTask.startTime}`).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                : '--'
                            } - {
                              adHocTask.endTime 
                                ? new Date(`2000-01-01T${adHocTask.endTime}`).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
                          <input
                            type="text"
                            value={adHocTask.content}
                            onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'content', e.target.value)}
                            placeholder="Nhập nội dung công việc phát sinh..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
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
                            onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'comment', e.target.value)}
                            placeholder="Nhập báo cáo kết quả về công việc này (bắt buộc)..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                      )}

                      {/* Điểm tự chấm */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Điểm tự chấm (giờ) {mode === 'report' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={adHocTask.selfScore || ''}
                          onChange={(e) => handleAdHocTaskChange(adHocTask.id, 'selfScore', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="Ví dụ: 2.5 (tương đương 2.5 giờ = 2.5 điểm)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={mode === 'report'}
                        />
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
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={autoSaving || (selectedTasks.length === 0 && adHocTasks.length === 0)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {autoSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-center mt-4">
                    <p className="font-medium">Báo cáo này đã được gửi rồi.</p>
                    <p className="text-sm mt-1">Bạn có thể xem lại thông tin báo cáo ở trên.</p>
                  </div>
                ) : (
                  <div className="flex justify-end pt-4 border-top border-gray-200">
                    <button
                      type="submit"
                      disabled={loading || !todayReport || isReportSent(todayReport)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
                    </button>
                  </div>
                )}
              </>
            )}
          </form>
          )}
        </div>

        {/* Lịch sử báo cáo (calendar) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lịch sử báo cáo</h2>

          {/* Điều khiển tháng */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleChangeMonth(-1)}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              ← Tháng trước
            </button>
            <span className="font-medium text-gray-900">
              {getMonthLabel(historyMonth, historyYear)}
            </span>
            <button
              type="button"
              onClick={() => handleChangeMonth(1)}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              Tháng sau →
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-xs mb-3">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
              <div key={d} className="text-center font-semibold text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-gray-500">Đang tải lịch sử...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 mb-4 text-sm">
              {buildCalendarDays(historyYear, historyMonth).map((dateStr, idx) => {
                if (!dateStr) {
                  return <div key={idx} className="h-8" />
                }

                const dateObj = new Date(dateStr)
                const day = dateObj.getDate()
                const reportsForDate = reportsByDate[dateStr] || []
                const hasReport = reportsForDate.length > 0
                const reportCount = reportsForDate.length
                const isSelected = selectedHistoryDate === dateStr

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleSelectHistoryDate(dateStr)}
                    className={`h-8 flex items-center justify-center rounded-md border text-xs relative
                      ${hasReport
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700'
                      }
                      ${isSelected ? 'ring-2 ring-blue-500 font-semibold' : ''}
                    `}
                    title={hasReport 
                      ? `Đã có ${reportCount} báo cáo ngày này` 
                      : 'Chưa có báo cáo ngày này'}
                  >
                    {day}
                    {reportCount > 1 && (
                      <span className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {reportCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Chi tiết báo cáo của ngày được chọn */}
          <div className="border-t border-gray-200 pt-3 mt-2">
            <p className="text-xs text-gray-500 mb-2">
              Ngày chọn: <span className="font-medium">{selectedHistoryDate}</span>
              {selectedHistoryReports.length > 1 && (
                <span className="ml-2 text-blue-600 font-semibold">({selectedHistoryReports.length} báo cáo)</span>
              )}
            </p>
            {selectedHistoryReports.length > 0 ? (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {selectedHistoryReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((report, reportIdx) => (
                  <div key={report.reportId || reportIdx} className="border border-gray-300 rounded-md p-2 bg-white">
                    {selectedHistoryReports.length > 1 && (
                      <div className="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-200 font-medium">
                        Báo cáo #{selectedHistoryReports.length - reportIdx} - {new Date(report.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="space-y-3">
                {/* Công việc đã chọn */}
                {report.selectedTasks && report.selectedTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">
                      Công việc đã báo cáo ({report.selectedTasks.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.selectedTasks.map(task => (
                        <div
                          key={task.taskId}
                          className="bg-gray-50 border border-gray-200 rounded-md p-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">{task.title}</p>
                              {task.description && (
                                <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {task.priority && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(
                                    task.priority
                                  )}`}
                                >
                                  {getPriorityLabel(task.priority)}
                                </span>
                              )}
                              {task.directorEvaluation?.rating && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getDirectorRatingColor(
                                    task.directorEvaluation.rating
                                  )}`}
                                >
                                  GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.comment && (
                            <p className="text-[11px] text-gray-600 mt-1 italic">
                              <strong>Báo cáo kết quả:</strong> "{task.comment}"
                            </p>
                          )}
                          {task.directorEvaluation?.comment && (
                            <p className="text-[11px] text-blue-700 mt-1 italic">
                              Ghi chú GĐ: "{task.directorEvaluation.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Công việc phát sinh */}
                {report.adHocTasks && report.adHocTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">
                      Công việc phát sinh ({report.adHocTasks.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.adHocTasks.map(task => (
                        <div
                          key={task.id}
                          className="bg-blue-50 border border-blue-200 rounded-md p-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">
                                {task.content}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {task.priority && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(
                                    task.priority
                                  )}`}
                                >
                                  {getPriorityLabel(task.priority)}
                                </span>
                              )}
                              {task.directorEvaluation?.rating && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getDirectorRatingColor(
                                    task.directorEvaluation.rating
                                  )}`}
                                >
                                  GĐ: {getDirectorRatingLabel(task.directorEvaluation.rating)}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.comment && (
                            <p className="text-[11px] text-gray-600 mt-1 italic">
                              <strong>Báo cáo kết quả:</strong> "{task.comment}"
                            </p>
                          )}
                          {task.directorEvaluation?.comment && (
                            <p className="text-[11px] text-blue-700 mt-1 italic">
                              Ghi chú GĐ: "{task.directorEvaluation.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!report.selectedTasks?.length &&
                  !report.adHocTasks?.length && (
                    <p className="text-xs text-gray-500">
                      Báo cáo này không có nội dung chi tiết.
                    </p>
                  )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Không có báo cáo nào cho ngày này.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailyReportPage
