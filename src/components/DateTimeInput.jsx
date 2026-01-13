import { useState, useEffect, useRef } from 'react'
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline'

const DateTimeInput = ({ value, onChange, min, max, required, className, disabled, placeholder }) => {
  const [displayValue, setDisplayValue] = useState('')
  const [error, setError] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState({ hours: '00', minutes: '00' })
  const containerRef = useRef(null)

  // Convert ISO string (YYYY-MM-DDTHH:mm) to display format (dd/mm/yyyy HH:mm)
  const formatForDisplay = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return ''
      
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  // Convert display format (dd/mm/yyyy HH:mm) to ISO string (YYYY-MM-DDTHH:mm)
  const parseFromDisplay = (displayStr) => {
    if (!displayStr) return ''
    
    const cleaned = displayStr.trim().replace(/\s+/g, ' ')
    const pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})$/
    const match = cleaned.match(pattern)
    
    if (!match) return null
    
    const [, day, month, year, hours, minutes] = match
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    const y = parseInt(year, 10)
    const h = parseInt(hours, 10)
    const min = parseInt(minutes, 10)
    
    if (m < 1 || m > 12) return null
    if (d < 1 || d > 31) return null
    if (h < 0 || h > 23) return null
    if (min < 0 || min > 59) return null
    
    try {
      const date = new Date(y, m - 1, d, h, min)
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return null
      }
      
      const isoString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      return isoString
    } catch {
      return null
    }
  }

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
        setSelectedTime({
          hours: String(date.getHours()).padStart(2, '0'),
          minutes: String(date.getMinutes()).padStart(2, '0')
        })
        setDisplayValue(formatForDisplay(value))
      }
    } else {
      setSelectedDate(null)
      setSelectedTime({ hours: '00', minutes: '00' })
      setDisplayValue('')
    }
    setError('')
  }, [value])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDatePicker(false)
        setShowTimePicker(false)
      }
    }

    if (showDatePicker || showTimePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker, showTimePicker])

  const handleDateSelect = (date) => {
    setSelectedDate(date)
    setShowDatePicker(false)
    updateValue(date, selectedTime)
  }

  const handleTimeSelect = (hours, minutes) => {
    const newTime = { hours, minutes }
    setSelectedTime(newTime)
    setShowTimePicker(false)
    if (selectedDate) {
      updateValue(selectedDate, newTime)
    }
  }

  const updateValue = (date, time) => {
    if (!date) return
    
    const isoString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${time.hours}:${time.minutes}`
    
    // Validate min/max
    if (min) {
      const minDate = new Date(min)
      const inputDate = new Date(isoString)
      if (inputDate < minDate) {
        setError('Ngày không được nhỏ hơn ngày tối thiểu')
        return
      }
    }
    
    if (max) {
      const maxDate = new Date(max)
      const inputDate = new Date(isoString)
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
      const date = new Date(isoString)
      setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
      setSelectedTime({
        hours: String(date.getHours()).padStart(2, '0'),
        minutes: String(date.getMinutes()).padStart(2, '0')
      })
      updateValue(new Date(date.getFullYear(), date.getMonth(), date.getDate()), {
        hours: String(date.getHours()).padStart(2, '0'),
        minutes: String(date.getMinutes()).padStart(2, '0')
      })
    }
  }

  const handleBlur = () => {
    if (displayValue && !parseFromDisplay(displayValue)) {
      setError('Định dạng không hợp lệ. Vui lòng nhập theo định dạng: dd/mm/yyyy HH:mm')
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
    const remainingDays = 42 - days.length // 6 weeks * 7 days
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
          placeholder={placeholder || "dd/mm/yyyy HH:mm"}
          required={required}
          disabled={disabled}
          className={className}
          readOnly
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            type="button"
            onClick={() => {
              setShowDatePicker(!showDatePicker)
              setShowTimePicker(false)
            }}
            disabled={disabled}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTimePicker(!showTimePicker)
              setShowDatePicker(false)
            }}
            disabled={disabled}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ClockIcon className="w-5 h-5" />
          </button>
        </div>
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
              const isSelected = selectedDate && 
                selectedDate.getDate() === day.date &&
                selectedDate.getMonth() === day.month &&
                selectedDate.getFullYear() === day.year
              const isToday = new Date().toDateString() === dayDate.toDateString()
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(dayDate)}
                  className={`p-2 text-sm rounded hover:bg-blue-100 transition-colors ${
                    !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
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

      {/* Time Picker Popup */}
      {showTimePicker && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-64">
          <div className="text-center font-semibold mb-4">Chọn giờ</div>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <label className="text-xs text-gray-600 mb-1">Giờ</label>
              <select
                value={selectedTime.hours}
                onChange={(e) => handleTimeSelect(e.target.value, selectedTime.minutes)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <span className="text-2xl font-bold mt-6">:</span>
            <div className="flex flex-col items-center">
              <label className="text-xs text-gray-600 mb-1">Phút</label>
              <select
                value={selectedTime.minutes}
                onChange={(e) => handleTimeSelect(selectedTime.hours, e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTimePicker(false)}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Xong
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export default DateTimeInput
