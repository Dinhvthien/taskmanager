import { useState, useEffect } from 'react'
import { departmentService } from '../../services/departmentService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const DepartmentInfoPage = () => {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [formData, setFormData] = useState({
    departmentName: '',
    description: '',
    managerId: ''
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      setLoading(true)
      const userStr = localStorage.getItem('user')
      const user = JSON.parse(userStr)
      const response = await departmentService.getDepartmentsByManagerId(user.userId)
      setDepartments(response.data.result || [])
    } catch (err) {
      setError('Lỗi khi tải danh sách departments')
    } finally {
      setLoading(false)
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
    if (!selectedDepartment) return

    try {
      await departmentService.updateDepartment(selectedDepartment.departmentId, {
        ...formData,
        managerId: formData.managerId ? parseInt(formData.managerId) : null
      })
      setShowEditModal(false)
      setSelectedDepartment(null)
      loadDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật department')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="mb-6">
        <p className="text-gray-600 mt-1">Quản lý thông tin các phòng ban bạn quản lý</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.departmentId} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">{dept.departmentName}</h3>
                {dept.description && (
                  <p className="text-sm text-gray-600 mt-2">{dept.description}</p>
                )}
              </div>
              <button
                onClick={() => handleEdit(dept)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            {dept.managerName && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Trưởng phòng:</span> {dept.managerName}
              </div>
            )}
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Bạn chưa quản lý phòng ban nào</p>
        </div>
      )}

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
              onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Cập nhật
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default DepartmentInfoPage

