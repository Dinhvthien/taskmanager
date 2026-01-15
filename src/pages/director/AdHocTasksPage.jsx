import { useState, useEffect } from 'react'
import dailyReportService from '../../services/dailyReportService'
import { directorEvaluationService } from '../../services/dailyReportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import { CheckIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'
import Modal from '../../components/Modal'
import { formatDate, formatTimeString } from '../../utils/dateFormat'

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
        approved: true,
        approvedScore: evaluationData.approvedScore
      }
      
      await directorEvaluationService.saveAdHocTaskEvaluation(adHocTask.reportId, data)
      setEvaluatingTask(null)
      setEvaluationData({
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
        approved: false,
        approvedScore: null
      }
      
      await directorEvaluationService.saveAdHocTaskEvaluation(adHocTask.reportId, data)
      setEvaluatingTask(null)
      setEvaluationData({
        approved: false,
        approvedScore: null
      })
      loadAdHocTasks() // Reload danh sách
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi từ chối công việc phát sinh')
    }
  }

  const getFilteredTasks = () => {
    if (filter === 'pending') {
      // Chưa được xử lý: chưa có evaluation record
      return adHocTasks.filter(task => !task.approved && !task.hasEvaluation)
    } else if (filter === 'approved') {
      return adHocTasks.filter(task => task.approved)
    } else if (filter === 'rejected') {
      // Đã được xử lý nhưng không được duyệt: có evaluation record và approved = false
      return adHocTasks.filter(task => !task.approved && task.hasEvaluation)
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

    try {
      setError('')
      await dailyReportService.updateAdHocTaskSelfScore(editingTask.adHocTaskId, editFormData.selfScore)
      setEditingTask(null)
      setEditFormData({
        content: '',
        comment: '',
        selfScore: null
      })
      loadAdHocTasks() // Reload danh sách
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật điểm tự chấm')
    }
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
            className={`px-5 py-2.5 font-medium text-sm whitespace-nowrap transition-all duration-200 relative ${
              filter === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Chờ duyệt ({adHocTasks.filter(t => !t.approved && !t.hasEvaluation).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('approved')}
            className={`px-5 py-2.5 font-medium text-sm whitespace-nowrap transition-all duration-200 relative ${
              filter === 'approved'
                ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Đã duyệt ({adHocTasks.filter(t => t.approved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rejected')}
            className={`px-5 py-2.5 font-medium text-sm whitespace-nowrap transition-all duration-200 relative ${
              filter === 'rejected'
                ? 'text-red-600 border-b-2 border-red-600 font-semibold'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Từ chối ({adHocTasks.filter(t => !t.approved && t.hasEvaluation).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-5 py-2.5 font-medium text-sm whitespace-nowrap transition-all duration-200 relative ${
              filter === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-4">
            {filteredTasks.map((task) => {
              const isPending = !task.approved && !task.hasEvaluation
              const isRejected = !task.approved && task.hasEvaluation
              
              return (
                <div
                  key={task.adHocTaskId}
                  className={`border rounded-lg p-5 shadow-sm transition-all hover:shadow-md flex flex-col h-full ${
                    task.approved 
                      ? 'bg-green-50 border-green-200' 
                      : isRejected
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3 flex-shrink-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-base">{task.content}</h3>
                        {task.approved && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Đã duyệt
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            Chờ duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                            Từ chối
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
                          <span>{formatDate(task.reportDate)}</span>
                        </p>
                        {(task.startTime || task.endTime) && (
                          <p className="flex items-center gap-2">
                            <span className="font-medium">Thời gian thực hiện:</span>
                            <span>
                              {task.startTime && task.endTime
                                ? `${formatTimeString(task.startTime)} - ${formatTimeString(task.endTime)}`
                                : task.startTime
                                ? `Từ ${formatTimeString(task.startTime)}`
                                : task.endTime
                                ? `Đến ${formatTimeString(task.endTime)}`
                                : 'N/A'}
                            </span>
                          </p>
                        )}
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
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-gray-200 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(task)}
                            title="Chỉnh sửa"
                            className="flex items-center justify-center w-9 h-9 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 hover:shadow-md active:scale-95 transition-all duration-200 border border-gray-200"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickReject(task)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 hover:shadow-lg hover:shadow-gray-500/50 active:scale-95 transition-all duration-200"
                          >
                            <XMarkIcon className="w-4 h-4" />
                            Hủy
                          </button>
                        </>
                      )}
                      {isRejected && (
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluatingTask(task)
                            setEvaluationData({
                              approved: false,
                              approvedScore: task.selfScore || null
                            })
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95 transition-all duration-200"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Duyệt
                        </button>
                      )}
                    </div>
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => {
                          setEvaluatingTask(task)
                          setEvaluationData({
                            approved: false,
                            approvedScore: task.selfScore || null
                          })
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95 transition-all duration-200"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Duyệt
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
            title="Chỉnh sửa điểm tự chấm"
            size="md"
          >
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600"><strong>Nhân viên:</strong> {editingTask.userFullName}</p>
                <p className="text-sm text-gray-600"><strong>Ngày báo cáo:</strong> {formatDate(editingTask.reportDate)}</p>
                <p className="text-sm text-gray-600 mt-2"><strong>Nội dung:</strong> {editingTask.content}</p>
                {(editingTask.startTime || editingTask.endTime) && (
                  <p className="text-sm text-gray-600">
                    <strong>Thời gian thực hiện:</strong> {
                      editingTask.startTime && editingTask.endTime
                        ? `${formatTimeString(editingTask.startTime)} - ${formatTimeString(editingTask.endTime)}`
                        : editingTask.startTime
                        ? `Từ ${formatTimeString(editingTask.startTime)}`
                        : editingTask.endTime
                        ? `Đến ${formatTimeString(editingTask.endTime)}`
                        : 'N/A'
                    }
                  </p>
                )}
                {editingTask.comment && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Comment:</strong> {editingTask.comment}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Điểm tự chấm (giờ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editFormData.selfScore || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, selfScore: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Nhập điểm tự chấm (ví dụ: 2.5)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Điểm tính bằng giờ (ví dụ: 2.5 giờ = 2.5 điểm)</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null)
                    setEditFormData({
                      content: '',
                      comment: '',
                      selfScore: null
                    })
                  }}
                  className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-md active:scale-95 transition-all duration-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editFormData.selfScore || editFormData.selfScore <= 0}
                  className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
                >
                  Lưu
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
                  <p><strong>Ngày báo cáo:</strong> {formatDate(evaluatingTask.reportDate)}</p>
                  {(evaluatingTask.startTime || evaluatingTask.endTime) && (
                    <p><strong>Thời gian thực hiện:</strong> {
                      evaluatingTask.startTime && evaluatingTask.endTime
                        ? `${formatTimeString(evaluatingTask.startTime)} - ${formatTimeString(evaluatingTask.endTime)}`
                        : evaluatingTask.startTime
                        ? `Từ ${formatTimeString(evaluatingTask.startTime)}`
                        : evaluatingTask.endTime
                        ? `Đến ${formatTimeString(evaluatingTask.endTime)}`
                        : 'N/A'
                    }</p>
                  )}
                  <p><strong>Điểm tự chấm:</strong> {evaluatingTask.selfScore ? `${evaluatingTask.selfScore} giờ` : 'Chưa có'}</p>
                  {evaluatingTask.comment && (
                    <p><strong>Comment:</strong> {evaluatingTask.comment}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
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
                      approved: false,
                      approvedScore: null
                    })
                  }}
                  className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-md active:scale-95 transition-all duration-200"
                >
                  Hủy
                </button>
                {filter !== 'rejected' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReject(evaluatingTask)}
                      className="px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/50 active:scale-95 transition-all duration-200"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(evaluatingTask)}
                      disabled={!evaluationData.approvedScore || evaluationData.approvedScore <= 0}
                      className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
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
                    className="px-5 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 hover:shadow-lg hover:shadow-green-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
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

