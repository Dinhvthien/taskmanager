import api from './api'

export const attachmentService = {
  // Upload file cho task
  uploadTaskAttachment: (taskId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/attachments/tasks/${taskId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // Upload file cho comment
  uploadCommentAttachment: (commentId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/attachments/comments/${commentId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // Lấy tất cả attachments của task
  getTaskAttachments: (taskId) => {
    return api.get(`/attachments/tasks/${taskId}`)
  },

  // Lấy tất cả attachments của comment
  getCommentAttachments: (commentId) => {
    return api.get(`/attachments/comments/${commentId}`)
  },

  // Download file
  downloadAttachment: (attachmentId) => {
    return api.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    })
  },

  // Get download URL (for img src - needs to handle auth)
  getDownloadUrl: (attachmentId) => {
    const token = localStorage.getItem('token')
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
    // For images, we can embed token in URL or use blob URL
    // Better approach: create a blob URL after downloading
    return `${baseURL}/attachments/${attachmentId}/download`
  },

  // Xóa attachment
  deleteAttachment: (attachmentId) => {
    return api.delete(`/attachments/${attachmentId}`)
  },

  // Helper: Format file size
  formatFileSize: (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  },

  // Helper: Get file icon based on file type
  getFileIcon: (fileType) => {
    if (!fileType) return '📄'
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType === 'application/pdf') return '📕'
    if (fileType.includes('word')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦'
    if (fileType.includes('video')) return '🎥'
    if (fileType.includes('audio')) return '🎵'
    return '📄'
  }
}

