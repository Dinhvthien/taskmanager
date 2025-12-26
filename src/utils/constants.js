// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  TASKS: {
    BASE: '/tasks',
    BY_ID: (id) => `/tasks/${id}`,
  },
  USERS: {
    BASE: '/users',
    BY_ID: (id) => `/users/${id}`,
  },
  DEPARTMENTS: {
    BASE: '/departments',
    BY_ID: (id) => `/departments/${id}`,
  },
  DIRECTORS: {
    BASE: '/directors',
    BY_ID: (id) => `/directors/${id}`,
  },
}

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
}

// Task Status
export const TASK_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  WAITING: 'WAITING',
}

// Task Rating
export const TASK_RATING = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  AVERAGE: 'AVERAGE',
  POOR: 'POOR',
}

// Task Status Labels (Vietnamese)
export const TASK_STATUS_LABELS = {
  PENDING: 'Chờ nhận việc',
  ACCEPTED: 'Đã nhận',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  WAITING: 'Đang chờ',
}

// Task Status Colors
export const TASK_STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  WAITING: 'bg-orange-100 text-orange-800',
}

// Task Rating Labels (Vietnamese)
export const TASK_RATING_LABELS = {
  EXCELLENT: 'Xuất sắc',
  GOOD: 'Tốt',
  AVERAGE: 'Trung bình',
  POOR: 'Kém',
}

// Roles
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DIRECTOR: 'DIRECTOR',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  USER: 'USER',
}

// Role Labels (Vietnamese)
export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Giám đốc',
  DEPARTMENT_MANAGER: 'Trưởng phòng',
  USER: 'Nhân viên',
}
