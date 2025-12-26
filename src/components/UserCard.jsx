import { ROLE_LABELS } from '../utils/constants'

const UserCard = ({ user, onEdit, onDelete, showActions = true }) => {
  if (!user) return null

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('vi-VN')
    } catch {
      return 'N/A'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {user.fullName || user.userName || 'N/A'}
          </h3>
          <p className="text-sm text-gray-600 mt-1 truncate">@{user.userName || 'N/A'}</p>
          
          <div className="mt-4 space-y-2 text-sm">
            {user.email && (
              <div className="flex items-start text-gray-600">
                <span className="font-medium w-20 flex-shrink-0">Email:</span>
                <span className="truncate">{user.email}</span>
              </div>
            )}
            {user.phoneNumber && (
              <div className="flex items-center text-gray-600">
                <span className="font-medium w-20 flex-shrink-0">Điện thoại:</span>
                <span>{user.phoneNumber}</span>
              </div>
            )}
            {user.roles && Array.isArray(user.roles) && user.roles.length > 0 && (
              <div className="flex items-start text-gray-600">
                <span className="font-medium w-20 flex-shrink-0">Vai trò:</span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {user.roles.map((role, index) => {
                    const roleName = typeof role === 'string' ? role : (role?.name || role)
                    return (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded whitespace-nowrap"
                      >
                        {ROLE_LABELS[roleName] || roleName}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            {user.createdAt && (
              <div className="flex items-center text-gray-500 text-xs mt-2">
                <span>Tham gia: {formatDate(user.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        {showActions && (onEdit || onDelete) && (
          <div className="flex space-x-2 ml-4 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(user)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Chỉnh sửa"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(user)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Xóa"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserCard

