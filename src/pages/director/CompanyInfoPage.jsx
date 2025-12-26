import { useState, useEffect } from 'react'
import { directorService } from '../../services/directorService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const CompanyInfoPage = () => {
  const [director, setDirector] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    description: '',
    address: '',
    phoneNumber: '',
    email: ''
  })

  useEffect(() => {
    loadDirector()
  }, [])

  const loadDirector = async () => {
    try {
      setLoading(true)
      const response = await directorService.getMyDirector()
      const data = response.data.result
      setDirector(data)
      setFormData({
        companyName: data.companyName || '',
        companyCode: data.companyCode || '',
        description: data.description || '',
        address: data.address || '',
        phoneNumber: data.phoneNumber || '',
        email: data.email || ''
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thông tin công ty')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      await directorService.updateDirector(director.directorId, formData)
      setShowEditModal(false)
      loadDirector()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật thông tin công ty')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  if (loading) return <LoadingSpinner />

  if (!director) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Chưa có thông tin công ty</p>
        <button
          onClick={() => setShowEditModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tạo thông tin công ty
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Thông tin công ty</h1>
          <p className="text-gray-600 mt-1">Quản lý thông tin công ty của bạn</p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Chỉnh sửa
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{director.companyName}</h3>
            <p className="text-sm text-gray-600">Mã công ty: {director.companyCode}</p>
          </div>

          {director.description && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Mô tả</h4>
              <p className="text-gray-600">{director.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {director.email && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Email</h4>
                <p className="text-gray-600">{director.email}</p>
              </div>
            )}
            {director.phoneNumber && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Điện thoại</h4>
                <p className="text-gray-600">{director.phoneNumber}</p>
              </div>
            )}
            {director.address && (
              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-700 mb-1">Địa chỉ</h4>
                <p className="text-gray-600">{director.address}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 text-sm text-gray-500">
            <p>Ngày tạo: {formatDate(director.createdAt)}</p>
            {director.updatedAt && <p>Cập nhật: {formatDate(director.updatedAt)}</p>}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Chỉnh sửa thông tin công ty"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên công ty *
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
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
    </div>
  )
}

export default CompanyInfoPage

