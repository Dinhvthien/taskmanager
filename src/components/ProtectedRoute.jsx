import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUserRoles, hasAnyRole } from '../utils/auth'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const location = useLocation()
  const token = localStorage.getItem('token')
  
  // Nếu chưa đăng nhập
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Nếu có yêu cầu role cụ thể
  if (allowedRoles.length > 0) {
    const userRoles = getCurrentUserRoles()
    
    if (!hasAnyRole(allowedRoles)) {
      // Redirect về dashboard phù hợp với role
      if (userRoles.includes('SUPER_ADMIN')) {
        return <Navigate to="/super-admin/dashboard" replace />
      } else if (userRoles.includes('DIRECTOR')) {
        return <Navigate to="/director/dashboard" replace />
      } else if (userRoles.includes('DEPARTMENT_MANAGER') || userRoles.includes('MANAGER')) {
        return <Navigate to="/manager/dashboard" replace />
      } else {
        return <Navigate to="/user/dashboard" replace />
      }
    }
  }

  return children
}

export default ProtectedRoute

