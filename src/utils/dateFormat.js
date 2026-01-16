/**
 * Format date to dd/mm/yyyy
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string (dd/mm/yyyy)
 */
export const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  
  return `${day}/${month}/${year}`
}

/**
 * Format time to 24h format (HH:mm)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted time string (HH:mm)
 */
export const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * Format date and time to dd/mm/yyyy HH:mm
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date and time string (dd/mm/yyyy HH:mm)
 */
export const formatDateTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  // Tránh vòng lặp đệ quy: chuyển Date object thành ISO string trước khi format
  // Thay vì truyền Date object trực tiếp vào formatDate/formatTime
  const isoString = d.toISOString()
  return `${formatDate(isoString)} ${formatTime(isoString)}`
}

/**
 * Format time string (HH:mm) to display format
 * @param {string} timeString - Time string in format HH:mm or HH:mm:ss
 * @returns {string} Formatted time string (HH:mm)
 */
export const formatTimeString = (timeString) => {
  if (!timeString) return ''
  // Handle both HH:mm and HH:mm:ss formats
  const parts = timeString.split(':')
  if (parts.length >= 2) {
    const hours = String(parseInt(parts[0], 10)).padStart(2, '0')
    const minutes = String(parseInt(parts[1], 10)).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  return timeString
}


