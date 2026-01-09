import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { directorService } from '../../services/directorService'
import { departmentService } from '../../services/departmentService'
import { roleService } from '../../services/roleService'
import { reportService } from '../../services/reportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'

const CompanyUsersPage = () => {
  const [users, setUsers] = useState([])
  const [userDepartments, setUserDepartments] = useState({}) // Map userId -> departments[]
  const [director, setDirector] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedUserForReport, setSelectedUserForReport] = useState(null)
  const [reportDateRange, setReportDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const [exportingReport, setExportingReport] = useState(false)
  const [roles, setRoles] = useState([])
  const [allDepartments, setAllDepartments] = useState([])
  const [showDepartmentModal, setShowDepartmentModal] = useState(false)
  const [selectedUserForDepartment, setSelectedUserForDepartment] = useState(null)
  const [userDepartmentIds, setUserDepartmentIds] = useState([])
  const [isUpdatingDepartments, setIsUpdatingDepartments] = useState(false)
  const [openActionMenu, setOpenActionMenu] = useState(null) // userId của menu đang mở
  const [showDepartmentList, setShowDepartmentList] = useState(null) // userId để hiển thị danh sách phòng ban
  const [formData, setFormData] = useState({
    userName: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    roleId: ''
  })
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    roleId: ''
  })

  useEffect(() => {
    loadDirector()
    loadRoles()
    loadAllDepartments()
  }, [])

  useEffect(() => {
    if (director) {
      loadUsers()
      loadAllDepartments()
    }
  }, [director, currentPage])

  const loadDirector = async () => {
    try {
      const response = await directorService.getMyDirector()
      setDirector(response.data.result)
    } catch (err) {
      setError('Lỗi khi tải thông tin director')
    }
  }

  const loadRoles = async () => {
    try {
      const response = await roleService.getAllRoles()
      const allRoles = response.data.result || []
      // Chỉ lấy USER và MANAGER roles
      const allowedRoles = allRoles.filter(role => 
        role.name === 'USER' || role.name === 'MANAGER'
      )
      setRoles(allowedRoles)
    } catch (err) {
      console.error('Error loading roles:', err)
      setRoles([])
    }
  }

  const loadAllDepartments = async () => {
    if (!director) return
    try {
      const response = await departmentService.getDepartmentsByDirectorId(director.directorId)
      setAllDepartments(response.data.result || [])
    } catch (err) {
      console.error('Error loading departments:', err)
      setAllDepartments([])
    }
  }

  const loadUsers = async () => {
    if (!director) return

    try {
      setLoading(true)
      const response = await userService.getUsersByDirectorId(director.directorId, currentPage, 20)
      const result = response.data.result
      const usersList = result.content || []
      setUsers(usersList)
      setTotalPages(result.totalPages || 1)
      
      // Load departments for each user
      const departmentsMap = {}
      await Promise.all(
        usersList.map(async (user) => {
          try {
            const deptResponse = await departmentService.getDepartmentsByUserId(user.userId)
            departmentsMap[user.userId] = deptResponse.data.result || []
          } catch (err) {
            console.error(`Error loading departments for user ${user.userId}:`, err)
            departmentsMap[user.userId] = []
          }
        })
      )
      setUserDepartments(departmentsMap)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách users')
    } finally {
      setLoading(false)
    }
  }

  const validateUserForm = (data) => {
    const errors = {}
    
    // Validate userName
    if (!data.userName || data.userName.trim().length === 0) {
      errors.userName = 'Tên đăng nhập không được để trống'
    } else if (data.userName.trim().length < 3) {
      errors.userName = 'Tên đăng nhập phải có ít nhất 3 ký tự'
    } else if (data.userName.trim().length > 50) {
      errors.userName = 'Tên đăng nhập không được vượt quá 50 ký tự'
    } else if (!/^[a-zA-Z0-9_]+$/.test(data.userName.trim())) {
      errors.userName = 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'
    }
    
    // Validate password
    if (!data.password || data.password.length === 0) {
      errors.password = 'Mật khẩu không được để trống'
    } else if (data.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    } else if (data.password.length > 100) {
      errors.password = 'Mật khẩu không được vượt quá 100 ký tự'
    }
    
    // Validate fullName
    if (!data.fullName || data.fullName.trim().length === 0) {
      errors.fullName = 'Họ và tên không được để trống'
    } else if (data.fullName.trim().length < 2) {
      errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự'
    } else if (data.fullName.trim().length > 100) {
      errors.fullName = 'Họ và tên không được vượt quá 100 ký tự'
    }
    
    // Validate email (optional)
    if (data.email && data.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email.trim())) {
        errors.email = 'Email không hợp lệ'
      }
    }
    
    // Validate phoneNumber (optional)
    if (data.phoneNumber && data.phoneNumber.trim().length > 0) {
      const phoneRegex = /^[0-9]{10,11}$/
      if (!phoneRegex.test(data.phoneNumber.trim())) {
        errors.phoneNumber = 'Số điện thoại phải có 10-11 chữ số'
      }
    }
    
    // Validate roleId
    if (!data.roleId || data.roleId === '') {
      errors.roleId = 'Vui lòng chọn vai trò'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!director || isSubmitting) return

    const formDataToValidate = {
      userName: formData.userName,
      password: formData.password,
      fullName: formData.fullName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      roleId: formData.roleId
    }

    // Validate form
    if (!validateUserForm(formDataToValidate)) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      setValidationErrors({})
      
      // Tạo user mới
      const createUserData = {
        userName: formData.userName.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        email: formData.email?.trim() || null,
        phoneNumber: formData.phoneNumber?.trim() || null,
        roleId: parseInt(formData.roleId)
      }
      
      const createResponse = await userService.createUser(createUserData)
      // UserService đã tự động thêm user vào công ty của director nếu creator là DIRECTOR
      // Không cần gọi addUserToDirector nữa
      
      // Reset form và đóng modal
      setShowAssignModal(false)
      setFormData({
        userName: '',
        password: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        roleId: ''
      })
      setValidationErrors({})
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo nhân viên')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = (user) => {
    setSelectedUser(user)
    // Tìm roleId từ roles list
    const userRole = user.roles && user.roles.length > 0 ? user.roles[0] : null
    const roleId = userRole ? roles.find(r => r.name === userRole)?.id : ''
    
    setEditFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      password: '', // Không hiển thị mật khẩu cũ
      roleId: roleId || ''
    })
    setShowEditModal(true)
    setError('')
  }

  const validateEditUserForm = (data) => {
    const errors = {}
    
    // Validate fullName
    if (!data.fullName || data.fullName.trim().length === 0) {
      errors.fullName = 'Họ và tên không được để trống'
    } else if (data.fullName.trim().length < 2) {
      errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự'
    } else if (data.fullName.trim().length > 100) {
      errors.fullName = 'Họ và tên không được vượt quá 100 ký tự'
    }
    
    // Validate email (optional)
    if (data.email && data.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email.trim())) {
        errors.email = 'Email không hợp lệ'
      }
    }
    
    // Validate phoneNumber (optional)
    if (data.phoneNumber && data.phoneNumber.trim().length > 0) {
      const phoneRegex = /^[0-9]{10,11}$/
      if (!phoneRegex.test(data.phoneNumber.trim())) {
        errors.phoneNumber = 'Số điện thoại phải có 10-11 chữ số'
      }
    }
    
    // Validate password (optional, but if provided must be valid)
    if (data.password && data.password.trim() !== '') {
      if (data.password.length < 6) {
        errors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
      } else if (data.password.length > 100) {
        errors.password = 'Mật khẩu không được vượt quá 100 ký tự'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    if (!selectedUser || isSubmitting) return

    const formDataToValidate = {
      fullName: editFormData.fullName,
      email: editFormData.email,
      phoneNumber: editFormData.phoneNumber,
      password: editFormData.password
    }

    // Validate form
    if (!validateEditUserForm(formDataToValidate)) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      setValidationErrors({})
      
      const updateData = {
        fullName: editFormData.fullName.trim(),
        email: editFormData.email?.trim() || null,
        phoneNumber: editFormData.phoneNumber?.trim() || null
      }
      
      // Chỉ thêm password nếu có nhập
      if (editFormData.password && editFormData.password.trim() !== '') {
        updateData.password = editFormData.password
      }
      
      // Chỉ thêm roleId nếu có thay đổi
      if (editFormData.roleId) {
        updateData.roleId = parseInt(editFormData.roleId)
      }
      
      await userService.updateUser(selectedUser.userId, updateData)
      
      // Reset form và đóng modal
      setShowEditModal(false)
      setSelectedUser(null)
      setEditFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: '',
        roleId: ''
      })
      setValidationErrors({})
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật nhân viên')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveUser = async (user) => {
    if (!director) return
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${user.fullName} khỏi công ty?`)) {
      return
    }

    try {
      await directorService.removeUserFromDirector(director.directorId, user.userId)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xóa user khỏi công ty')
    }
  }

  const handleManageDepartments = (user) => {
    setSelectedUserForDepartment(user)
    const departments = userDepartments[user.userId] || []
    setUserDepartmentIds(departments.map(dept => dept.departmentId))
    setShowDepartmentModal(true)
    setError('')
  }

  const handleUpdateUserDepartments = async () => {
    if (!selectedUserForDepartment || !director) return

    try {
      setIsUpdatingDepartments(true)
      setError('')

      // Lấy danh sách phòng ban hiện tại của user
      const currentDeptResponse = await departmentService.getDepartmentsByUserId(selectedUserForDepartment.userId)
      const currentDepartments = currentDeptResponse.data.result || []
      const currentDeptIds = currentDepartments.map(dept => dept.departmentId)

      // Tìm các phòng ban cần thêm và cần xóa
      const toAdd = userDepartmentIds.filter(id => !currentDeptIds.includes(id))
      const toRemove = currentDeptIds.filter(id => !userDepartmentIds.includes(id))

      // Thêm user vào các phòng ban mới
      await Promise.all(
        toAdd.map(deptId => 
          departmentService.addUserToDepartment(deptId, selectedUserForDepartment.userId)
        )
      )

      // Xóa user khỏi các phòng ban cũ
      await Promise.all(
        toRemove.map(deptId => 
          departmentService.removeUserFromDepartment(deptId, selectedUserForDepartment.userId)
        )
      )

      // Reload data
      await loadUsers()
      setShowDepartmentModal(false)
      setSelectedUserForDepartment(null)
      setUserDepartmentIds([])
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật phòng ban')
    } finally {
      setIsUpdatingDepartments(false)
    }
  }

  const handleExportUserReport = async () => {
    if (!selectedUserForReport) return

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

      const response = await reportService.exportUserReport(
        selectedUserForReport.userId,
        params.startDate,
        params.endDate
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bao_cao_${selectedUserForReport.userName}_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Close modal and reset
      setShowReportModal(false)
      setSelectedUserForReport(null)
      setReportDateRange({ startDate: '', endDate: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xuất báo cáo')
    } finally {
      setExportingReport(false)
    }
  }

  if (loading && users.length === 0) return <LoadingSpinner />

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Quản lý nhân viên</h1>
        <p className="text-sm sm:text-base text-gray-600">Quản lý thông tin và phân quyền nhân viên trong công ty</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Tổng số nhân viên: <span className="font-semibold text-gray-900">{users.length}</span>
          </div>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Thêm nhân viên</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {users.map((user) => {
              const departments = userDepartments[user.userId] || []
              return (
                <div
                key={user.userId}
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-3 hover:shadow-lg transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 mb-0.5">{user.fullName}</h3>
                      <p className="text-xs text-gray-500">@{user.userName}</p>
                    </div>
                    {/* Role Badge */}
                    {user.roles && user.roles.length > 0 && (
                      <div className="ml-2 flex-shrink-0">
                        {user.roles.map((role, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"
                          >
                            {role === 'USER' ? 'Nhân viên' : role === 'MANAGER' ? 'Trưởng phòng' : role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info Grid */}
                  <div className="space-y-1.5 mb-2">
                    {user.email && (
                      <div className="flex items-center space-x-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-600 truncate">{user.email}</span>
                      </div>
                    )}
                    {user.phoneNumber && (
                      <div className="flex items-center space-x-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-xs text-gray-600">{user.phoneNumber}</span>
                      </div>
                    )}
                    {departments.length > 0 && (
                      <div className="flex items-start space-x-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {departments.slice(0, 2).map((dept) => (
                            <span
                              key={dept.departmentId}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                            >
                              {dept.departmentName}
                            </span>
                          ))}
                          {departments.length > 2 && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowDepartmentList(showDepartmentList === user.userId ? null : user.userId)
                                }}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-200"
                              >
                                +{departments.length - 2}
                              </button>
                              
                              {showDepartmentList === user.userId && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowDepartmentList(null)}
                                  />
                                  <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-3">
                                    <div className="text-xs font-semibold text-gray-700 mb-2">Danh sách phòng ban:</div>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                      {departments.map((dept) => (
                                        <div
                                          key={dept.departmentId}
                                          className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-50"
                                        >
                                          <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                          </svg>
                                          <span className="text-xs text-gray-700">{dept.departmentName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {departments.length === 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-xs text-gray-400">Chưa có phòng ban</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleManageDepartments(user)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Thêm
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedUserForReport(user)
                        setShowReportModal(true)
                      }}
                      className="flex items-center space-x-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Xuất báo cáo</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditUser(user)
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
                        handleRemoveUser(user)
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
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tên đầy đủ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tên đăng nhập
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Số điện thoại
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Vai trò
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Phòng ban
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <p className="text-gray-500 text-sm font-medium">Chưa có nhân viên nào</p>
                          <p className="text-gray-400 text-xs mt-1">Nhấn "Thêm nhân viên" để bắt đầu</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const departments = userDepartments[user.userId] || []
                      return (
                        <tr key={user.userId} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{user.fullName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600 font-mono">@{user.userName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-xs truncate" title={user.email || ''}>
                              {user.email || <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{user.phoneNumber || <span className="text-gray-400">-</span>}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles && user.roles.length > 0 ? (
                                user.roles.map((role, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"
                                  >
                                    {role === 'USER' ? 'Nhân viên' : role === 'MANAGER' ? 'Trưởng phòng' : role}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-2 max-w-md">
                              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                {departments.length > 0 ? (
                                  <>
                                    {departments.slice(0, 2).map((dept) => (
                                      <span
                                        key={dept.departmentId}
                                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 whitespace-nowrap hover:bg-green-200 transition-colors"
                                        title={dept.departmentName}
                                      >
                                        {dept.departmentName}
                                      </span>
                                    ))}
                                    {departments.length > 2 && (
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setShowDepartmentList(showDepartmentList === user.userId ? null : user.userId)
                                          }}
                                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors"
                                        >
                                          +{departments.length - 2} phòng ban
                                        </button>
                                        
                                        {showDepartmentList === user.userId && (
                                          <>
                                            <div 
                                              className="fixed inset-0 z-10" 
                                              onClick={() => setShowDepartmentList(null)}
                                            />
                                            <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-3">
                                              <div className="text-xs font-semibold text-gray-700 mb-2">Danh sách phòng ban:</div>
                                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {departments.map((dept) => (
                                                  <div
                                                    key={dept.departmentId}
                                                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-50"
                                                  >
                                                    <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    <span className="text-xs text-gray-700">{dept.departmentName}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400 italic">Chưa có phòng ban</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-end">
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenActionMenu(openActionMenu === user.userId ? null : user.userId)
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Thao tác"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>
                                
                                {openActionMenu === user.userId && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-10" 
                                      onClick={() => setOpenActionMenu(null)}
                                    />
                                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedUserForReport(user)
                                          setShowReportModal(true)
                                          setOpenActionMenu(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Xuất báo cáo</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEditUser(user)
                                          setOpenActionMenu(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Chỉnh sửa</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleManageDepartments(user)
                                          setOpenActionMenu(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span>Quản lý phòng ban</span>
                                      </button>
                                      <div className="border-t border-gray-200 my-1"></div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveUser(user)
                                          setOpenActionMenu(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Xóa</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage + 1}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page - 1)}
              />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowAssignModal(false)
            setFormData({
              userName: '',
              password: '',
              fullName: '',
              email: '',
              phoneNumber: '',
              roleId: ''
            })
            setError('')
          }
        }}
        title="Tạo nhân viên mới"
        size="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập *
            </label>
            <input
              type="text"
              required
              value={formData.userName}
              onChange={(e) => {
                setFormData({ ...formData, userName: e.target.value })
                if (validationErrors.userName) {
                  setValidationErrors({ ...validationErrors, userName: '' })
                }
              }}
              placeholder="Nhập tên đăng nhập"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.userName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={50}
            />
            {validationErrors.userName && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.userName}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value })
                if (validationErrors.password) {
                  setValidationErrors({ ...validationErrors, password: '' })
                }
              }}
              placeholder="Nhập mật khẩu"
              minLength={6}
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.password ? (
              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Mật khẩu tối thiểu 6 ký tự</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => {
                setFormData({ ...formData, fullName: e.target.value })
                if (validationErrors.fullName) {
                  setValidationErrors({ ...validationErrors, fullName: '' })
                }
              }}
              placeholder="Nhập họ và tên"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.fullName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {validationErrors.fullName && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value })
                if (validationErrors.email) {
                  setValidationErrors({ ...validationErrors, email: '' })
                }
              }}
              placeholder="Nhập email (tùy chọn)"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => {
                // Chỉ cho phép nhập số
                const value = e.target.value.replace(/[^0-9]/g, '')
                setFormData({ ...formData, phoneNumber: value })
                if (validationErrors.phoneNumber) {
                  setValidationErrors({ ...validationErrors, phoneNumber: '' })
                }
              }}
              placeholder="Nhập số điện thoại (tùy chọn)"
              maxLength={11}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.phoneNumber}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vai trò *
            </label>
            <select
              required
              value={formData.roleId}
              onChange={(e) => {
                setFormData({ ...formData, roleId: e.target.value })
                if (validationErrors.roleId) {
                  setValidationErrors({ ...validationErrors, roleId: '' })
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.roleId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">-- Chọn vai trò --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name === 'USER' ? 'Nhân viên' : role.name === 'MANAGER' ? 'Trưởng phòng' : role.name}
                </option>
              ))}
            </select>
            {validationErrors.roleId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.roleId}</p>
            )}
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
                if (!isSubmitting) {
                  setShowAssignModal(false)
                  setFormData({
                    userName: '',
                    password: '',
                    fullName: '',
                    email: '',
                    phoneNumber: '',
                    roleId: ''
                  })
                  setError('')
                }
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isSubmitting ? 'Đang tạo...' : 'Tạo nhân viên'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowEditModal(false)
            setSelectedUser(null)
            setEditFormData({
              fullName: '',
              email: '',
              phoneNumber: '',
              password: '',
              roleId: ''
            })
            setError('')
          }
        }}
        title="Chỉnh sửa nhân viên"
        size="lg"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={selectedUser?.userName || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Tên đăng nhập không thể thay đổi</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={editFormData.fullName}
              onChange={(e) => {
                setEditFormData({ ...editFormData, fullName: e.target.value })
                if (validationErrors.fullName) {
                  setValidationErrors({ ...validationErrors, fullName: '' })
                }
              }}
              placeholder="Nhập họ và tên"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.fullName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {validationErrors.fullName && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={editFormData.email}
              onChange={(e) => {
                setEditFormData({ ...editFormData, email: e.target.value })
                if (validationErrors.email) {
                  setValidationErrors({ ...validationErrors, email: '' })
                }
              }}
              placeholder="Nhập email (tùy chọn)"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={editFormData.phoneNumber}
              onChange={(e) => {
                // Chỉ cho phép nhập số
                const value = e.target.value.replace(/[^0-9]/g, '')
                setEditFormData({ ...editFormData, phoneNumber: value })
                if (validationErrors.phoneNumber) {
                  setValidationErrors({ ...validationErrors, phoneNumber: '' })
                }
              }}
              placeholder="Nhập số điện thoại (tùy chọn)"
              maxLength={11}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.phoneNumber}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={editFormData.password}
              onChange={(e) => {
                setEditFormData({ ...editFormData, password: e.target.value })
                if (validationErrors.password) {
                  setValidationErrors({ ...validationErrors, password: '' })
                }
              }}
              placeholder="Để trống nếu không muốn thay đổi"
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.password ? (
              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Chỉ nhập nếu muốn thay đổi mật khẩu (tối thiểu 6 ký tự)</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vai trò *
            </label>
            <select
              required
              value={editFormData.roleId}
              onChange={(e) => setEditFormData({ ...editFormData, roleId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Chọn vai trò --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name === 'USER' ? 'Nhân viên' : role.name === 'MANAGER' ? 'Trưởng phòng' : role.name}
                </option>
              ))}
            </select>
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
                if (!isSubmitting) {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  setEditFormData({
                    fullName: '',
                    email: '',
                    phoneNumber: '',
                    password: '',
                    roleId: ''
                  })
                  setError('')
                }
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Export Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => {
          if (!exportingReport) {
            setShowReportModal(false)
            setSelectedUserForReport(null)
            setReportDateRange({ startDate: '', endDate: '' })
            setError('')
          }
        }}
        title={`Xuất báo cáo - ${selectedUserForReport?.fullName || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Nhân viên:</strong> {selectedUserForReport?.fullName} (@{selectedUserForReport?.userName})
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Báo cáo sẽ bao gồm thông tin chi tiết về các công việc được giao cho nhân viên này.
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
                  setSelectedUserForReport(null)
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
              onClick={handleExportUserReport}
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

      {/* Manage Departments Modal */}
      <Modal
        isOpen={showDepartmentModal}
        onClose={() => {
          if (!isUpdatingDepartments) {
            setShowDepartmentModal(false)
            setSelectedUserForDepartment(null)
            setUserDepartmentIds([])
            setError('')
          }
        }}
        title={`Quản lý phòng ban - ${selectedUserForDepartment?.fullName || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Nhân viên:</strong> {selectedUserForDepartment?.fullName} (@{selectedUserForDepartment?.userName})
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Chọn các phòng ban mà nhân viên này thuộc về. Nhân viên có thể thuộc nhiều phòng ban.
            </p>
          </div>

          {allDepartments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Chưa có phòng ban nào trong công ty</p>
              <p className="text-xs mt-1">Vui lòng tạo phòng ban trước khi gán cho nhân viên</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allDepartments.map((dept) => (
                <label
                  key={dept.departmentId}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={userDepartmentIds.includes(dept.departmentId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setUserDepartmentIds([...userDepartmentIds, dept.departmentId])
                      } else {
                        setUserDepartmentIds(userDepartmentIds.filter(id => id !== dept.departmentId))
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{dept.departmentName}</div>
                    {dept.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{dept.description}</div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                if (!isUpdatingDepartments) {
                  setShowDepartmentModal(false)
                  setSelectedUserForDepartment(null)
                  setUserDepartmentIds([])
                  setError('')
                }
              }}
              disabled={isUpdatingDepartments}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              onClick={handleUpdateUserDepartments}
              disabled={isUpdatingDepartments || allDepartments.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isUpdatingDepartments && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isUpdatingDepartments ? 'Đang cập nhật...' : 'Cập nhật'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CompanyUsersPage

