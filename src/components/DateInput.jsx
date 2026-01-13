import { useState, useEffect, useRef } from 'react'
import { CalendarIcon } from '@heroicons/react/24/outline'

const DateInput = ({ value, onChange, min, max, required, className, disabled, placeholder }) => {
  const [displayValue, setDisplayValue] = useState('')
  const [error, setError] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const containerRef = useRef(null)

  // Convert ISO string (YYYY-MM-DD) to display format (dd/mm/yyyy)
  const formatForDisplay = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString + 'T00:00:00')
      if (isNaN(date.getTime())) return ''
      
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return ''
    }
  }

  // Convert display format (dd/mm/yyyy) to ISO string (YYYY-MM-DD)
  const parseFromDisplay = (displayStr) => {
    if (!displayStr) return ''
    
    const cleaned = displayStr.trim()
    const pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    const match = cleaned.match(pattern)
    
    if (!match) return null
    
    const [, day, month, year] = match
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    const y = parseInt(year, 10)
    
    if (m < 1 || m > 12) return null
    if (d < 1 || d > 31) return null
    
    try {
      const date = new Date(y, m - 1, d)
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return null
      }
      
      const isoString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return isoString
    } catch {
      return null
    }
  }

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
        setDisplayValue(formatForDisplay(value))
      }
    } else {
      setSelectedDate(null)
      setDisplayValue('')
    }
    setError('')
  }, [value])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDatePicker(false)
      }
    }

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker])

  const handleDateSelect = (date) => {
    setSelectedDate(date)
    setShowDatePicker(false)
    updateValue(date)
  }

  const updateValue = (date) => {
    if (!date) return
    
    const isoString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    // Validate min/max
    if (min) {
      const minDate = new Date(min + 'T00:00:00')
      const inputDate = new Date(isoString + 'T00:00:00')
      if (inputDate < minDate) {
        setError('Ngày không được nhỏ hơn ngày tối thiểu')
        return
      }
    }
    
    if (max) {
      const maxDate = new Date(max + 'T00:00:00')
      const inputDate = new Date(isoString + 'T00:00:00')
      if (inputDate > maxDate) {
        setError('Ngày không được lớn hơn ngày tối đa')
        return
      }
    }
    
    onChange(isoString)
    setError('')
  }

  const handleInputChange = (e) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)
    
    if (!inputValue) {
      onChange('')
      setError('')
      return
    }
    
    const isoString = parseFromDisplay(inputValue)
    if (isoString) {
      const date = new Date(isoString + 'T00:00:00')
      setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
      updateValue(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
    }
  }

  const handleBlur = () => {
    if (displayValue && !parseFromDisplay(displayValue)) {
      setError('Định dạng không hợp lệ. Vui lòng nhập theo định dạng: dd/mm/yyyy')
    }
  }

  // Generate calendar days
  const generateCalendar = () => {
    if (!selectedDate) {
      const today = new Date()
      setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    }
    
    const date = selectedDate || new Date()
    const year = date.getFullYear()
    const month = date.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonth.getDate() - i,
        month: month - 1,
        year: year,
        isCurrentMonth: false
      })
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: day,
        month: month,
        year: year,
        isCurrentMonth: true
      })
    }
    
    // Next month's leading days
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: day,
        month: month + 1,
        year: year,
        isCurrentMonth: false
      })
    }
    
    return days
  }

  const navigateMonth = (direction) => {
    if (!selectedDate) return
    const newDate = new Date(selectedDate)
    newDate.setMonth(selectedDate.getMonth() + direction)
    setSelectedDate(newDate)
  }

  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 
                      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  const calendarDays = generateCalendar()
  const currentDate = selectedDate || new Date()

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder || "dd/mm/yyyy"}
          required={required}
          disabled={disabled}
          className={className}
          readOnly
        />
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-blue-600 transition-colors"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Date Picker Popup */}
      {showDatePicker && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const dayDate = new Date(day.year, day.month, day.date)
              const dayIsoString = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`
              
              // Check min/max constraints
              let isDisabled = false
              if (min) {
                const minDate = new Date(min + 'T00:00:00')
                if (dayDate < minDate) isDisabled = true
              }
              if (max) {
                const maxDate = new Date(max + 'T00:00:00')
                if (dayDate > maxDate) isDisabled = true
              }
              
              const isSelected = value && value === dayIsoString
              const isToday = new Date().toDateString() === dayDate.toDateString()
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => !isDisabled && handleDateSelect(dayDate)}
                  disabled={isDisabled}
                  className={`p-2 text-sm rounded hover:bg-blue-100 transition-colors ${
                    !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                  } ${
                    isDisabled ? 'opacity-30 cursor-not-allowed' : ''
                  } ${
                    isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                  } ${
                    isToday && !isSelected ? 'bg-blue-50 font-semibold' : ''
                  }`}
                >
                  {day.date}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export default DateInput


