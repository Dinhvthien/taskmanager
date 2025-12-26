import { useState, useEffect } from 'react'
import { directorService } from '../../services/directorService'
import { userService } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const DirectorsPage = () => {
  const [directors, setDirectors] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    companyName: '',
    companyCode: '',
    description: '',
    address: '',
    phoneNumber: '',
    email: ''
  })

  useEffect(() => {
    loadDirectors()
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await userService.getAllUsers(0, 100)
      const result = response.data.result
      setUsers(result.content || [])
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadDirectors = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await directorService.getAllDirectors()
      setDirectors(response.data.result || [])
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Lỗi khi tải danh sách directors'
      setError(errorMessage)
      console.error('Error loading directors:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    
    if (!formData.userId) {
      setError('Vui lòng chọn user')
      return
    }
    
    try {
      setError('')
      // Gửi userId trong request để Super Admin có thể tạo director cho user khác
      const requestData = {
        ...formData,
        userId: parseInt(formData.userId)
      }
      await directorService.createDirector(requestData)
      setShowCreateModal(false)
      setFormData({
        userId: '',
        companyName: '',
        companyCode: '',
        description: '',
        address: '',
        phoneNumber: '',
        email: ''
      })
      loadDirectors()
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Lỗi khi tạo director'
      setError(errorMessage)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Thêm Director
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
              <p className="text-sm text-red-700 font-medium whitespace-pre-line">{error}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {directors.map((director) => (
          <div key={director.directorId} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900">{director.companyName}</h3>
            <p className="text-sm text-gray-600 mt-1">Mã: {director.companyCode}</p>
            {director.description && (
              <p className="text-sm text-gray-600 mt-2">{director.description}</p>
            )}
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              {director.email && <p>Email: {director.email}</p>}
              {director.phoneNumber && <p>Điện thoại: {director.phoneNumber}</p>}
              {director.address && <p>Địa chỉ: {director.address}</p>}
            </div>
          </div>
        ))}
      </div>

      {directors.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Chưa có director nào</p>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo Director mới"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn User (người sẽ trở thành Director) *
            </label>
            <select
              required
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Chọn User --</option>
              {users
                .filter(user => {
                  // Lọc bỏ các user đã có director
                  return !directors.some(dir => dir.userId === user.userId)
                })
                .map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName} (@{user.userName}) - {user.email}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Chọn user sẽ trở thành Director. Super Admin có thể tạo director cho bất kỳ user nào.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên công ty *
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã công ty *
            </label>
            <input
              type="text"
              required
              value={formData.companyCode}
              onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
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
              Email
            </label>
            <input
              type="email"
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
              Địa chỉ
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
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

export default DirectorsPage

