import api from './api'

export const conversationService = {
  // Tạo conversation DIRECT
  createDirectConversation: (userId) => {
    return api.post('/conversations/direct', { userId })
  },

  // Tạo conversation GROUP
  createGroupConversation: (name, userIds) => {
    return api.post('/conversations/group', { name, userIds })
  },

  // Tạo hoặc lấy conversation DEPARTMENT
  getOrCreateDepartmentConversation: (departmentId) => {
    return api.post(`/conversations/department/${departmentId}`)
  },

  // Lấy danh sách conversations của user
  getMyConversations: () => {
    return api.get('/conversations/me')
  },

  // Lấy conversation theo ID
  getConversationById: (conversationId) => {
    return api.get(`/conversations/${conversationId}`)
  },

  // Thêm participants vào GROUP conversation
  addParticipants: (conversationId, userIds) => {
    return api.post(`/conversations/${conversationId}/participants`, { userIds })
  },

  // Rời khỏi conversation
  leaveConversation: (conversationId) => {
    return api.post(`/conversations/${conversationId}/leave`)
  },

  // Cập nhật tên GROUP conversation
  updateGroupName: (conversationId, name) => {
    return api.put(`/conversations/${conversationId}/name`, { name })
  },

  // Xóa participant khỏi GROUP conversation (chỉ ADMIN)
  removeParticipant: (conversationId, participantUserId) => {
    return api.delete(`/conversations/${conversationId}/participants/${participantUserId}`)
  }
}

