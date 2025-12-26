import api from './api'

export const roleService = {
  // Lấy tất cả roles
  getAllRoles: () => {
    return api.get('/roles')
  }
}

