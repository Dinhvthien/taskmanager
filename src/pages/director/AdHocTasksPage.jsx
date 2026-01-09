import { useState, useEffect } from 'react'
import dailyReportService from '../../services/dailyReportService'
import { directorEvaluationService } from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import { CheckIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'
import Modal from '../../components/Modal'

const AdHocTasksPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adHocTasks, setAdHocTasks] = useState([])
  const [filter, setFilter] = useState('pending') // 'pending', 'approved', 'rejected', 'all'
  const [evaluatingTask, setEvaluatingTask] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [editFormData, setEditFormData] = useState({
    content: '',
    comment: '',
    selfScore: null
  })
  const [evaluationData, setEvaluationData] = useState({
    rating: 'GOOD',
    comment: '',
    approved: false,
    approvedScore: null
  })

  useEffect(() => {
    loadAdHocTasks()
  }, [])

  const loadAdHocTasks = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await dailyReportService.getPendingAdHocTasks()
      const tasks = Array.isArray(response.data?.result) ? response.data.result : []
      setAdHocTasks(tasks)
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách công việc phát sinh')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (adHocTask) => {
    if (!evaluationData.approvedScore || evaluationData.approvedScore <= 0) {
      setError('Vui lòng nhập điểm được duyệt (phải lớn hơn 0)')
      return
    }

    try {
      setError('')
      const data = {
        adHocTaskId: adHocTask.adHocTaskId,
        rating: evaluationData.rating,
        comment: evaluationData.comment || '',
        approved: true,
        approvedScore: evaluationData.approvedScore
      }
      
      await directorEvaluationService.saveAdHocTaskEvaluation(adHocTask.reportId, data)
      setEvaluatingTask(null)
      setEvaluationData({
        rating: 'GOOD',
        comment: '',
        approved: false,
        approvedScore: null
      })
      loadAdHocTasks() // Reload danh sách
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi duyệt công việc phát sinh')
    }
  }

  const handleReject = async (adHocTask) => {
    try {
      setError('')
      const data = {
        adHocTaskId: adHocTask.adHocTaskId,
        rating: evaluationData.rating,
        comment: evaluationData.comment || '',
        approved: false,
        approvedScore: null
      }
      
      await directorEvaluationService.saveAdHocTaskEvaluation(adHocTask.reportId, data)
      setEvaluatingTask(null)
      setEvaluationData({
        rating: 'GOOD',
        comment: '',
        approved: false,
        approvedScore: null
      })
      loadAdHocTasks() // Reload danh sách
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi đánh giá công việc phát sinh')
    }
  }

  const getFilteredTasks = () => {
    if (filter === 'pending') {
      // Chưa được đánh giá (không có directorRating và directorComment)
      return adHocTasks.filter(task => !task.approved && !task.directorRating && !task.directorComment)
    } else if (filter === 'approved') {
      return adHocTasks.filter(task => task.approved)
    } else if (filter === 'rejected') {
      // Đã được đánh giá nhưng không được duyệt (có directorRating hoặc directorComment nhưng approved = false)
      return adHocTasks.filter(task => !task.approved && (task.directorRating || task.directorComment))
    }
    return adHocTasks
  }

  const handleQuickReject = async (adHocTask) => {
    if (!window.confirm('Bạn có chắc chắn muốn từ chối công việc phát sinh này?')) {
      return
    }

    try {
      setError('')
      const data = {
        adHocTaskId: adHocTask.adHocTaskId,
        rating: 'AVERAGE',
        comment: 'Từ chối',
        approved: false,
        approvedScore: null
      }
      
      await directorEvaluationService.saveAdHocTaskEvaluation(adHocTask.reportId, data)
      loadAdHocTasks() // Reload danh sách
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi từ chối công việc phát sinh')
    }
  }

  const handleStartEdit = (task) => {
    setEditingTask(task)
    setEditFormData({
      content: task.content || '',
      comment: task.comment || '',
      selfScore: task.selfScore || null
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return

    // Note: Backend có thể không có API để update ad-hoc task, nên tạm thời chỉ hiển thị thông báo
    // Nếu cần, sẽ cần thêm API mới
    setError('Chức năng chỉnh sửa công việc phát sinh đang được phát triển')
    setEditingTask(null)
  }

  const getRatingLabel = (rating) => {
    const ratingMap = {
      'EXCELLENT': 'Xuất sắc',
      'GOOD': 'Tốt',
      'AVERAGE': 'Trung bình',
      'POOR': 'Kém'
    }
    return ratingMap[rating] || rating
  }

  const getRatingColor = (rating) => {
    const colorMap = {
      'EXCELLENT': 'bg-green-100 text-green-800 border-green-300',
      'GOOD': 'bg-blue-100 text-blue-800 border-blue-300',
      'AVERAGE': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'POOR': 'bg-red-100 text-red-800 border-red-300'
    }
    return colorMap[rating] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const filteredTasks = getFilteredTasks()

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Công việc phát sinh</h1>

        {error && <ErrorMessage message={error} />}

        {/* Filter tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${
              filter === 'pending'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chờ duyệt ({adHocTasks.filter(t => !t.approved && !t.directorRating && !t.directorComment).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${
              filter === 'approved'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Đã duyệt ({adHocTasks.filter(t => t.approved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${
              filter === 'rejected'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Từ chối ({adHocTasks.filter(t => !t.approved && (t.directorRating || t.directorComment)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${
              filter === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tất cả ({adHocTasks.length})
          </button>
        </div>

        {/* Danh sách công việc phát sinh */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">Không có công việc phát sinh nào</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {filteredTasks.map((task) => {
              const isRejected = !task.approved && (task.directorRating || task.directorComment)
              const isPending = !task.approved && !task.directorRating && !task.directorComment
              
              return (
                <div
                  key={task.adHocTaskId}
                  className={`border rounded-lg p-5 shadow-sm transition-all hover:shadow-md ${
                    task.approved 
                      ? 'bg-green-50 border-green-200' 
                      : isRejected 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-base">{task.content}</h3>
                        {task.approved && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Đã duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                            Từ chối
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            Chờ duyệt
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1.5">
                        <p className="flex items-center gap-2">
                          <span className="font-medium">Nhân viên:</span>
                          <span>{task.userFullName} ({task.userName})</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-medium">Ngày báo cáo:</span>
                          <span>{new Date(task.reportDate).toLocaleDateString('vi-VN')}</span>
                        </p>
                        {task.comment && (
                          <p className="flex items-start gap-2">
                            <span className="font-medium">Comment:</span>
                            <span className="flex-1">{task.comment}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <span className="font-medium">Điểm tự chấm:</span>
                          <span>{task.selfScore ? `${task.selfScore} giờ` : 'Chưa có'}</span>
                        </p>
                        {task.approved && task.approvedScore && (
                          <p className="flex items-center gap-2 text-green-700">
                            <span className="font-medium">Điểm được duyệt:</span>
                            <span className="font-semibold">{task.approvedScore} giờ</span>
                          </p>
                        )}
                        {task.directorRating && (
                          <p className="flex items-center gap-2">
                            <span className="font-medium">Đánh giá:</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getRatingColor(task.directorRating)}`}>
                              {getRatingLabel(task.directorRating)}
                            </span>
                          </p>
                        )}
                        {task.directorComment && (
                          <p className="flex items-start gap-2">
                            <span className="font-medium">Ghi chú GĐ:</span>
                            <span className="flex-1">{task.directorComment}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(task)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickReject(task)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluatingTask(task)
                            setEvaluationData({
                              rating: 'GOOD',
                              comment: '',
                              approved: false,
                              approvedScore: task.selfScore || null
                            })
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Duyệt
                        </button>
                      </>
                    )}
                    {isRejected && (
                      <button
                        type="button"
                        onClick={() => {
                          setEvaluatingTask(task)
                          setEvaluationData({
                            rating: task.directorRating || 'GOOD',
                            comment: task.directorComment || '',
                            approved: false,
                            approvedScore: task.selfScore || null
                          })
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Xem lại
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal chỉnh sửa công việc phát sinh */}
        {editingTask && (
          <Modal
            isOpen={!!editingTask}
            onClose={() => setEditingTask(null)}
            title="Chỉnh sửa công việc phát sinh"
            size="lg"
          >
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600"><strong>Nhân viên:</strong> {editingTask.userFullName}</p>
                <p className="text-sm text-gray-600"><strong>Ngày báo cáo:</strong> {new Date(editingTask.reportDate).toLocaleDateString('vi-VN')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nội dung công việc
                </label>
                <textarea
                  value={editFormData.content}
                  onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Nội dung không thể chỉnh sửa</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment
                </label>
                <textarea
                  value={editFormData.comment}
                  onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Comment không thể chỉnh sửa</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Điểm tự chấm (giờ)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editFormData.selfScore || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, selfScore: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Điểm tự chấm không thể chỉnh sửa</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Chức năng chỉnh sửa công việc phát sinh đang được phát triển. 
                  Hiện tại bạn chỉ có thể xem thông tin.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal duyệt công việc phát sinh */}
        {evaluatingTask && (
          <Modal
            isOpen={!!evaluatingTask}
            onClose={() => {
              setEvaluatingTask(null)
              setEvaluationData({
                rating: 'GOOD',
                comment: '',
                approved: false,
                approvedScore: null
              })
            }}
            title={filter === 'rejected' ? 'Xem lại công việc phát sinh' : 'Duyệt công việc phát sinh'}
            size="lg"
          >
            <div className="space-y-4">
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-gray-900 mb-2 text-base">{evaluatingTask.content}</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Nhân viên:</strong> {evaluatingTask.userFullName} ({evaluatingTask.userName})</p>
                  <p><strong>Ngày báo cáo:</strong> {new Date(evaluatingTask.reportDate).toLocaleDateString('vi-VN')}</p>
                  <p><strong>Điểm tự chấm:</strong> {evaluatingTask.selfScore ? `${evaluatingTask.selfScore} giờ` : 'Chưa có'}</p>
                  {evaluatingTask.comment && (
                    <p><strong>Comment:</strong> {evaluatingTask.comment}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đánh giá
                  </label>
                  <select
                    value={evaluationData.rating}
                    onChange={(e) => setEvaluationData({ ...evaluationData, rating: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="EXCELLENT">Xuất sắc</option>
                    <option value="GOOD">Tốt</option>
                    <option value="AVERAGE">Trung bình</option>
                    <option value="POOR">Kém</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    value={evaluationData.comment}
                    onChange={(e) => setEvaluationData({ ...evaluationData, comment: e.target.value })}
                    placeholder="Nhập ghi chú (tùy chọn)..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Điểm được duyệt (giờ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={evaluationData.approvedScore || ''}
                    onChange={(e) => setEvaluationData({ ...evaluationData, approvedScore: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Ví dụ: 2.5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Điểm tính bằng giờ (ví dụ: 2.5 giờ = 2.5 điểm)</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setEvaluatingTask(null)
                    setEvaluationData({
                      rating: 'GOOD',
                      comment: '',
                      approved: false,
                      approvedScore: null
                    })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                {filter !== 'rejected' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReject(evaluatingTask)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(evaluatingTask)}
                      disabled={!evaluationData.approvedScore || evaluationData.approvedScore <= 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Duyệt và tính điểm
                    </button>
                  </>
                )}
                {filter === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      // Chuyển sang duyệt lại - cần nhập điểm được duyệt
                      if (!evaluationData.approvedScore || evaluationData.approvedScore <= 0) {
                        setError('Vui lòng nhập điểm được duyệt (phải lớn hơn 0) để duyệt lại')
                        return
                      }
                      handleApprove(evaluatingTask)
                    }}
                    disabled={!evaluationData.approvedScore || evaluationData.approvedScore <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Duyệt lại
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

export default AdHocTasksPage

