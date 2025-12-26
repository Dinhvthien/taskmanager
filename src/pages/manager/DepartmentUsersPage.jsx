import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { departmentService } from '../../services/departmentService'
import { roleService } from '../../services/roleService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const DepartmentUsersPage = () => {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [departmentInfo, setDepartmentInfo] = useState(null)
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [addMode, setAddMode] = useState('select') // 'select' or 'create'
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roles, setRoles] = useState([])
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: ''
  })
  const [createFormData, setCreateFormData] = useState({
    userName: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: ''
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    if (departmentsLoaded && selectedDepartment) {
      loadUsers()
      loadDepartmentInfo()
      loadAvailableUsers()
    } else if (departmentsLoaded && !selectedDepartment) {
      // Nếu đã load departments xong nhưng không có department nào, set loading = false
      setLoading(false)
    }
  }, [selectedDepartment, departmentsLoaded])

  useEffect(() => {
    loadRoles()
  }, [])

  const loadDepartments = async () => {
    try {
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      const response = await departmentService.getDepartmentsByManagerId(user.userId)
      const depts = response.data.result || []
      setDepartments(depts)
      if (depts.length > 0) {
        setSelectedDepartment(depts[0].departmentId)
      }
    } catch (err) {
      setError('Lỗi khi tải danh sách departments')
      setDepartments([])
    } finally {
      setDepartmentsLoaded(true)
    }
  }

  const loadUsers = async () => {
    if (!selectedDepartment) return

    try {
      setLoading(true)
      setError('')
      
      // Lấy users với thông tin đầy đủ từ department
      const response = await departmentService.getUsersWithDetailsByDepartmentId(selectedDepartment)
      const usersList = response.data?.result || []
      setUsers(usersList)
    } catch (err) {
      console.error('Error in loadUsers:', err)
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách users')
      setUsers([])
    } finally {
    setLoading(false)
    }
  }

  const loadDepartmentInfo = async () => {
    if (!selectedDepartment) return

    try {
      const response = await departmentService.getDepartmentById(selectedDepartment)
      setDepartmentInfo(response.data.result)
    } catch (err) {
      console.error('Error loading department info:', err)
    }
  }

  const loadAvailableUsers = async () => {
    if (!selectedDepartment) return

    try {
      // Lấy thông tin department để có directorId
      const deptResponse = await departmentService.getDepartmentById(selectedDepartment)
      const dept = deptResponse.data.result
      
      if (!dept || !dept.directorId) return

      // Lấy tất cả users từ công ty của director
      const usersResponse = await userService.getUsersByDirectorId(dept.directorId, 0, 1000)
      const allUsers = usersResponse.data.result?.content || []
      
      // Lọc chỉ USER và MANAGER roles
      const filteredUsers = allUsers.filter(user => 
        user.roles && (user.roles.includes('USER') || user.roles.includes('MANAGER'))
      )
      
      // Lấy danh sách userIds đã có trong department
      const deptUsersResponse = await departmentService.getUsersByDepartmentId(selectedDepartment)
      const deptUserIds = deptUsersResponse.data.result || []
      
      // Lọc ra những users chưa có trong department
      const available = filteredUsers.filter(user => !deptUserIds.includes(user.userId))
      
      setAvailableUsers(available)
    } catch (err) {
      console.error('Error loading available users:', err)
      setAvailableUsers([])
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

  const handleAddUser = async () => {
    if (!selectedDepartment) return

    if (addMode === 'select') {
      if (!selectedUserId) {
        setError('Vui lòng chọn nhân viên')
        return
      }

    try {
      await departmentService.addUserToDepartment(selectedDepartment, parseInt(selectedUserId))
      setShowAddModal(false)
      setSelectedUserId('')
        setAddMode('select')
      loadUsers()
        loadAvailableUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi thêm user vào phòng ban')
      }
    } else {
      // Create new user
      if (!createFormData.userName || !createFormData.password || !createFormData.fullName) {
        setError('Vui lòng điền đầy đủ thông tin bắt buộc')
        return
      }

      if (!departmentInfo || !departmentInfo.directorId) {
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
          userName: createFormData.userName,
          password: createFormData.password,
          fullName: createFormData.fullName,
          email: createFormData.email || null,
          phoneNumber: createFormData.phoneNumber || null,
          roleId: userRole.id
        }
        
        const createResponse = await userService.createUser(createUserData)
        const newUserId = createResponse.data.result.userId
        
        // Thêm user mới vào department
        await departmentService.addUserToDepartment(selectedDepartment, newUserId)
        
        setShowAddModal(false)
        setAddMode('select')
        setCreateFormData({
          userName: '',
          password: '',
          fullName: '',
          email: '',
          phoneNumber: ''
        })
        loadUsers()
        loadAvailableUsers()
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi tạo nhân viên mới')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleEditUser = (user) => {
    setSelectedUser(user)
    setEditFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      password: '' // Không hiển thị mật khẩu cũ
    })
    setShowEditModal(true)
    setError('')
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    if (!selectedUser || isSubmitting) return

    try {
      setIsSubmitting(true)
      setError('')
      
      const updateData = {
        fullName: editFormData.fullName,
        email: editFormData.email || null,
        phoneNumber: editFormData.phoneNumber || null
      }
      
      // Chỉ thêm password nếu có nhập
      if (editFormData.password && editFormData.password.trim() !== '') {
        updateData.password = editFormData.password
      }
      
      await userService.updateUser(selectedUser.userId, updateData)
      
      // Reset form và đóng modal
      setShowEditModal(false)
      setSelectedUser(null)
      setEditFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: ''
      })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật nhân viên')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveUser = async (user) => {
    if (!selectedDepartment) return
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${user.fullName} khỏi phòng ban?`)) {
      return
    }

    try {
      await departmentService.removeUserFromDepartment(selectedDepartment, user.userId)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xóa user khỏi phòng ban')
    }
  }

  if (loading && users.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center space-x-2"
        >
          + Thêm nhân viên
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {departments.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn phòng ban
          </label>
          <select
            value={selectedDepartment || ''}
            onChange={(e) => setSelectedDepartment(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {departments.map((dept) => (
              <option key={dept.departmentId} value={dept.departmentId}>
                {dept.departmentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có nhân viên nào trong phòng ban này</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tên đầy đủ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tên đăng nhập
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Số điện thoại
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Vai trò
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">@{user.userName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{user.email || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{user.phoneNumber || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? (
                              user.roles.map((role, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {role === 'USER' ? 'Nhân viên' : role === 'MANAGER' ? 'Trưởng phòng' : role}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              onClick={() => handleRemoveUser(user)}
                              className="text-red-600 hover:text-red-900 transition-colors"
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
          )}
        </>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowAddModal(false)
            setAddMode('select')
            setSelectedUserId('')
            setCreateFormData({
              userName: '',
              password: '',
              fullName: '',
              email: '',
              phoneNumber: ''
            })
            setError('')
          }
        }}
        title="Thêm nhân viên vào phòng ban"
        size="lg"
      >
        <div className="space-y-4">
          {/* Tab selection */}
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setAddMode('select')
                setError('')
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                addMode === 'select'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chọn nhân viên có sẵn
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('create')
                setError('')
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                addMode === 'create'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tạo nhân viên mới
            </button>
          </div>

          {addMode === 'select' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chọn nhân viên *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {availableUsers.map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.fullName} (@{user.userName}) - {user.roles?.includes('MANAGER') ? 'Trưởng phòng' : 'Nhân viên'}
                    </option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Không còn nhân viên nào để thêm vào phòng ban này</p>
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
                  value={createFormData.userName}
                  onChange={(e) => setCreateFormData({ ...createFormData, userName: e.target.value })}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  required
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  placeholder="Nhập mật khẩu"
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  value={createFormData.fullName}
                  onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                  placeholder="Nhập họ và tên"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder="Nhập email (tùy chọn)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={createFormData.phoneNumber}
                  onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                  placeholder="Nhập số điện thoại (tùy chọn)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  setShowAddModal(false)
                  setAddMode('select')
                  setSelectedUserId('')
                  setCreateFormData({
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang xử lý...' : addMode === 'select' ? 'Thêm' : 'Tạo và thêm'}
            </button>
          </div>
        </div>
      </Modal>

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
              password: ''
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
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={editFormData.fullName}
              onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
              placeholder="Nhập họ và tên"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              placeholder="Nhập email (tùy chọn)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={editFormData.phoneNumber}
              onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
              placeholder="Nhập số điện thoại (tùy chọn)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={editFormData.password}
              onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
              placeholder="Để trống nếu không muốn thay đổi"
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Để trống nếu không muốn thay đổi mật khẩu. Tối thiểu 6 ký tự nếu có thay đổi.</p>
          </div>

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
                  setShowEditModal(false)
                  setSelectedUser(null)
                  setEditFormData({
                    fullName: '',
                    email: '',
                    phoneNumber: '',
                    password: ''
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
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default DepartmentUsersPage

