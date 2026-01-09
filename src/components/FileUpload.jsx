import { useState, useRef, useId } from 'react'
import { PaperClipIcon, XMarkIcon, PhotoIcon, DocumentIcon } from '@heroicons/react/24/outline'

const FileUpload = ({ onFileSelect, onFileRemove, selectedFiles = [], disabled = false, maxFiles = 5, maxSize = 50 * 1024 * 1024 }) => { // Default 50MB
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const uniqueId = useId() // Tạo unique ID cho mỗi instance
  const fileInputId = `file-upload-${uniqueId}`

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setError('')
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📁 FileUpload component (ID: ${fileInputId}) received ${files.length} file(s):`, files.map(f => f.name))
      console.log(`   Current selectedFiles count: ${selectedFiles.length}, maxFiles: ${maxFiles}`)
    }

    // Validate number of files
    if (selectedFiles.length + files.length > maxFiles) {
      setError(`Chỉ được chọn tối đa ${maxFiles} file`)
      return
    }

    // Validate file sizes
    const invalidFiles = files.filter(file => file.size > maxSize)
    if (invalidFiles.length > 0) {
      const invalidFileNames = invalidFiles.map(f => f.name).join(', ')
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
      const fileSizes = invalidFiles.map(f => `${f.name} (${((f.size / 1024 / 1024).toFixed(2))}MB)`).join(', ')
      setError(`File vượt quá kích thước tối đa ${maxSizeMB}MB: ${fileSizes}`)
      return
    }

    files.forEach(file => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📤 Calling onFileSelect callback for file: "${file.name}" (ID: ${fileInputId})`)
      }
      onFileSelect(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const getFileIcon = (file) => {
    if (!file.type) return <DocumentIcon className="w-5 h-5" />
    if (file.type.startsWith('image/')) return <PhotoIcon className="w-5 h-5 text-blue-500" />
    if (file.type === 'application/pdf') return <DocumentIcon className="w-5 h-5 text-red-500" />
    return <DocumentIcon className="w-5 h-5 text-gray-500" />
  }

  return (
    <div className="space-y-2">
      {/* File input */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || selectedFiles.length >= maxFiles}
          className="hidden"
          id={fileInputId}
        />
        <label
          htmlFor={fileInputId}
          className={`flex items-center justify-center px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            disabled || selectedFiles.length >= maxFiles
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
          }`}
        >
          <PaperClipIcon className="w-5 h-5 mr-2 text-gray-500" />
          <span className="text-sm text-gray-600">
            {selectedFiles.length >= maxFiles 
              ? `Đã chọn tối đa ${maxFiles} file` 
              : `Chọn file (${selectedFiles.length}/${maxFiles})`}
          </span>
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name || file.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size || file.fileSize)}
                  </p>
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onFileRemove(index)}
                  className="ml-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUpload

