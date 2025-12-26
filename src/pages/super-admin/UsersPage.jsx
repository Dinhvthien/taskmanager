import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { roleService } from '../../services/roleService'
import UserCard from '../../components/UserCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { ROLE_LABELS } from '../../utils/constants'

const UsersPage = () => {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    userName: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    roleId: ''
  })

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [])

  useEffect(() => {
    loadUsers()
  }, [currentPage])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Kiểm tra token trước
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.')
        return
      }
      
      const response = await userService.getAllUsers(currentPage, 20)
      const result = response.data.result
      
      // Xử lý cả trường hợp result là Page hoặc List
      if (result && result.content) {
        // Page response
        setUsers(result.content || [])
        setTotalPages(result.totalPages || 1)
      } else if (Array.isArray(result)) {
        // List response
        setUsers(result)
        setTotalPages(1)
      } else {
        setUsers([])
        setTotalPages(1)
      }
    } catch (err) {
      console.error('Error loading users:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Lỗi khi tải danh sách users'
      setError(errorMessage)
      
      // Nếu là lỗi 403, có thể user không có quyền
      if (err.response?.status === 403) {
        const userStr = localStorage.getItem('user')
        if (userStr) {
          try {
            const user = JSON.parse(userStr)
            console.log('Current user roles:', user.roles)
          } catch (e) {
            console.error('Error parsing user:', e)
          }
        }
      }
      
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await roleService.getAllRoles()
      setRoles(response.data.result || [])
    } catch (err) {
      console.error('Error loading roles:', err)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.roleId) {
      setError('Vui lòng chọn chức vụ cho user')
      return
    }
    try {
      const createUserData = {
        ...formData,
        roleId: parseInt(formData.roleId)
      }
      await userService.createUser(createUserData)
      setShowCreateModal(false)
      setFormData({
        userName: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        password: '',
        roleId: ''
      })
      setError('')
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo user')
    }
  }

  const handleEdit = (user) => {
    setSelectedUser(user)
    setFormData({
      userName: user.userName,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || '',
      password: '',
      roleId: ''
    })
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      await userService.updateUser(selectedUser.userId, formData)
      setShowEditModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật user')
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa user ${user.fullName}?`)) {
      return
    }

    try {
      await userService.deleteUser(user.userId)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi xóa user')
    }
  }

  if (loading && users.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Thêm User
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
                  Vui lòng đăng nhập lại hoặc liên hệ quản trị viên
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

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {users && users.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user) => (
                <UserCard
                  key={user.userId || user.userName || Math.random()}
                  user={user}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có user nào</p>
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setError('')
        }}
        title="Tạo User mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập *
            </label>
            <input
              type="text"
              required
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Điện thoại
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
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
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chức vụ *
            </label>
            <select
              required
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Chọn chức vụ --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {ROLE_LABELS[role.name] || role.name}
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
          setSelectedUser(null)
        }}
        title="Chỉnh sửa User"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Điện thoại
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới (để trống nếu không đổi)
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setSelectedUser(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Cập nhật
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UsersPage

