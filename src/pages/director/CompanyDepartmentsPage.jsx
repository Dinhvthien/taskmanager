import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { departmentService } from '../../services/departmentService'
import { directorService } from '../../services/directorService'
import { userService } from '../../services/userService'
import { reportService } from '../../services/reportService'
import { roleService } from '../../services/roleService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'

const CompanyDepartmentsPage = () => {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [allDepartments, setAllDepartments] = useState([]) // Tất cả departments để phân trang
  const [director, setDirector] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedDepartmentForReport, setSelectedDepartmentForReport] = useState(null)
  const [reportDateRange, setReportDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const [exportingReport, setExportingReport] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10) // Số items mỗi trang
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedDepartmentForAddUser, setSelectedDepartmentForAddUser] = useState(null)
  const [availableUsers, setAvailableUsers] = useState([])
  const [addUserMode, setAddUserMode] = useState('select') // 'select' or 'create'
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roles, setRoles] = useState([])
  const [formData, setFormData] = useState({
    departmentName: '',
    description: '',
    managerId: ''
  })
  const [createUserFormData, setCreateUserFormData] = useState({
    userName: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: ''
  })

  useEffect(() => {
    loadDirector()
  }, [])

  useEffect(() => {
    if (director) {
      loadDepartments()
      loadUsers()
      loadRoles()
    }
  }, [director])

  useEffect(() => {
    if (showAddUserModal && selectedDepartmentForAddUser && director) {
      loadAvailableUsers()
    }
  }, [showAddUserModal, selectedDepartmentForAddUser, director])

  useEffect(() => {
    // Phân trang client-side
    if (allDepartments.length > 0) {
      const startIndex = currentPage * pageSize
      const endIndex = startIndex + pageSize
      const paginatedDepartments = allDepartments.slice(startIndex, endIndex)
      setDepartments(paginatedDepartments)
      setTotalPages(Math.ceil(allDepartments.length / pageSize))
    }
  }, [allDepartments, currentPage, pageSize])

  const loadDirector = async () => {
    try {
      const response = await directorService.getMyDirector()
      setDirector(response.data.result)
    } catch (err) {
      setError('Lỗi khi tải thông tin director')
    }
  }

  const loadDepartments = async () => {
    if (!director) return

    try {
      setLoading(true)
      const response = await departmentService.getDepartmentsByDirectorId(director.directorId)
      const allDepts = response.data.result || []
      setAllDepartments(allDepts) // Lưu tất cả departments
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách departments')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    if (!director) return

    try {
      const response = await userService.getUsersByDirectorId(director.directorId, 0, 100)
      const allUsers = response.data.result?.content || []
      // Chỉ lấy users có role MANAGER
      const managers = allUsers.filter(user => 
        user.roles && user.roles.includes('MANAGER')
      )
      setUsers(managers)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await roleService.getAllRoles()
      const allRoles = response.data.result || []
      // Chỉ lấy USER role cho tạo user mới
      const userRole = allRoles.find(role => role.name === 'USER')
      setRoles(userRole ? [userRole] : [])
    } catch (err) {
      console.error('Error loading roles:', err)
      setRoles([])
    }
  }

  const loadAvailableUsers = async () => {
    if (!selectedDepartmentForAddUser || !director) return

    try {
      // Lấy tất cả users từ công ty của director
      const usersResponse = await userService.getUsersByDirectorId(director.directorId, 0, 1000)
      const allUsers = usersResponse.data.result?.content || []
      
      // Lọc chỉ USER và MANAGER roles
      const filteredUsers = allUsers.filter(user => 
        user.roles && (user.roles.includes('USER') || user.roles.includes('MANAGER'))
      )
      
      // Lấy danh sách userIds đã có trong department
      const deptUsersResponse = await departmentService.getUsersByDepartmentId(selectedDepartmentForAddUser.departmentId)
      const deptUserIds = (deptUsersResponse.data.result || []).map(id => Number(id))
      
      // Lọc ra những users chưa có trong department (so sánh cả string và number)
      const available = filteredUsers.filter(user => {
        const userId = Number(user.userId)
        return !deptUserIds.includes(userId)
      })
      
      setAvailableUsers(available)
    } catch (err) {
      console.error('Error loading available users:', err)
      setAvailableUsers([])
    }
  }

  const handleAddUser = async () => {
    if (!selectedDepartmentForAddUser) return

    if (addUserMode === 'select') {
      if (!selectedUserId) {
        setError('Vui lòng chọn nhân viên')
        return
      }

      try {
        setIsSubmitting(true)
        setError('')
        await departmentService.addUserToDepartment(
          selectedDepartmentForAddUser.departmentId, 
          parseInt(selectedUserId)
        )
        // Reload danh sách available users để cập nhật
        await loadAvailableUsers()
        setSelectedUserId('')
        setAddUserMode('select')
        loadDepartments() // Reload để cập nhật số nhân viên
        setError('')
        // Không đóng modal, để có thể thêm tiếp
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi thêm user vào phòng ban')
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Create new user
      if (!createUserFormData.userName || !createUserFormData.password || !createUserFormData.fullName) {
        setError('Vui lòng điền đầy đủ thông tin bắt buộc')
        return
      }

      if (!director) {
        setError('Không thể lấy thông tin công ty')
        return
      }

      try {
        setIsSubmitting(true)
        setError('')
        
        // Tạo user mới với role USER
        const userRole = roles.find(r => r.name === 'USER')
        if (!userRole) {
          setError('Không tìm thấy role USER')
          return
        }

        const createUserData = {
          userName: createUserFormData.userName,
          password: createUserFormData.password,
          fullName: createUserFormData.fullName,
          email: createUserFormData.email || null,
          phoneNumber: createUserFormData.phoneNumber || null,
          roleId: userRole.id
        }
        
        const createResponse = await userService.createUser(createUserData)
        const newUserId = createResponse.data.result.userId
        
        // Thêm user mới vào department
        await departmentService.addUserToDepartment(selectedDepartmentForAddUser.departmentId, newUserId)
        
        // Reload danh sách available users để cập nhật
        await loadAvailableUsers()
        setAddUserMode('select')
        setCreateUserFormData({
          userName: '',
          password: '',
          fullName: '',
          email: '',
          phoneNumber: ''
        })
        loadDepartments() // Reload để cập nhật số nhân viên
        setError('')
        // Không đóng modal, để có thể thêm tiếp
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi tạo nhân viên mới')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleOpenAddUserModal = (department) => {
    setSelectedDepartmentForAddUser(department)
    setShowAddUserModal(true)
    setError('')
    setSelectedUserId('')
    setAddUserMode('select')
  }

  const validateDepartmentForm = (data) => {
    const errors = {}
    
    // Validate departmentName
    if (!data.departmentName || data.departmentName.trim().length === 0) {
      errors.departmentName = 'Tên phòng ban không được để trống'
    } else if (data.departmentName.trim().length < 2) {
      errors.departmentName = 'Tên phòng ban phải có ít nhất 2 ký tự'
    } else if (data.departmentName.trim().length > 100) {
      errors.departmentName = 'Tên phòng ban không được vượt quá 100 ký tự'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!director) return

    // Validate form
    if (!validateDepartmentForm(formData)) {
      return
    }

    try {
      setError('')
      setValidationErrors({})
      await departmentService.createDepartment({
        directorId: director.directorId,
        departmentName: formData.departmentName.trim(),
        description: formData.description.trim(),
        managerId: formData.managerId ? parseInt(formData.managerId) : null
      })
      setShowCreateModal(false)
      setFormData({
        departmentName: '',
        description: '',
        managerId: ''
      })
      setValidationErrors({})
      loadDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo department')
    }
  }

  const handleEdit = (department) => {
    setSelectedDepartment(department)
    setFormData({
      departmentName: department.departmentName,
      description: department.description || '',
      managerId: department.managerId || ''
    })
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!selectedDepartment || !director) return

    // Validate form
    if (!validateDepartmentForm(formData)) {
      return
    }

    try {
      setError('')
      setValidationErrors({})
      await departmentService.updateDepartment(selectedDepartment.departmentId, {
        directorId: director.directorId,
        departmentName: formData.departmentName.trim(),
        description: formData.description.trim(),
        managerId: formData.managerId ? parseInt(formData.managerId) : null
      })
      setShowEditModal(false)
      setSelectedDepartment(null)
      setValidationErrors({})
      loadDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật department')
    }
  }

  const handleDelete = async (department) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng ban "${department.departmentName}"?`)) {
      return
    }

    try {
      await departmentService.deleteDepartment(department.departmentId)
      loadDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xóa phòng ban')
    }
  }

  const handleExportDepartmentReport = async () => {
    if (!selectedDepartmentForReport) return

    try {
      setExportingReport(true)
      setError('')

      const params = {}
      if (reportDateRange.startDate) {
        params.startDate = new Date(reportDateRange.startDate).toISOString()
      }
      if (reportDateRange.endDate) {
        params.endDate = new Date(reportDateRange.endDate).toISOString()
      }

      const response = await reportService.exportDepartmentReport(
        selectedDepartmentForReport.departmentId,
        params.startDate,
        params.endDate
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bao_cao_phong_ban_${selectedDepartmentForReport.departmentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Close modal and reset
      setShowReportModal(false)
      setSelectedDepartmentForReport(null)
      setReportDateRange({ startDate: '', endDate: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xuất báo cáo')
    } finally {
      setExportingReport(false)
    }
  }

  if (loading && departments.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          <span>+</span>
          <span>Tạo phòng ban</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {departments.map((dept) => (
          <div
            key={dept.departmentId}
            className="bg-white rounded-xl shadow-md border border-gray-200 p-3 hover:shadow-lg transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 mb-0.5">{dept.departmentName}</h3>
                {dept.description && (
                  <p className="text-xs text-gray-600 line-clamp-1">{dept.description}</p>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-xs font-medium text-blue-700">Nhân viên</span>
                </div>
                <p className="text-base font-bold text-blue-900">{dept.numberOfEmployees || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-xs font-medium text-purple-700">Tasks</span>
                </div>
                <p className="text-base font-bold text-purple-900">{dept.numberOfOngoingTasks || 0}</p>
              </div>
            </div>

            {/* Manager Info */}
            {dept.managerName && (
              <div className="flex items-center space-x-1.5 mb-2 p-1.5 bg-gray-50 rounded-lg">
                <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Trưởng phòng</p>
                  <p className="text-xs font-medium text-gray-900 truncate">{dept.managerName}</p>
                </div>
              </div>
            )}
            {!dept.managerName && (
              <div className="flex items-center space-x-1.5 mb-2 p-1.5 bg-gray-50 rounded-lg">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-xs text-gray-400">Chưa có trưởng phòng</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-gray-200">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenAddUserModal(dept)
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Thêm NV</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/director/department-tasks?departmentId=${dept.departmentId}`)
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Tasks</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedDepartmentForReport(dept)
                  setShowReportModal(true)
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Báo cáo</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(dept)
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Chỉnh sửa</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(dept)
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Xóa</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tên phòng ban
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Mô tả
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Trưởng phòng
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Số nhân viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Số tasks đang làm
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departments.map((dept) => (
                <tr key={dept.departmentId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{dept.departmentName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {dept.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {dept.managerName || <span className="text-gray-400">Chưa có</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {dept.numberOfEmployees || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {dept.numberOfOngoingTasks || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAddUserModal(dept)
                        }}
                        className="text-indigo-600 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50"
                        title="Thêm nhân viên"
                      >
                        Thêm NV
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/director/department-tasks?departmentId=${dept.departmentId}`)
                        }}
                        className="text-purple-600 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50"
                        title="Quản lý tasks"
                      >
                        Tasks
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDepartmentForReport(dept)
                          setShowReportModal(true)
                        }}
                        className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                        title="Xuất báo cáo"
                      >
                        Báo cáo
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(dept)
                        }}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(dept)
                        }}
                        className="text-red-600 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {departments.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Chưa có phòng ban nào</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page - 1)}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo phòng ban mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên phòng ban *
            </label>
            <input
              type="text"
              required
              value={formData.departmentName}
              onChange={(e) => {
                setFormData({ ...formData, departmentName: e.target.value })
                if (validationErrors.departmentName) {
                  setValidationErrors({ ...validationErrors, departmentName: '' })
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.departmentName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {validationErrors.departmentName && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.departmentName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trưởng phòng
            </label>
            <select
              value={formData.managerId}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Chọn trưởng phòng (tùy chọn) --</option>
              {users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.fullName} (@{user.userName})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tạo
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedDepartment(null)
        }}
        title="Chỉnh sửa phòng ban"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên phòng ban *
            </label>
            <input
              type="text"
              required
              value={formData.departmentName}
              onChange={(e) => {
                setFormData({ ...formData, departmentName: e.target.value })
                if (validationErrors.departmentName) {
                  setValidationErrors({ ...validationErrors, departmentName: '' })
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.departmentName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {validationErrors.departmentName && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.departmentName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trưởng phòng
            </label>
            <select
              value={formData.managerId}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Chọn trưởng phòng (tùy chọn) --</option>
              {users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.fullName} (@{user.userName})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setSelectedDepartment(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cập nhật
            </button>
          </div>
        </form>
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowAddUserModal(false)
            setSelectedDepartmentForAddUser(null)
            setAddUserMode('select')
            setSelectedUserId('')
            setCreateUserFormData({
              userName: '',
              password: '',
              fullName: '',
              email: '',
              phoneNumber: ''
            })
            setError('')
          }
        }}
        title={`Thêm nhân viên - ${selectedDepartmentForAddUser?.departmentName || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {selectedDepartmentForAddUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                <strong>Phòng ban:</strong> {selectedDepartmentForAddUser.departmentName}
              </p>
            </div>
          )}

          {/* Tab selection */}
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              type="button"
              onClick={async () => {
                setAddUserMode('select')
                setError('')
                // Reload danh sách khi chuyển sang tab select
                await loadAvailableUsers()
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                addUserMode === 'select'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chọn nhân viên có sẵn
            </button>
            <button
              type="button"
              onClick={() => {
                setAddUserMode('create')
                setError('')
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                addUserMode === 'create'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tạo nhân viên mới
            </button>
          </div>

          {addUserMode === 'select' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chọn nhân viên *
                </label>
                {availableUsers.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">
                      Tất cả nhân viên đã có trong phòng ban này
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Vui lòng chọn tab "Tạo nhân viên mới" để thêm nhân viên mới
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {availableUsers.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.fullName} (@{user.userName}) - {user.roles?.includes('MANAGER') ? 'Trưởng phòng' : 'Nhân viên'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleAddUser(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên đăng nhập *
                </label>
                <input
                  type="text"
                  required
                  value={createUserFormData.userName}
                  onChange={(e) => setCreateUserFormData({ ...createUserFormData, userName: e.target.value })}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  required
                  value={createUserFormData.password}
                  onChange={(e) => setCreateUserFormData({ ...createUserFormData, password: e.target.value })}
                  placeholder="Nhập mật khẩu"
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Mật khẩu tối thiểu 6 ký tự</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={createUserFormData.fullName}
                  onChange={(e) => setCreateUserFormData({ ...createUserFormData, fullName: e.target.value })}
                  placeholder="Nhập họ và tên"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={createUserFormData.email}
                  onChange={(e) => setCreateUserFormData({ ...createUserFormData, email: e.target.value })}
                  placeholder="Nhập email (tùy chọn)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={createUserFormData.phoneNumber}
                  onChange={(e) => setCreateUserFormData({ ...createUserFormData, phoneNumber: e.target.value })}
                  placeholder="Nhập số điện thoại (tùy chọn)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Lưu ý:</strong> Nhân viên mới sẽ được tạo với vai trò <strong>Nhân viên</strong> và tự động được thêm vào phòng ban này.
                </p>
              </div>
            </form>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  setShowAddUserModal(false)
                  setSelectedDepartmentForAddUser(null)
                  setAddUserMode('select')
                  setSelectedUserId('')
                  setCreateUserFormData({
                    userName: '',
                    password: '',
                    fullName: '',
                    email: '',
                    phoneNumber: ''
                  })
                  setError('')
                }
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleAddUser}
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang xử lý...' : addUserMode === 'select' ? 'Thêm' : 'Tạo và thêm'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Export Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => {
          if (!exportingReport) {
            setShowReportModal(false)
            setSelectedDepartmentForReport(null)
            setReportDateRange({ startDate: '', endDate: '' })
            setError('')
          }
        }}
        title={`Xuất báo cáo - ${selectedDepartmentForReport?.departmentName || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Phòng ban:</strong> {selectedDepartmentForReport?.departmentName}
            </p>
            {selectedDepartmentForReport?.description && (
              <p className="text-xs text-blue-600 mt-1">
                {selectedDepartmentForReport.description}
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1">
              Báo cáo sẽ bao gồm thông tin chi tiết về các công việc được giao cho phòng ban này.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Khoảng thời gian (tùy chọn)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Để trống nếu muốn xuất tất cả công việc
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={reportDateRange.startDate}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={reportDateRange.endDate}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, endDate: e.target.value })}
                  min={reportDateRange.startDate || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!exportingReport) {
                  setShowReportModal(false)
                  setSelectedDepartmentForReport(null)
                  setReportDateRange({ startDate: '', endDate: '' })
                  setError('')
                }
              }}
              disabled={exportingReport}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              onClick={handleExportDepartmentReport}
              disabled={exportingReport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {exportingReport && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{exportingReport ? 'Đang xuất...' : 'Xuất báo cáo'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CompanyDepartmentsPage

