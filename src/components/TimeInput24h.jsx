import { useState, useEffect } from 'react'

const TimeInput24h = ({ value, onChange, className }) => {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':')
      setHours(h || '')
      setMinutes(m || '')
    } else {
      setHours('')
      setMinutes('')
    }
  }, [value])

  const handleHoursChange = (e) => {
    let val = e.target.value
    if (val === '') {
      setHours('')
      if (minutes !== '') {
        onChange(`00:${minutes}`)
      }
      return
    }
    val = parseInt(val) || 0
    if (val < 0) val = 0
    if (val > 23) val = 23
    const h = String(val).padStart(2, '0')
    setHours(h)
    if (minutes !== '') {
      onChange(`${h}:${minutes}`)
    } else {
      onChange(`${h}:00`)
      setMinutes('00')
    }
  }

  const handleMinutesChange = (e) => {
    let val = e.target.value
    if (val === '') {
      setMinutes('')
      if (hours !== '') {
        onChange(`${hours}:00`)
      }
      return
    }
    val = parseInt(val) || 0
    if (val < 0) val = 0
    if (val > 59) val = 59
    const m = String(val).padStart(2, '0')
    setMinutes(m)
    if (hours !== '') {
      onChange(`${hours}:${m}`)
    } else {
      onChange(`00:${m}`)
      setHours('00')
    }
  }

  const handleHoursBlur = () => {
    if (hours === '') {
      setHours('00')
      if (minutes !== '') {
        onChange(`00:${minutes}`)
      } else {
        onChange('00:00')
        setMinutes('00')
      }
    } else {
      const h = String(parseInt(hours) || 0).padStart(2, '0')
      setHours(h)
      if (minutes !== '') {
        onChange(`${h}:${minutes}`)
      } else {
        onChange(`${h}:00`)
        setMinutes('00')
      }
    }
  }

  const handleMinutesBlur = () => {
    if (minutes === '') {
      setMinutes('00')
      if (hours !== '') {
        onChange(`${hours}:00`)
      } else {
        onChange('00:00')
        setHours('00')
      }
    } else {
      const m = String(parseInt(minutes) || 0).padStart(2, '0')
      setMinutes(m)
      if (hours !== '') {
        onChange(`${hours}:${m}`)
      } else {
        onChange(`00:${m}`)
        setHours('00')
      }
    }
  }

  const incrementHours = () => {
    const current = parseInt(hours) || 0
    const newHours = (current + 1) % 24
    const h = String(newHours).padStart(2, '0')
    setHours(h)
    const m = minutes || '00'
    setMinutes(m)
    onChange(`${h}:${m}`)
  }

  const decrementHours = () => {
    const current = parseInt(hours) || 0
    const newHours = current === 0 ? 23 : current - 1
    const h = String(newHours).padStart(2, '0')
    setHours(h)
    const m = minutes || '00'
    setMinutes(m)
    onChange(`${h}:${m}`)
  }

  const incrementMinutes = () => {
    const current = parseInt(minutes) || 0
    const newMinutes = (current + 1) % 60
    const m = String(newMinutes).padStart(2, '0')
    setMinutes(m)
    const h = hours || '00'
    setHours(h)
    onChange(`${h}:${m}`)
  }

  const decrementMinutes = () => {
    const current = parseInt(minutes) || 0
    const newMinutes = current === 0 ? 59 : current - 1
    const m = String(newMinutes).padStart(2, '0')
    setMinutes(m)
    const h = hours || '00'
    setHours(h)
    onChange(`${h}:${m}`)
  }

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* Giờ */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={incrementHours}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-t-lg transition-colors border border-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <input
          type="number"
          min="0"
          max="23"
          value={hours}
          onChange={handleHoursChange}
          onBlur={handleHoursBlur}
          placeholder="00"
          className="w-14 h-12 text-center text-lg font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
        />
        <button
          type="button"
          onClick={decrementHours}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-b-lg transition-colors border border-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 mt-1">Giờ</span>
      </div>

      <span className="text-2xl font-bold text-gray-700 pb-6">:</span>

      {/* Phút */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={incrementMinutes}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-t-lg transition-colors border border-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <input
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={handleMinutesChange}
          onBlur={handleMinutesBlur}
          placeholder="00"
          className="w-14 h-12 text-center text-lg font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
        />
        <button
          type="button"
          onClick={decrementMinutes}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-b-lg transition-colors border border-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 mt-1">Phút</span>
      </div>
    </div>
  )
}

export default TimeInput24h

