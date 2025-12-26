import axios from 'axios'

// Tạo axios instance với base URL từ biến môi trường
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://api.dinhvanthien.shop/api',
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
    // Log request URL for debugging
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`
    })
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
    if (error.response?.status === 401) {
      // Xử lý khi token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (error.response?.status === 403) {
      // Xử lý khi không có quyền
      const message = error.response?.data?.message || 'Bạn không có quyền thực hiện thao tác này'
      console.error('Forbidden:', message)
      // Có thể hiển thị toast notification hoặc redirect
    }
    return Promise.reject(error)
  }
)

export default api

