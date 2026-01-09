import { useState, useEffect } from 'react'
import { taskService } from '../../services/taskService'
import { directorService } from '../../services/directorService'
import { departmentService } from '../../services/departmentService'
import { attachmentService } from '../../services/attachmentService'
import TaskCard from '../../components/TaskCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import FileUpload from '../../components/FileUpload'

const TasksPage = () => {
  const [tasks, setTasks] = useState([])
  const [directors, setDirectors] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDirector, setSelectedDirector] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    directorId: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    departmentIds: []
  })
  const [taskFiles, setTaskFiles] = useState([]) // Files để đính kèm khi tạo task
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadDirectors()
  }, [])

  useEffect(() => {
    if (selectedDirector) {
      loadTasks(selectedDirector)
      loadDepartments(selectedDirector)
    }
  }, [selectedDirector, currentPage])

  const loadDepartments = async (directorId) => {
    try {
      const response = await departmentService.getDepartmentsByDirectorId(directorId)
      setDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading departments:', err)
    }
  }

  const loadDirectors = async () => {
    try {
      const response = await directorService.getAllDirectors()
      setDirectors(response.data.result || [])
      if (response.data.result && response.data.result.length > 0) {
        setSelectedDirector(response.data.result[0].directorId)
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách directors')
    }
  }

  const loadTasks = async (directorId) => {
    try {
      setLoading(true)
      setError('')
      const response = await taskService.getTasksByDirectorId(directorId, currentPage, 20)
      const result = response.data.result
      setTasks(result.content || [])
      setTotalPages(result.totalPages || 1)
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Lỗi khi tải danh sách tasks'
      setError(errorMessage)
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handlers cho file upload
  const handleFileSelect = (file) => {
    setTaskFiles(prev => [...prev, file])
  }

  const handleFileRemove = (index) => {
    setTaskFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (isSubmitting || uploadingFiles) return
    
    try {
      setIsSubmitting(true)
      setError('')
      const data = {
        ...formData,
        directorId: parseInt(formData.directorId),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        departmentIds: formData.departmentIds.map(id => parseInt(id))
      }
      const createResponse = await taskService.createTask(data)
      const createdTask = createResponse.data.result
      const createdTaskId = createdTask.taskId
      
      // Upload files nếu có
      if (taskFiles.length > 0 && createdTaskId) {
        setUploadingFiles(true)
        try {
          console.log(`📎 Uploading ${taskFiles.length} file(s) to new task ${createdTaskId}`)
          for (const file of taskFiles) {
            try {
              await attachmentService.uploadTaskAttachment(createdTaskId, file)
              console.log(`✅ File uploaded to task ${createdTaskId}:`, file.name)
            } catch (fileErr) {
              console.error('✗ Error uploading file:', fileErr)
              // Continue với các file khác nếu một file lỗi
            }
          }
        } finally {
          setUploadingFiles(false)
        }
      }
      
      setShowCreateModal(false)
      setFormData({
        directorId: '',
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        departmentIds: []
      })
      setTaskFiles([]) // Clear files
      loadTasks(selectedDirector)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo task')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading && tasks.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Tasks</h1>
          <p className="text-gray-600 mt-1">Quản lý tất cả tasks trong hệ thống</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Tạo Task
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700 font-medium">{error}</p>
              {error.includes('quyền') && (
                <p className="text-xs text-red-600 mt-1">
                  Vui lòng kiểm tra lại quyền truy cập của bạn
                </p>
              )}
            </div>
            <button
              onClick={() => setError('')}
              className="ml-3 text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn Director
        </label>
        <select
          value={selectedDirector || ''}
          onChange={(e) => {
            setSelectedDirector(parseInt(e.target.value))
            setCurrentPage(0)
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">-- Chọn Director --</option>
          {directors.map((director) => (
            <option key={director.directorId} value={director.directorId}>
              {director.companyName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {tasks.map((task) => (
              <TaskCard key={task.taskId} task={task} />
            ))}
          </div>

          {tasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có task nào</p>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage + 1}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page - 1)}
            />
          )}
        </>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setTaskFiles([]) // Clear files when closing modal
        }}
        title="Tạo Task mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Director *
            </label>
            <select
              required
              value={formData.directorId}
              onChange={(e) => {
                const newDirectorId = parseInt(e.target.value)
                setFormData({ ...formData, directorId: e.target.value, departmentIds: [] })
                loadDepartments(newDirectorId)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Chọn Director --</option>
              {directors.map((director) => (
                <option key={director.directorId} value={director.directorId}>
                  {director.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phòng ban (có thể chọn nhiều)
            </label>
            <select
              multiple
              value={formData.departmentIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                setFormData({ ...formData, departmentIds: selected })
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[100px]"
              size={5}
            >
              {departments.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Giữ Ctrl (Windows) hoặc Cmd (Mac) để chọn nhiều</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiêu đề *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Đính kèm file
            </label>
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              selectedFiles={taskFiles}
              disabled={isSubmitting || uploadingFiles}
              maxFiles={10}
              maxSize={50 * 1024 * 1024} // 50MB
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày kết thúc *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setTaskFiles([]) // Clear files when closing modal
              }}
              disabled={isSubmitting || uploadingFiles}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingFiles}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {(isSubmitting || uploadingFiles) && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{uploadingFiles ? 'Đang upload file...' : (isSubmitting ? 'Đang tạo...' : 'Tạo')}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default TasksPage

