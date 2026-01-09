import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  UserCircleIcon, 
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { userService } from '../services/userService'
import { getCurrentUser, getAvatar, setAvatar } from '../utils/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

const ProfilePage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    loadUserProfile()
    loadAvatar()
  }, [])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await userService.getCurrentUser()
      const user = response.data.result
      
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        password: '',
        confirmPassword: ''
      })
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err.response?.data?.message || 'Lỗi khi tải thông tin cá nhân')
    } finally {
      setLoading(false)
    }
  }

  const loadAvatar = () => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      const savedAvatar = getAvatar(currentUser.userId)
      if (savedAvatar) {
        setAvatarPreview(savedAvatar)
      }
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh không được vượt quá 5MB')
      return
    }

    // Read file and create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result
      setAvatarPreview(base64String)
      
      // Save to localStorage
      const currentUser = getCurrentUser()
      if (currentUser) {
        setAvatar(currentUser.userId, base64String)
        setSuccess('Avatar đã được cập nhật')
        setTimeout(() => setSuccess(''), 3000)
      }
    }
    reader.onerror = () => {
      setError('Lỗi khi đọc file ảnh')
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear errors when user starts typing
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Validate password if provided
      if (formData.password) {
        if (formData.password.length < 6) {
          setError('Mật khẩu phải có ít nhất 6 ký tự')
          setSaving(false)
          return
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Mật khẩu xác nhận không khớp')
          setSaving(false)
          return
        }
      }

      const currentUser = getCurrentUser()
      if (!currentUser) {
        setError('Không tìm thấy thông tin người dùng')
        setSaving(false)
        return
      }

      // Prepare update data
      const updateData = {
        fullName: formData.fullName,
        email: formData.email || null,
        phoneNumber: formData.phoneNumber || null
      }

      // Only include password if provided
      if (formData.password) {
        updateData.password = formData.password
      }

      // Update user
      await userService.updateUser(currentUser.userId, updateData)
      
      // Update local storage user info
      const updatedUser = {
        ...currentUser,
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))

      setSuccess('Cập nhật thông tin thành công')
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }))

      // Reload page after 1 second to show updated info
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err.response?.data?.message || 'Lỗi khi cập nhật thông tin')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = () => {
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.fullName) {
      const names = currentUser.fullName.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      }
      return currentUser.fullName[0].toUpperCase()
    }
    return 'U'
  }

  const getAvatarColor = () => {
    const currentUser = getCurrentUser()
    if (!currentUser) return 'bg-purple-600'
    
    // Get color based on role
    const roles = currentUser.roles || []
    if (roles.includes('DIRECTOR')) return 'bg-blue-600'
    if (roles.includes('MANAGER') || roles.includes('DEPARTMENT_MANAGER')) return 'bg-green-600'
    if (roles.includes('SUPER_ADMIN')) return 'bg-indigo-600'
    return 'bg-purple-600'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Quản lý thông tin cá nhân và avatar của bạn</p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} />
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-gray-200">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className={`w-24 h-24 sm:w-32 sm:h-32 ${getAvatarColor()} rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-semibold border-4 border-gray-200`}>
                    {getInitials()}
                  </div>
                )}
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 sm:p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <CameraIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {formData.fullName || 'Chưa có tên'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {getCurrentUser()?.userName || ''}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Nhấn vào biểu tượng camera để thay đổi avatar
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập họ và tên"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập email"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              {/* Address - Read only */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  placeholder="Không thể chỉnh sửa"
                />
                <p className="text-xs text-gray-400 mt-1">Địa chỉ không thể chỉnh sửa tại đây</p>
              </div>
            </div>

            {/* Password Section */}
            <div className="pt-4 sm:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Thay đổi mật khẩu</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                Để trống nếu không muốn thay đổi mật khẩu
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập mật khẩu mới"
                    minLength={6}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Xác nhận mật khẩu
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập lại mật khẩu mới"
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                {saving ? (
                  <>
                    <LoadingSpinner />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu thay đổi</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage

