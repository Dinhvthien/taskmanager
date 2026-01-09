import { useState, useEffect } from 'react'
import { PaperClipIcon, ArrowDownTrayIcon, TrashIcon, PhotoIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { attachmentService } from '../services/attachmentService'
import { getCurrentUser } from '../utils/auth'
import LoadingSpinner from './LoadingSpinner'

const AttachmentList = ({ attachments = [], onDelete, canDelete = false, isLoading = false }) => {
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [previewImage, setPreviewImage] = useState(null)
  
  const currentUser = getCurrentUser()
  const canUserDelete = (attachment) => {
    if (!currentUser || !currentUser.userId) return false
    // Chỉ cho phép xóa nếu là người upload file đó
    // Convert về cùng type để so sánh (có thể userId là string hoặc number)
    const userId = String(currentUser.userId)
    const uploadedBy = String(attachment.uploadedBy || '')
    return userId === uploadedBy
  }

  const handleDownload = async (attachment) => {
    try {
      const response = await attachmentService.downloadAttachment(attachment.attachmentId)
      
      // Create blob URL
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Lỗi khi tải file')
    }
  }

  const handleDelete = async (attachment) => {
    // Prevent double-click: nếu đang xóa thì return
    if (deletingIds.has(attachment.attachmentId)) {
      console.log('⏳ Already deleting attachment, skipping...', attachment.attachmentId)
      return
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa file "${attachment.fileName}"?`)) {
      return
    }

    try {
      setDeletingIds(prev => new Set([...prev, attachment.attachmentId]))
      console.log('🗑️ Attempting to delete attachment:', {
        attachmentId: attachment.attachmentId,
        fileName: attachment.fileName,
        uploadedBy: attachment.uploadedBy,
        currentUserId: currentUser?.userId
      })
      await attachmentService.deleteAttachment(attachment.attachmentId)
      console.log('✅ Attachment deleted successfully:', attachment.attachmentId)
      if (onDelete) {
        onDelete(attachment.attachmentId)
      }
    } catch (error) {
      console.error('❌ Error deleting file:', error)
      // Nếu lỗi 400 và message chứa "already deleted" thì coi như thành công (idempotent)
      const errorCode = error.response?.status
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi khi xóa file'
      
      if (errorCode === 400 && errorMessage.toLowerCase().includes('already deleted')) {
        console.log('ℹ️ Attachment already deleted (idempotent), treating as success')
        // Vẫn gọi onDelete để update UI
        if (onDelete) {
          onDelete(attachment.attachmentId)
        }
      } else {
        alert(`Lỗi khi xóa file: ${errorMessage}`)
      }
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(attachment.attachmentId)
        return newSet
      })
    }
  }

  const handlePreview = async (attachment) => {
    if (attachment.fileType?.startsWith('image/')) {
      try {
        // Load image as blob and create object URL
        const response = await attachmentService.downloadAttachment(attachment.attachmentId)
        const blob = new Blob([response.data], { type: attachment.fileType })
        const imageUrl = URL.createObjectURL(blob)
        setPreviewImage({ ...attachment, previewUrl: imageUrl })
      } catch (error) {
        console.error('Error loading image preview:', error)
        // Fallback to download
        handleDownload(attachment)
      }
    } else {
      handleDownload(attachment)
    }
  }

  // Cleanup object URLs when component unmounts or preview closes
  useEffect(() => {
    return () => {
      if (previewImage?.previewUrl) {
        URL.revokeObjectURL(previewImage.previewUrl)
      }
    }
  }, [previewImage])

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner />
      </div>
    )
  }

  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
          <PaperClipIcon className="w-4 h-4" />
          <span>Đính kèm ({attachments.length})</span>
        </div>
        {attachments.map((attachment) => {
          const isDeleting = deletingIds.has(attachment.attachmentId)
          const isImage = attachment.fileType?.startsWith('image/')
          
          return (
            <div
              key={attachment.attachmentId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div 
                className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => handlePreview(attachment)}
              >
                {isImage ? (
                  <PhotoIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                ) : (
                  <DocumentIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.fileName}
                  </p>
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <span>{attachment.formattedFileSize || attachmentService.formatFileSize(attachment.fileSize)}</span>
                    {attachment.uploadedByName && (
                      <>
                        <span>•</span>
                        <span>{attachment.uploadedByName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(attachment)
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Tải xuống"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </button>
                {canUserDelete(attachment) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(attachment)
                    }}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Xóa"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <TrashIcon className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => {
            if (previewImage.previewUrl) {
              URL.revokeObjectURL(previewImage.previewUrl)
            }
            setPreviewImage(null)
          }}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => {
                if (previewImage.previewUrl) {
                  URL.revokeObjectURL(previewImage.previewUrl)
                }
                setPreviewImage(null)
              }}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {previewImage.previewUrl ? (
              <img
                src={previewImage.previewUrl}
                alt={previewImage.fileName}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error('Error loading image preview')
                  if (previewImage.previewUrl) {
                    URL.revokeObjectURL(previewImage.previewUrl)
                  }
                  setPreviewImage(null)
                }}
              />
            ) : (
              <div className="flex items-center justify-center p-8 text-white">
                <LoadingSpinner />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default AttachmentList

