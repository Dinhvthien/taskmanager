import { getCurrentUser, getAvatar } from '../utils/auth'
import { userService } from '../services/userService'

const Avatar = ({ size = 10, className = '' }) => {
  const currentUser = getCurrentUser()
  
  // Priority: avatarUrl from server > localStorage
  let avatar = null
  if (currentUser) {
    if (currentUser.avatarUrl) {
      // Use server avatar URL
      avatar = userService.getAvatarUrl(currentUser.userId)
    } else {
      // Fallback to localStorage
      avatar = getAvatar(currentUser.userId)
    }
  }

  const getInitials = () => {
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
    if (!currentUser) return 'bg-purple-600'
    
    const roles = currentUser.roles || []
    if (roles.includes('DIRECTOR')) return 'bg-blue-600'
    if (roles.includes('MANAGER') || roles.includes('DEPARTMENT_MANAGER')) return 'bg-green-600'
    if (roles.includes('SUPER_ADMIN')) return 'bg-indigo-600'
    return 'bg-purple-600'
  }

  const sizeClasses = {
    8: 'w-8 h-8 text-sm',
    10: 'w-10 h-10 text-base',
    12: 'w-12 h-12 text-lg',
    16: 'w-16 h-16 text-xl',
    32: 'w-32 h-32 text-3xl'
  }

  const sizeClass = sizeClasses[size] || sizeClasses[10]

  if (avatar) {
    return (
      <img
        src={avatar}
        alt="Avatar"
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div className={`${sizeClass} ${getAvatarColor()} rounded-full flex items-center justify-center text-white font-semibold ${className}`}>
      {getInitials()}
    </div>
  )
}

export default Avatar


