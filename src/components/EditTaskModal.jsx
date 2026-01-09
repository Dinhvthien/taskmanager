import { useState, useEffect } from 'react'
import Modal from './Modal'
import { departmentService } from '../services/departmentService'
import { directorService } from '../services/directorService'
import { userService } from '../services/userService'

const EditTaskModal = ({ isOpen, onClose, task, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    departmentIds: [],
    userIds: [], // Danh sách nhân viên được chọn
    actualTimeUnit: '', // 'MINUTES', 'HOURS', 'DAYS', 'MONTHS'
    actualTimeValue: '' // Giá trị số
  })
  const [departments, setDepartments] = useState([])
  const [allUsers, setAllUsers] = useState([]) // Tất cả users (cho mode direct)
  const [loadingAllUsers, setLoadingAllUsers] = useState(false)
  const [assignmentMode, setAssignmentMode] = useState('department') // 'department' hoặc 'direct'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    if (isOpen && task) {
      // Chuyển departmentIds và userIds thành string array để so sánh với checkbox values
      const taskDeptIds = (task.departmentIds || []).map(id => String(id))
      const taskUserIds = (task.assignedUserIds || []).map(id => String(id))
      
      // Xác định assignment mode: nếu có departmentIds thì là 'department', nếu chỉ có userIds thì là 'direct'
      const mode = taskDeptIds.length > 0 ? 'department' : 'direct'
      setAssignmentMode(mode)
      
      // Xác định đơn vị và giá trị từ task
      let timeUnit = ''
      let timeValue = ''
      if (task.actualMinutes != null && task.actualMinutes > 0) {
        timeUnit = 'MINUTES'
        timeValue = String(task.actualMinutes)
      } else if (task.actualHours != null && task.actualHours > 0) {
        timeUnit = 'HOURS'
        timeValue = String(task.actualHours)
      } else if (task.actualDays != null && task.actualDays > 0) {
        timeUnit = 'DAYS'
        timeValue = String(task.actualDays)
      } else if (task.actualMonths != null && task.actualMonths > 0) {
        timeUnit = 'MONTHS'
        timeValue = String(task.actualMonths)
      }
      
      setFormData({
        title: task.title || '',
        description: task.description || '',
        startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '',
        endDate: task.endDate ? new Date(task.endDate).toISOString().slice(0, 16) : '',
        departmentIds: taskDeptIds,
        userIds: taskUserIds,
        actualTimeUnit: timeUnit,
        actualTimeValue: timeValue
      })
      loadDepartments()
      
      // Load users nếu mode là direct
      if (mode === 'direct' && taskUserIds.length > 0) {
        loadAllUsers()
      }
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

  const loadAllUsers = async () => {
    try {
      setLoadingAllUsers(true)
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      
      let response
      if (user.roles?.includes('DIRECTOR')) {
        const directorResponse = await directorService.getMyDirector()
        response = await userService.getUsersByDirectorId(directorResponse.data.result.directorId, 0, 1000)
      } else {
        // Đối với MANAGER hoặc các role khác, có thể load từ getAllUsers hoặc service tương ứng
        response = await userService.getAllUsers(0, 1000)
      }
      
      const usersList = response.data.result?.content || []
      // Lọc chỉ USER và MANAGER roles
      const filteredUsers = usersList.filter(u => 
        u.roles && (u.roles.includes('USER') || u.roles.includes('MANAGER'))
      )
      setAllUsers(filteredUsers)
    } catch (err) {
      console.error('Error loading all users:', err)
      setAllUsers([])
    } finally {
      setLoadingAllUsers(false)
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
    
    // Validate assignment based on mode
    if (assignmentMode === 'department') {
      if (formData.departmentIds.length === 0) {
        errors.departmentIds = 'Vui lòng chọn ít nhất một phòng ban'
      }
    } else {
      if (formData.userIds.length === 0) {
        errors.userIds = 'Vui lòng chọn ít nhất một nhân viên'
      }
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
        departmentIds: assignmentMode === 'department' ? formData.departmentIds.map(id => parseInt(id)) : [],
        userIds: assignmentMode === 'direct' && formData.userIds.length > 0 ? formData.userIds.map(id => parseInt(id)) : null
      }
      
      // Xử lý số giờ thực tế dự kiến
      if (formData.actualTimeUnit && formData.actualTimeValue) {
        const value = parseInt(formData.actualTimeValue)
        switch (formData.actualTimeUnit) {
          case 'MINUTES':
            data.actualMinutes = value
            break
          case 'HOURS':
            data.actualHours = value
            break
          case 'DAYS':
            data.actualDays = value
            break
          case 'MONTHS':
            data.actualMonths = value
            break
        }
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

        {/* Số giờ thực tế dự kiến */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Số giờ thực tế dự kiến (tùy chọn)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Đơn vị
              </label>
              <select
                value={formData.actualTimeUnit}
                onChange={(e) => setFormData({ ...formData, actualTimeUnit: e.target.value, actualTimeValue: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Chọn đơn vị --</option>
                <option value="MINUTES">Phút</option>
                <option value="HOURS">Giờ</option>
                <option value="DAYS">Ngày</option>
                <option value="MONTHS">Tháng</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Giá trị
              </label>
              <input
                type="number"
                min="0"
                value={formData.actualTimeValue}
                onChange={(e) => setFormData({ ...formData, actualTimeValue: e.target.value })}
                placeholder="Nhập số"
                disabled={!formData.actualTimeUnit}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Nhập thời gian dự kiến để hoàn thành công việc này
          </p>
        </div>

        {/* Chọn mode giao việc */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Cách giao việc *
          </label>
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="assignmentMode"
                value="department"
                checked={assignmentMode === 'department'}
                onChange={async (e) => {
                  setAssignmentMode('department')
                  setFormData({ ...formData, userIds: [] })
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Giao qua phòng ban</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="assignmentMode"
                value="direct"
                checked={assignmentMode === 'direct'}
                onChange={async (e) => {
                  setAssignmentMode('direct')
                  setFormData({ ...formData, departmentIds: [], userIds: [] })
                  if (allUsers.length === 0) {
                    await loadAllUsers()
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Giao trực tiếp cho nhân viên</span>
            </label>
          </div>
        </div>

        {/* Giao qua phòng ban */}
        {assignmentMode === 'department' && (
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
        )}

        {/* Giao trực tiếp cho nhân viên */}
        {assignmentMode === 'direct' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nhân viên (có thể chọn nhiều) *
            </label>
            <div className={`mt-2 border rounded-lg p-3 max-h-60 overflow-y-auto ${
              validationErrors.userIds ? 'border-red-500' : 'border-gray-300'
            }`}>
              {loadingAllUsers ? (
                <div className="text-sm text-gray-500 text-center py-4">Đang tải...</div>
              ) : allUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Chưa có nhân viên nào</p>
              ) : (
                <div className="space-y-2">
                  {allUsers.map((user) => {
                    const isManager = user.roles && user.roles.includes('MANAGER')
                    const isSelected = formData.userIds.includes(String(user.userId))
                    
                    return (
                      <label
                        key={user.userId}
                        className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                userIds: [...formData.userIds, String(user.userId)]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                userIds: formData.userIds.filter(id => id !== String(user.userId))
                              })
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {user.fullName}
                            </span>
                            {isManager && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                Trưởng phòng
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">@{user.userName}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            {formData.userIds.length > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                Đã chọn: <span className="font-semibold">{formData.userIds.length}</span> nhân viên
              </p>
            )}
            {validationErrors.userIds && (
              <p className="mt-2 text-sm text-red-600">{validationErrors.userIds}</p>
            )}
          </div>
        )}

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

