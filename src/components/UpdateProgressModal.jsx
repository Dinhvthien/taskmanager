import { useState, useEffect } from 'react'
import Modal from './Modal'

const UpdateProgressModal = ({ isOpen, onClose, currentProgress, onUpdate }) => {
  const [progress, setProgress] = useState(currentProgress || 0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setProgress(currentProgress || 0)
    }
  }, [isOpen, currentProgress])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (progress < 0 || progress > 100) {
      setError('Tiến độ phải từ 0 đến 100')
      return
    }

    try {
      await onUpdate(progress)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật tiến độ')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cập nhật tiến độ"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tiến độ: {progress}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
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
            Cập nhật
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default UpdateProgressModal

