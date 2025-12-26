import { useState, useEffect } from 'react'
import Modal from './Modal'
import { departmentService } from '../services/departmentService'
import { directorService } from '../services/directorService'

const EditTaskModal = ({ isOpen, onClose, task, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    departmentIds: []
  })
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    if (isOpen && task) {
      // Chuyển departmentIds thành string array để so sánh với checkbox values
      const taskDeptIds = (task.departmentIds || []).map(id => String(id))
      setFormData({
        title: task.title || '',
        description: task.description || '',
        startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '',
        endDate: task.endDate ? new Date(task.endDate).toISOString().slice(0, 16) : '',
        departmentIds: taskDeptIds
      })
      loadDepartments()
    }
  }, [isOpen, task])

  const loadDepartments = async () => {
    try {
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      
      // Load departments based on role
      let response
      if (user.roles?.includes('DIRECTOR')) {
        const directorResponse = await directorService.getMyDirector()
        response = await departmentService.getDepartmentsByDirectorId(directorResponse.data.result.directorId)
      } else if (user.roles?.includes('MANAGER') || user.roles?.includes('DEPARTMENT_MANAGER')) {
        response = await departmentService.getDepartmentsByManagerId(user.userId)
      } else {
        response = await departmentService.getDepartmentsByUserId(user.userId)
      }
      
      setDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading departments:', err)
    }
  }

  const validateForm = () => {
    const errors = {}
    
    // Validate title
    if (!formData.title || formData.title.trim().length === 0) {
      errors.title = 'Tiêu đề không được để trống'
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Tiêu đề phải có ít nhất 3 ký tự'
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Tiêu đề không được vượt quá 200 ký tự'
    }
    
    // Validate dates
    if (!formData.startDate) {
      errors.startDate = 'Ngày bắt đầu không được để trống'
    }
    
    if (!formData.endDate) {
      errors.endDate = 'Ngày kết thúc không được để trống'
    }
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (end <= start) {
        errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu'
      }
    }
    
    // Validate departments
    if (formData.departmentIds.length === 0) {
      errors.departmentIds = 'Vui lòng chọn ít nhất một phòng ban'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task) return

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setError('')
      setValidationErrors({})

      const data = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        departmentIds: formData.departmentIds.map(id => parseInt(id))
      }

      await onUpdate(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật task')
    } finally {
      setLoading(false)
    }
  }

  const handleDepartmentToggle = (deptId) => {
    const deptIdStr = String(deptId)
    if (formData.departmentIds.includes(deptIdStr)) {
      setFormData({
        ...formData,
        departmentIds: formData.departmentIds.filter(id => id !== deptIdStr)
      })
    } else {
      setFormData({
        ...formData,
        departmentIds: [...formData.departmentIds, deptIdStr]
      })
    }
  }

  if (!task) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa Task"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tiêu đề *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value })
              if (validationErrors.title) {
                setValidationErrors({ ...validationErrors, title: '' })
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              validationErrors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            maxLength={200}
          />
          {validationErrors.title && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mô tả
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              onChange={(e) => {
                setFormData({ ...formData, startDate: e.target.value })
                if (validationErrors.startDate) {
                  setValidationErrors({ ...validationErrors, startDate: '' })
                }
                if (validationErrors.endDate && formData.endDate) {
                  const end = new Date(formData.endDate)
                  const start = new Date(e.target.value)
                  if (end > start) {
                    setValidationErrors({ ...validationErrors, endDate: '' })
                  }
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.startDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.startDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ngày kết thúc *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.endDate}
              onChange={(e) => {
                setFormData({ ...formData, endDate: e.target.value })
                if (validationErrors.endDate) {
                  setValidationErrors({ ...validationErrors, endDate: '' })
                }
              }}
              min={formData.startDate || ''}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.endDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.endDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phòng ban (có thể chọn nhiều) *
          </label>
          <div className={`mt-2 border rounded-lg p-3 max-h-60 overflow-y-auto ${
            validationErrors.departmentIds ? 'border-red-500' : 'border-gray-300'
          }`}>
            {departments.length > 0 ? (
              <div className="space-y-2">
                {departments.map((dept) => {
                  const isSelected = formData.departmentIds.includes(String(dept.departmentId))
                  return (
                    <label
                      key={dept.departmentId}
                      className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={dept.departmentId}
                        checked={isSelected}
                        onChange={() => handleDepartmentToggle(dept.departmentId)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                          {dept.departmentName}
                        </span>
                        {isSelected && (
                          <span className="ml-2 text-xs text-blue-600 font-semibold">(Đang nhận task)</span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Chưa có phòng ban nào</p>
            )}
          </div>
          {formData.departmentIds.length > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              Đã chọn: <span className="font-semibold">{formData.departmentIds.length}</span> phòng ban
            </p>
          )}
          {validationErrors.departmentIds && (
            <p className="mt-2 text-sm text-red-600">{validationErrors.departmentIds}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{loading ? 'Đang cập nhật...' : 'Cập nhật'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default EditTaskModal

