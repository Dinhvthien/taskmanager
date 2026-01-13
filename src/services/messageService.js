import api from './api'

export const messageService = {
  // Gửi tin nhắn (text only)
  sendMessage: (conversationId, content, replyToMessageId = null) => {
    return api.post(`/conversations/${conversationId}/messages`, {
      content,
      replyToMessageId
    })
  },

  // Gửi tin nhắn kèm file
  sendMessageWithFiles: (conversationId, content, files, replyToMessageId = null) => {
    const formData = new FormData()
    // Tạo Blob với Content-Type application/json để Spring có thể parse
    const requestBlob = new Blob([JSON.stringify({ content, replyToMessageId })], {
      type: 'application/json'
    })
    formData.append('request', requestBlob)
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file)
      })
    }
    return api.post(`/conversations/${conversationId}/messages/with-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // Lấy danh sách messages (phân trang)
  getMessages: (conversationId, page = 0, size = 50) => {
    return api.get(`/conversations/${conversationId}/messages`, {
      params: { page, size }
    })
  },

  // Lấy message theo ID
  getMessageById: (conversationId, messageId) => {
    return api.get(`/conversations/${conversationId}/messages/${messageId}`)
  },

  // Cập nhật tin nhắn
  updateMessage: (conversationId, messageId, content) => {
    return api.put(`/conversations/${conversationId}/messages/${messageId}`, { content })
  },

  // Xóa tin nhắn
  deleteMessage: (conversationId, messageId, deleteType = 'DELETE_FOR_EVERYONE') => {
    return api.delete(`/conversations/${conversationId}/messages/${messageId}`, {
      data: { deleteType }
    })
  },

  // Đánh dấu tin nhắn đã đọc
  markMessageAsRead: (conversationId, messageId) => {
    return api.post(`/conversations/${conversationId}/messages/${messageId}/read`)
  },

  // Đánh dấu tất cả tin nhắn trong conversation đã đọc
  markAllMessagesAsRead: (conversationId) => {
    return api.post(`/conversations/${conversationId}/messages/read-all`)
  },

  // Thêm reaction cho tin nhắn
  addReaction: (conversationId, messageId, emoji) => {
    return api.post(`/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji })
  },

  // Xóa reaction của user cho tin nhắn
  removeReaction: (conversationId, messageId) => {
    return api.delete(`/conversations/${conversationId}/messages/${messageId}/reactions`)
  },

  // Download file đính kèm
  downloadAttachment: (conversationId, messageId, attachmentId) => {
    return api.get(`/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    })
  },

  // Ghim tin nhắn
  pinMessage: (conversationId, messageId) => {
    return api.post(`/conversations/${conversationId}/messages/${messageId}/pin`)
  },

  // Bỏ ghim tin nhắn
  unpinMessage: (conversationId, messageId) => {
    return api.post(`/conversations/${conversationId}/messages/${messageId}/unpin`)
  },

  // Lấy danh sách pinned messages
  getPinnedMessages: (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages/pinned`)
  }
}

