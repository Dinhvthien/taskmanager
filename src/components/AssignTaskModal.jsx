import { useState, useEffect } from 'react'
import { userService } from '../services/userService'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'

const AssignTaskModal = ({ isOpen, onClose, taskId, onAssign }) => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await userService.getAllUsers(0, 100)
      setUsers(response.data.result?.content || [])
    } catch (err) {
      setError('Lỗi khi tải danh sách users')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedUserIds.length === 0) {
      setError('Vui lòng chọn ít nhất một user')
      return
    }

    try {
      await onAssign({
        taskId: parseInt(taskId),
        userIds: selectedUserIds.map(id => parseInt(id))
      })
      setSelectedUserIds([])
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi gán task')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gán task cho users"
      size="lg"
    >
      {loading ? (
        <LoadingSpinner size="sm" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
            {users.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Không có user nào</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <label
                    key={user.userId}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.userId)}
                      onChange={() => handleToggleUser(user.userId)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.fullName}</p>
                      <p className="text-sm text-gray-600">@{user.userName}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Gán task
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default AssignTaskModal

