import axios from 'axios'

// Tạo axios instance với base URL từ biến môi trường
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor để thêm token vào header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor để xử lý lỗi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Không log 404 errors cho download attachment requests (file not found là expected)
    const isDownloadAttachment = error.config?.url?.includes('/attachments/') && error.config?.url?.includes('/download')
    
    // Bỏ qua redirect cho health check endpoint - để component tự xử lý
    const isHealthCheck = error.config?.url?.includes('/actuator/health')
    
    if (error.response?.status === 503 && !isHealthCheck) {
      // Xử lý khi hệ thống đang bảo trì (trừ health check endpoint)
      window.location.href = '/maintenance.html'
      return Promise.reject(error)
    } else if (error.response?.status === 401) {
      // Xử lý khi token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (error.response?.status === 403) {
      // Xử lý khi không có quyền
      const message = error.response?.data?.message || 'Bạn không có quyền thực hiện thao tác này'
      if (process.env.NODE_ENV === 'development') {
        console.error('Forbidden:', message)
      }
      // Có thể hiển thị toast notification hoặc redirect
    } else if (error.response?.status === 404 && isDownloadAttachment) {
      // Suppress 404 errors cho download attachment (file có thể đã bị xóa)
      // Error sẽ được handle ở component level
    }
    return Promise.reject(error)
  }
)

export default api

