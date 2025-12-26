import { useState } from 'react'
import Modal from './Modal'
import { TASK_RATING, TASK_RATING_LABELS } from '../utils/constants'

const EvaluationModal = ({ isOpen, onClose, taskId, onEvaluate }) => {
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) {
      setError('Vui lòng chọn đánh giá')
      return
    }

    try {
      await onEvaluate({
        taskId: parseInt(taskId),
        rating,
        comment: comment.trim() || undefined
      })
      setRating('')
      setComment('')
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tạo đánh giá')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đánh giá task"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Đánh giá *
          </label>
          <div className="space-y-2">
            {Object.values(TASK_RATING).map((rate) => (
              <label
                key={rate}
                className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="rating"
                  value={rate}
                  checked={rating === rate}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">
                  {TASK_RATING_LABELS[rate]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nhận xét
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Nhập nhận xét về task..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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
            Tạo đánh giá
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default EvaluationModal

