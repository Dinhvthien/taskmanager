import { useState, useEffect } from 'react'
import { departmentService } from '../../services/departmentService'
import { directorService } from '../../services/directorService'
import { userService } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState([])
  const [directors, setDirectors] = useState([])
  const [users, setUsers] = useState([])
  const [selectedDirector, setSelectedDirector] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    directorId: '',
    departmentName: '',
    description: '',
    managerId: ''
  })

  useEffect(() => {
    loadDirectors()
  }, [])

  useEffect(() => {
    if (selectedDirector) {
      loadDepartments()
      loadUsers()
    }
  }, [selectedDirector])

  const loadUsers = async (directorId) => {
    const targetDirectorId = directorId || selectedDirector
    if (!targetDirectorId) return
    
    try {
      const response = await userService.getUsersByDirectorId(targetDirectorId, 0, 100)
      setUsers(response.data.result?.content || [])
    } catch (err) {
      console.error('Error loading users:', err)
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

  const loadDepartments = async () => {
    if (!selectedDirector) return

    try {
      setLoading(true)
      const response = await departmentService.getDepartmentsByDirectorId(selectedDirector)
      setDepartments(response.data.result || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách departments')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await departmentService.createDepartment({
        ...formData,
        directorId: parseInt(formData.directorId),
        managerId: formData.managerId ? parseInt(formData.managerId) : null
      })
      setShowCreateModal(false)
      setFormData({
        directorId: '',
        departmentName: '',
        description: '',
        managerId: ''
      })
      loadDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo department')
    }
  }

  if (loading && departments.length === 0) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Phòng ban</h1>
          <p className="text-gray-600 mt-1">Quản lý tất cả phòng ban trong hệ thống</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Tạo phòng ban
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.departmentId} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900">{dept.departmentName}</h3>
            {dept.description && (
              <p className="text-sm text-gray-600 mt-2">{dept.description}</p>
            )}
            {dept.managerName && (
              <div className="text-sm text-gray-600 mt-4">
                <span className="font-medium">Trưởng phòng:</span> {dept.managerName}
              </div>
            )}
          </div>
        ))}
      </div>

      {departments.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Chưa có phòng ban nào</p>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo phòng ban mới"
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
                setFormData({ ...formData, directorId: e.target.value, managerId: '' })
                setSelectedDirector(newDirectorId)
                loadUsers(newDirectorId)
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
              Tên phòng ban *
            </label>
            <input
              type="text"
              required
              value={formData.departmentName}
              onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trưởng phòng
            </label>
            <select
              value={formData.managerId}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Tạo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default DepartmentsPage

