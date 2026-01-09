// Utility functions for authentication

export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    return JSON.parse(userStr)
  } catch (e) {
    console.error('Error parsing user:', e)
    return null
  }
}

export const getCurrentUserRoles = () => {
  const user = getCurrentUser()
  if (!user) return []
  
  const roles = user.roles || []
  // Normalize roles - có thể là string hoặc object
  return roles.map(role => {
    if (typeof role === 'string') return role
    if (role && typeof role === 'object' && role.name) return role.name
    return role
  })
}

export const hasRole = (requiredRole) => {
  const roles = getCurrentUserRoles()
  return roles.includes(requiredRole)
}

export const hasAnyRole = (requiredRoles) => {
  const userRoles = getCurrentUserRoles()
  return requiredRoles.some(role => userRoles.includes(role))
}

export const getToken = () => {
  return localStorage.getItem('token')
}

export const isAuthenticated = () => {
  return !!getToken()
}

export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  // Clear all avatar data from localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('avatar_')) {
      localStorage.removeItem(key)
    }
  })
  window.location.href = '/login'
}

export const getAvatar = (userId) => {
  if (!userId) return null
  const avatarKey = `avatar_${userId}`
  return localStorage.getItem(avatarKey)
}

export const setAvatar = (userId, avatarData) => {
  if (!userId) return
  const avatarKey = `avatar_${userId}`
  if (avatarData) {
    localStorage.setItem(avatarKey, avatarData)
  } else {
    localStorage.removeItem(avatarKey)
  }
}

