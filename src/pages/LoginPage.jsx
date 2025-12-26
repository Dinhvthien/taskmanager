import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { API_ENDPOINTS } from '../utils/constants'

const LoginPage = () => {
  const [formData, setFormData] = useState({
    userName: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, formData)
      const { result } = response.data

      // Lưu token và user info
      localStorage.setItem('token', result.token)
      // Tạo user object từ LoginResponse
      const user = {
        userId: result.userId,
        userName: result.userName,
        fullName: result.fullName,
        email: result.email,
        roles: result.roles || []
      }
      localStorage.setItem('user', JSON.stringify(user))

      // Redirect dựa trên role
      const roles = result.roles || []
      // Roles từ backend là List<String>, không phải objects
      if (roles.includes('SUPER_ADMIN')) {
        navigate('/super-admin/dashboard')
      } else if (roles.includes('DIRECTOR')) {
        navigate('/director/dashboard')
      } else if (roles.includes('DEPARTMENT_MANAGER') || roles.includes('MANAGER')) {
        navigate('/manager/my-tasks')
      } else {
        navigate('/user/tasks')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Đăng nhập</h2>
        <p className="text-gray-600">Chào mừng trở lại!</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
            Tên đăng nhập
          </label>
          <input
            id="userName"
            name="userName"
            type="text"
            required
            value={formData.userName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="Nhập tên đăng nhập"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Mật khẩu
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="Nhập mật khẩu"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}

export default LoginPage

