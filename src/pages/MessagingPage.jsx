import { useState, useEffect, useRef, useCallback } from 'react'
import { conversationService } from '../services/conversationService'
import { messageService } from '../services/messageService'
import { userService } from '../services/userService'
import websocketService from '../services/websocketService'
import { getCurrentUser } from '../utils/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import { 
  PaperClipIcon, 
  PhotoIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  FaceSmileIcon,
  CheckIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  FolderIcon,
  VideoCameraIcon,
  LinkIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { formatDateTime, formatTime } from '../utils/dateFormat'

// Component để load và hiển thị attachment
const MessageAttachment = ({ attachment, messageId, conversationId, isMyMessage, attachmentBlobUrls, setAttachmentBlobUrls, loadingAttachments, setLoadingAttachments, failedAttachments, setFailedAttachments }) => {
  const isImage = attachment.fileType?.startsWith('image/')
  const isVideo = attachment.fileType?.startsWith('video/')
  const attachmentKey = `${messageId}-${attachment.attachmentId}`
  const blobUrl = attachmentBlobUrls[attachmentKey]
  const isLoading = loadingAttachments[attachmentKey]
  const hasFailed = failedAttachments[attachmentKey]
  
  // Load attachment via API when component mounts
  useEffect(() => {
    // Chỉ load nếu: chưa có blobUrl, chưa đang load, chưa failed, và có đủ thông tin
    if (!blobUrl && !isLoading && !hasFailed && attachment.attachmentId && messageId && conversationId) {
      setLoadingAttachments(prev => {
        // Tránh set lại nếu đã đang loading
        if (prev[attachmentKey]) return prev
        return { ...prev, [attachmentKey]: true }
      })
      
      messageService.downloadAttachment(conversationId, messageId, attachment.attachmentId)
        .then(response => {
          const blob = new Blob([response.data], { type: attachment.fileType || (isImage ? 'image/jpeg' : 'video/mp4') })
          const url = URL.createObjectURL(blob)
          setAttachmentBlobUrls(prev => ({
            ...prev,
            [attachmentKey]: url
          }))
          // Xóa khỏi failed list nếu đã load thành công
          setFailedAttachments(prev => {
            const newState = { ...prev }
            delete newState[attachmentKey]
            return newState
          })
        })
        .catch(err => {
          // Không log 404 errors (file not found là expected khi attachment đã bị xóa)
          // Chỉ log các lỗi khác
          if (err.response?.status !== 404) {
            console.error('Error loading attachment:', err)
          }
          // Đánh dấu là failed để không retry lại
          setFailedAttachments(prev => ({
            ...prev,
            [attachmentKey]: true
          }))
        })
        .finally(() => {
          setLoadingAttachments(prev => {
            const newState = { ...prev }
            delete newState[attachmentKey]
            return newState
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentKey]) // Chỉ depend vào attachmentKey để tránh re-trigger không cần thiết
  
  if (isImage) {
    if (blobUrl) {
      return (
        <img
          src={blobUrl}
          alt={attachment.fileName}
          className="max-w-full rounded-lg cursor-pointer"
          onError={(e) => {
            // Nếu blob URL bị lỗi, xóa nó và reload
            console.warn('Blob URL error, reloading attachment:', attachmentKey)
            setAttachmentBlobUrls(prev => {
              const newState = { ...prev }
              delete newState[attachmentKey]
              return newState
            })
            // Reload attachment
            setFailedAttachments(prev => {
              const newState = { ...prev }
              delete newState[attachmentKey]
              return newState
            })
          }}
          onClick={async () => {
            try {
              const link = document.createElement('a')
              link.href = blobUrl
              link.download = attachment.fileName || 'image'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            } catch (error) {
              console.error('Error downloading image:', error)
              alert('Không thể tải ảnh. Vui lòng thử lại.')
            }
          }}
        />
      )
    } else if (hasFailed) {
      return (
        <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg border border-gray-300">
          <div className="text-gray-500 text-sm text-center px-2">
            <p>File không tồn tại</p>
            <p className="text-xs mt-1">{attachment.fileName}</p>
          </div>
        </div>
      )
    } else {
      return (
        <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg">
          <div className="text-gray-400 text-sm">Đang tải ảnh...</div>
        </div>
      )
    }
  }
  
  if (isVideo) {
    if (blobUrl) {
      return (
        <video
          controls
          className="max-w-full rounded-lg"
          src={blobUrl}
          onError={(e) => {
            // Nếu blob URL bị lỗi, xóa nó và reload
            console.warn('Blob URL error, reloading attachment:', attachmentKey)
            setAttachmentBlobUrls(prev => {
              const newState = { ...prev }
              delete newState[attachmentKey]
              return newState
            })
            // Reload attachment
            setFailedAttachments(prev => {
              const newState = { ...prev }
              delete newState[attachmentKey]
              return newState
            })
          }}
        >
          Trình duyệt của bạn không hỗ trợ video.
        </video>
      )
    } else if (hasFailed) {
      return (
        <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg border border-gray-300">
          <div className="text-gray-500 text-sm text-center px-2">
            <p>File không tồn tại</p>
            <p className="text-xs mt-1">{attachment.fileName}</p>
          </div>
        </div>
      )
    } else {
      return (
        <div className="flex items-center justify-center w-64 h-48 bg-gray-100 rounded-lg">
          <div className="text-gray-400 text-sm">Đang tải video...</div>
        </div>
      )
    }
  }
  
  // Các file khác (PDF, DOC, v.v.)
  if (hasFailed) {
    return (
      <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50">
        <PaperClipIcon className="w-4 h-4 text-gray-400" />
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 line-through">{attachment.fileName}</span>
          <span className="text-xs text-red-500">File không tồn tại</span>
        </div>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100">
        <PaperClipIcon className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Đang tải...</span>
      </div>
    )
  }
  
  return (
    <a
      onClick={async (e) => {
        e.preventDefault()
        try {
          if (blobUrl) {
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = attachment.fileName || 'download'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          } else {
            const response = await messageService.downloadAttachment(conversationId, messageId, attachment.attachmentId)
            const blob = new Blob([response.data])
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = attachment.fileName || 'download'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }
        } catch (error) {
          // Không log 404 errors (file not found là expected khi attachment đã bị xóa)
          if (error.response?.status !== 404) {
            console.error('Error downloading file:', error)
          }
          // Nếu lỗi 404, đánh dấu failed và hiển thị thông báo phù hợp
          if (error.response?.status === 404) {
            setFailedAttachments(prev => ({
              ...prev,
              [attachmentKey]: true
            }))
            alert('File không tồn tại hoặc đã bị xóa.')
          } else {
            alert('Không thể tải file. Vui lòng thử lại.')
          }
        }
      }}
      href="#"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer ${
        isMyMessage 
          ? 'bg-blue-600 text-white hover:bg-blue-700' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <PaperClipIcon className="w-4 h-4" />
      <span className="text-sm truncate">{attachment.fileName}</span>
    </a>
  )
}

// Component Avatar cho user khác
const UserAvatar = ({ user, size = 10, className = '' }) => {
  const [imageError, setImageError] = useState(false)
  
  // Reset error khi user thay đổi
  useEffect(() => {
    setImageError(false)
  }, [user?.userId])
  
  const getInitials = () => {
    if (user && user.fullName) {
      const names = user.fullName.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      }
      return user.fullName[0].toUpperCase()
    }
    if (user && user.userName) {
      return user.userName[0].toUpperCase()
    }
    return 'U'
  }

  const sizeClasses = {
    8: 'w-8 h-8 text-xs',
    10: 'w-10 h-10 text-sm',
    12: 'w-12 h-12 text-base',
    16: 'w-16 h-16 text-lg',
  }

  const sizeClass = sizeClasses[size] || sizeClasses[10]

  // Luôn cố gắng load avatar từ API nếu có userId
  if (user?.userId && !imageError) {
    const avatarUrl = userService.getAvatarUrl(user.userId)
    return (
      <img
        src={avatarUrl}
        alt={user.fullName || user.userName}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    )
  }

  return (
    <div className={`${sizeClass} bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold ${className}`}>
      {getInitials()}
    </div>
  )
}

const MessagingPage = () => {
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  // Cache blob URLs cho attachments để tránh load lại nhiều lần
  const [attachmentBlobUrls, setAttachmentBlobUrls] = useState({})
  const [loadingAttachments, setLoadingAttachments] = useState({}) // Track which attachments are loading
  const [failedAttachments, setFailedAttachments] = useState({}) // Track which attachments failed to load (to avoid retry)
  const [messageContent, setMessageContent] = useState('')
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false) // Loading messages cũ hơn
  const [currentPage, setCurrentPage] = useState(0) // Page hiện tại đã load
  const [hasMoreMessages, setHasMoreMessages] = useState(true) // Còn messages để load không
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('') // For conversation search
  const [messageSearchQuery, setMessageSearchQuery] = useState('') // For message search in chat
  const [messageSearchResults, setMessageSearchResults] = useState([]) // Array of messageIds that match search
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1) // Current highlighted search result index
  const [showMessageSearch, setShowMessageSearch] = useState(false) // Show/hide message search bar
  const messageSearchRefs = useRef({}) // Refs to scroll to messages
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [newConversationType, setNewConversationType] = useState('direct')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [messageMenuOpen, setMessageMenuOpen] = useState(null) // messageId của message đang mở menu
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null) // { messageId, isMyMessage }
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null) // messageId của message đang mở emoji picker
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false) // Emoji picker cho phần gửi tin nhắn
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false) // Menu 3 chấm trong chat header
  const [showFileManagerModal, setShowFileManagerModal] = useState(false) // Modal quản lý file
  const [fileManagerTab, setFileManagerTab] = useState('images') // Tab hiện tại: 'images', 'videos', 'links', 'files'
  const [allAttachments, setAllAttachments] = useState([]) // Tất cả attachments của conversation
  const [loadingAllAttachments, setLoadingAllAttachments] = useState(false) // Loading attachments for file manager
  const [showParticipantsModal, setShowParticipantsModal] = useState(false) // Modal danh sách thành viên
  const [removedFromConversation, setRemovedFromConversation] = useState(false) // Track khi user bị xóa khỏi conversation
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false) // Modal thêm thành viên
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]) // Users được chọn để thêm vào nhóm
  const [showEditGroupModal, setShowEditGroupModal] = useState(false) // Modal chỉnh sửa thông tin nhóm
  const [editGroupName, setEditGroupName] = useState('') // Tên nhóm đang chỉnh sửa
  const [fileContextMenu, setFileContextMenu] = useState(null) // { attachmentId, x, y } cho context menu của file
  const [pinnedMessage, setPinnedMessage] = useState(null) // Tin nhắn đã ghim hiện tại
  const [allPinnedMessages, setAllPinnedMessages] = useState([]) // Tất cả tin nhắn đã ghim
  const [showPinnedMessagesList, setShowPinnedMessagesList] = useState(false) // Hiển thị danh sách pinned messages
  
  const messagesEndRef = useRef(null)
  const userMessageSubscriptionKeyRef = useRef(null) // For DELETE_FOR_ME notifications
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const previousConversationIdRef = useRef(null) // Track previous conversation for blob cleanup
  const currentUser = getCurrentUser()
  const subscriptionKeyRef = useRef(null)
  const conversationSubscriptionKeyRef = useRef(null)
  const isLoadingMessagesRef = useRef(false)
  const loadConversationsTimeoutRef = useRef(null)
  const messagesContainerRef = useRef(null) // Ref cho messages container
  const scrollPositionRef = useRef({ height: 0, top: 0 }) // Lưu scroll position khi load older messages

  // Sort conversations by updatedAt (most recent first) or lastMessage.createdAt
  const sortConversations = (convs) => {
    return [...convs].sort((a, b) => {
      // Ưu tiên sort theo lastMessage.createdAt nếu có
      const aTime = a.lastMessage?.createdAt 
        ? new Date(a.lastMessage.createdAt).getTime()
        : a.updatedAt 
        ? new Date(a.updatedAt).getTime()
        : 0
      
      const bTime = b.lastMessage?.createdAt 
        ? new Date(b.lastMessage.createdAt).getTime()
        : b.updatedAt 
        ? new Date(b.updatedAt).getTime()
        : 0
      
      // Sort descending (most recent first)
      return bTime - aTime
    })
  }

  // Load conversations (with loading state - for initial load)
  const loadConversations = async () => {
    try {
      setLoading(true)
      const response = await conversationService.getMyConversations()
      const conversations = response.data.result || []
      setConversations(sortConversations(conversations))
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Refresh conversations (without loading state - for real-time updates)
  const refreshConversations = async () => {
    try {
      const response = await conversationService.getMyConversations()
      const conversations = response.data.result || []
      setConversations(sortConversations(conversations))
    } catch (error) {
      console.error('Error refreshing conversations:', error)
    }
  }

  // Move conversation to top of list (for real-time updates)
  const moveConversationToTop = (conversationId) => {
    setConversations(prev => {
      const conversation = prev.find(c => c.conversationId === conversationId)
      if (!conversation) return prev
      
      // Nếu conversation đã ở đầu rồi, không cần làm gì
      if (prev[0]?.conversationId === conversationId) {
        return prev
      }
      
      // Remove conversation from current position
      const otherConversations = prev.filter(c => c.conversationId !== conversationId)
      
      // Update conversation's updatedAt to now to ensure it stays on top
      const updatedConversation = {
        ...conversation,
        updatedAt: new Date().toISOString()
      }
      
      // Put it at the top
      return [updatedConversation, ...otherConversations]
    })
  }

  // Load all pinned messages (sử dụng API riêng để tối ưu)
  const loadPinnedMessages = useCallback(async () => {
    if (!selectedConversation) return
    
    try {
      // Sử dụng API riêng để lấy chỉ pinned messages (nhanh hơn nhiều)
      const response = await messageService.getPinnedMessages(selectedConversation.conversationId)
      const pinnedMessages = response.data.result || []
      
      setAllPinnedMessages(pinnedMessages)
      
      // Set pinned message hiện tại (mới nhất)
      if (pinnedMessages.length > 0) {
        setPinnedMessage(pinnedMessages[0])
      } else {
        setPinnedMessage(null)
      }
    } catch (error) {
      // Chỉ log lỗi nếu không phải 404 (có thể chưa có pinned messages)
      if (error.response?.status !== 404) {
        console.error('Error loading pinned messages:', error)
      }
      setPinnedMessage(null)
      setAllPinnedMessages([])
    }
  }, [selectedConversation?.conversationId])

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!selectedConversation) return
    
    // Prevent multiple simultaneous calls
    if (isLoadingMessagesRef.current) {
      return
    }
    
    try {
      isLoadingMessagesRef.current = true
      setMessagesLoading(true)
      const response = await messageService.getMessages(selectedConversation.conversationId, 0, 20)
      const messagesData = response.data.result?.content || []
      const totalPages = response.data.result?.totalPages || 0
      
      // Backend trả về messages từ mới đến cũ, cần reverse để hiển thị từ cũ đến mới (oldest first)
      // Remove duplicates by messageId
      const uniqueMessages = messagesData.reverse().filter((message, index, self) =>
        index === self.findIndex(m => m.messageId === message.messageId)
      )
      setMessages(uniqueMessages)
      
      // Load pinned messages song song (không chờ để không làm chậm)
      loadPinnedMessages()
      
      // Set pagination state
      setCurrentPage(0)
      setHasMoreMessages(totalPages > 1)
      
      // Mark as read after loading
      await messageService.markAllMessagesAsRead(selectedConversation.conversationId)
      refreshConversations() // Update unread count without loading state
      
      // Scroll to bottom after messages loaded (use instant scroll for initial load)
      setTimeout(() => {
        scrollToBottomInstant()
      }, 150)
    } catch (error) {
      console.error('Error loading messages:', error)
      // Nếu lỗi là 400 hoặc 403, có thể user đã bị xóa khỏi conversation
      if (error.response?.status === 400 || error.response?.status === 403) {
        setRemovedFromConversation(true)
        setMessages([])
        // Remove conversation from list
        setConversations(prev => prev.filter(c => c.conversationId !== selectedConversation.conversationId))
      }
    } finally {
      setMessagesLoading(false)
      isLoadingMessagesRef.current = false
    }
  }, [selectedConversation?.conversationId])

  // Load older messages (infinite scroll)
  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversation || loadingOlderMessages || !hasMoreMessages) return
    
    try {
      setLoadingOlderMessages(true)
      const nextPage = currentPage + 1
      const response = await messageService.getMessages(selectedConversation.conversationId, nextPage, 20)
      const messagesData = response.data.result?.content || []
      const totalPages = response.data.result?.totalPages || 0
      
      if (messagesData.length === 0) {
        setHasMoreMessages(false)
        return
      }
      
      // Backend trả về messages từ mới đến cũ, cần reverse để hiển thị từ cũ đến mới (oldest first)
      const newMessages = messagesData.reverse().filter((message, index, self) =>
        index === self.findIndex(m => m.messageId === message.messageId)
      )
      
      // Lưu scroll position trước khi thêm messages (sử dụng ref để đảm bảo lấy được element chính xác)
      const messagesContainer = messagesContainerRef.current || document.querySelector('.messages-container')
      if (messagesContainer) {
        scrollPositionRef.current = {
          height: messagesContainer.scrollHeight,
          top: messagesContainer.scrollTop
        }
      }
      
      // Append messages cũ hơn vào đầu danh sách
      setMessages(prev => {
        // Remove duplicates
        const existingIds = new Set(prev.map(m => m.messageId))
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.messageId))
        return [...uniqueNewMessages, ...prev]
      })
      
      // Update pagination state
      setCurrentPage(nextPage)
      setHasMoreMessages(nextPage < totalPages - 1)
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setLoadingOlderMessages(false)
    }
  }, [selectedConversation?.conversationId, currentPage, hasMoreMessages, loadingOlderMessages])

  // Restore scroll position sau khi messages được render
  useEffect(() => {
    if (scrollPositionRef.current.height > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const { height: previousHeight, top: previousTop } = scrollPositionRef.current
      
      // Sử dụng double requestAnimationFrame để đảm bảo DOM đã render xong hoàn toàn
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newHeight = container.scrollHeight
          const heightDifference = newHeight - previousHeight
          if (heightDifference > 0) {
            container.scrollTop = previousTop + heightDifference
            // Reset scroll position ref sau khi đã restore
            scrollPositionRef.current = { height: 0, top: 0 }
          }
        })
      })
    }
  }, [messages.length]) // Trigger khi messages thay đổi

  // Handle scroll to detect when user scrolls to top
  const handleMessagesScroll = useCallback((e) => {
    const container = e.target
    // Nếu scroll gần đến đầu (trong vòng 100px), load thêm messages cũ
    if (container.scrollTop < 100 && hasMoreMessages && !loadingOlderMessages) {
      loadOlderMessages()
    }
  }, [hasMoreMessages, loadingOlderMessages, loadOlderMessages])
  
  // Load all attachments from conversation (for file manager)
  const loadAllAttachments = async () => {
    if (!selectedConversation) return
    
    try {
      setLoadingAllAttachments(true)
      // Load tất cả messages (có thể cần load nhiều page)
      let allMessages = []
      let page = 0
      let hasMore = true
      
      while (hasMore) {
        const response = await messageService.getMessages(selectedConversation.conversationId, page, 100)
        const messagesData = response.data.result?.content || []
        if (messagesData.length === 0) {
          hasMore = false
        } else {
          allMessages = [...allMessages, ...messagesData]
          page++
          // Giới hạn tối đa 1000 messages để tránh quá tải
          if (allMessages.length >= 1000) {
            hasMore = false
          }
        }
      }
      
      // Lấy tất cả attachments từ messages
      const attachments = []
      allMessages.forEach(message => {
        if (message.attachments && message.attachments.length > 0) {
          message.attachments.forEach(att => {
            attachments.push({
              ...att,
              messageId: message.messageId,
              messageContent: message.content,
              senderId: message.senderId,
              senderName: message.senderFullName || message.senderUserName,
              createdAt: message.createdAt
            })
          })
        }
      })
      
      setAllAttachments(attachments)
    } catch (error) {
      console.error('Error loading attachments:', error)
    } finally {
      setLoadingAllAttachments(false)
    }
  }

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])
  
  // Load attachments for file manager when modal opens or tab changes
  useEffect(() => {
    if (showFileManagerModal && selectedConversation && allAttachments.length > 0) {
      // Load attachments that are images or videos and don't have blobUrl yet
      allAttachments.forEach(att => {
        const attachmentKey = `${att.messageId}-${att.attachmentId}`
        const blobUrl = attachmentBlobUrls[attachmentKey]
        const isImage = att.fileType?.startsWith('image/')
        const isVideo = att.fileType?.startsWith('video/')
        
        // Chỉ load ảnh và video, và chỉ load khi đang ở tab tương ứng
        if ((isImage && fileManagerTab === 'images') || (isVideo && fileManagerTab === 'videos')) {
          if (!blobUrl && att.attachmentId && att.messageId && selectedConversation?.conversationId) {
            messageService.downloadAttachment(
              selectedConversation.conversationId,
              att.messageId,
              att.attachmentId
            )
              .then(response => {
                const blob = new Blob([response.data], { type: att.fileType || (isImage ? 'image/jpeg' : 'video/mp4') })
                const url = URL.createObjectURL(blob)
                setAttachmentBlobUrls(prev => ({
                  ...prev,
                  [attachmentKey]: url
                }))
              })
              .catch(() => {
                // Ignore errors
              })
          }
        }
      })
    }
  }, [showFileManagerModal, fileManagerTab, allAttachments, selectedConversation?.conversationId])
  
  // Cleanup blob URLs when conversation changes (but not on unmount to avoid errors)
  useEffect(() => {
    // Chỉ revoke blob URLs của conversation cũ khi conversation thay đổi
    if (previousConversationIdRef.current && previousConversationIdRef.current !== selectedConversation?.conversationId) {
      // Revoke blob URLs của conversation cũ
      setAttachmentBlobUrls(prev => {
        const newState = { ...prev }
        Object.entries(prev).forEach(([key, url]) => {
          // Chỉ revoke nếu là blob URL của conversation cũ (key format: messageId-attachmentId)
          // Tạm thời revoke tất cả vì không thể biết messageId thuộc conversation nào
          if (url && url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(url)
            } catch (error) {
              // Ignore errors khi revoke (có thể đã bị revoke rồi)
            }
          }
        })
        // Clear tất cả blob URLs khi đổi conversation
        return {}
      })
    }
    
    previousConversationIdRef.current = selectedConversation?.conversationId
  }, [selectedConversation?.conversationId])

  // Setup WebSocket for conversations list
  useEffect(() => {
    const setupConversationWebSocket = async () => {
      try {
        // Đảm bảo WebSocket đã kết nối
        if (!websocketService.isConnectedToServer()) {
          await websocketService.connect()
          // Đợi thêm một chút để đảm bảo connection thực sự ready
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        const topic = `/topic/user/${currentUser?.userId}/conversations`
        
        if (conversationSubscriptionKeyRef.current) {
          websocketService.unsubscribe(conversationSubscriptionKeyRef.current)
        }

        conversationSubscriptionKeyRef.current = await websocketService.subscribe(topic, (data) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Received conversation update via WebSocket:', data)
          }
          
          // Nếu có conversationId, di chuyển conversation lên đầu ngay lập tức
          if (data.conversationId) {
            moveConversationToTop(data.conversationId)
          }
          
          // Sau đó refresh để cập nhật thông tin mới nhất (lastMessage, unreadCount)
          refreshConversations() // Refresh without loading state
        })
      } catch (error) {
        console.error('Error setting up WebSocket for conversations:', error)
        // Retry sau 1 giây nếu thất bại
        setTimeout(() => {
          if (currentUser?.userId) {
            setupConversationWebSocket()
          }
        }, 1000)
      }
    }

    if (currentUser?.userId) {
      setupConversationWebSocket()
    }

    return () => {
      if (conversationSubscriptionKeyRef.current) {
        websocketService.unsubscribe(conversationSubscriptionKeyRef.current)
        conversationSubscriptionKeyRef.current = null
      }
    }
  }, [currentUser?.userId])

  // Setup WebSocket for messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation) return

    const setupMessageWebSocket = async () => {
      try {
        if (!websocketService.isConnectedToServer()) {
          await websocketService.connect()
        }

        const topic = `/topic/conversation/${selectedConversation.conversationId}/messages`
        
        if (subscriptionKeyRef.current) {
          websocketService.unsubscribe(subscriptionKeyRef.current)
        }

        subscriptionKeyRef.current = await websocketService.subscribe(topic, (data) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Received message via WebSocket:', data)
          }
          
          if (data.type === 'MESSAGE_DELETED') {
            // DELETE_FOR_EVERYONE: Remove message for all users
            setMessages(prev => prev.filter(m => m.messageId !== data.messageId))
            // Update conversations list to refresh lastMessage
            if (loadConversationsTimeoutRef.current) {
              clearTimeout(loadConversationsTimeoutRef.current)
            }
            loadConversationsTimeoutRef.current = setTimeout(() => {
              refreshConversations() // Refresh without loading state
            }, 300)
          } else if (data.type === 'MESSAGE_UPDATED') {
            // Cập nhật message trong danh sách
            if (data.message) {
              setMessages(prev => prev.map(m => 
                m.messageId === data.message.messageId ? data.message : m
              ))
              
              // Cập nhật pinned message nếu có
              if (data.message.pinned) {
                setPinnedMessage(data.message)
              } else {
                // Nếu message này đang được ghim và bị bỏ ghim, clear pinned message
                if (pinnedMessage && pinnedMessage.messageId === data.message.messageId) {
                  setPinnedMessage(null)
                }
              }
            }
            // Update conversations list to refresh lastMessage
            if (loadConversationsTimeoutRef.current) {
              clearTimeout(loadConversationsTimeoutRef.current)
            }
            loadConversationsTimeoutRef.current = setTimeout(() => {
              refreshConversations() // Refresh without loading state
            }, 300)
          } else if (data.type === 'PINNED_MESSAGE_UPDATED') {
            // Reload pinned messages
            if (selectedConversation) {
              loadPinnedMessages()
            }
          } else if (data.type === 'MESSAGE_READ') {
            // Update read status for specific message
            setMessages(prev => prev.map(m => 
              m.messageId === data.messageId 
                ? { ...m, isRead: true, readByUserIds: [...(m.readByUserIds || []), data.userId] }
                : m
            ))
          } else if (data.type === 'ALL_MESSAGES_READ') {
            // Update all messages as read, but don't reload to avoid infinite loop
            setMessages(prev => prev.map(m => ({ ...m, isRead: true })))
            refreshConversations() // Refresh without loading state
          } else if (data.type === 'REACTION_UPDATED') {
            // Reload reactions for the message
            if (selectedConversation) {
              messageService.getMessageById(selectedConversation.conversationId, data.messageId)
                .then(res => {
                  setMessages(prev => prev.map(m => 
                    m.messageId === data.messageId 
                      ? { ...m, reactions: res.data.result.reactions || [] }
                      : m
                  ))
                })
                .catch(err => console.error('Error loading reactions:', err))
            }
          } else if (data.type === 'PARTICIPANT_REMOVED') {
            // Participant bị xóa khỏi nhóm
            if (data.userId === currentUser?.userId) {
              // Nếu là chính user hiện tại bị xóa, hiển thị thông báo và đóng conversation
              setRemovedFromConversation(true)
              if (subscriptionKeyRef.current) {
                websocketService.unsubscribe(subscriptionKeyRef.current)
                subscriptionKeyRef.current = null
              }
              // Không đóng conversation ngay, để hiển thị thông báo
              setMessages([])
              refreshConversations() // Refresh conversations list để xóa conversation khỏi list
            } else {
              // Nếu là người khác bị xóa, chỉ refresh conversations list
              refreshConversations()
            }
          } else {
            const newMessage = data.message || data
            if (!newMessage.messageId) return // Skip if no messageId
            
            setMessages(prev => {
              // Check for duplicate by messageId
              if (prev.some(m => m.messageId === newMessage.messageId)) {
                return prev
              }
              return [...prev, newMessage]
            })
            if (newMessage.senderId !== currentUser?.userId) {
              messageService.markMessageAsRead(selectedConversation.conversationId, newMessage.messageId)
                .catch(err => console.error('Error marking message as read:', err))
            }
            
            // Update conversation in list immediately to move it to top
            // Di chuyển conversation lên đầu ngay lập tức
            moveConversationToTop(newMessage.conversationId)
            
            // Cập nhật lastMessage và updatedAt
            setConversations(prev => {
              return prev.map(conv => {
                if (conv.conversationId === newMessage.conversationId) {
                  return {
                    ...conv,
                    lastMessage: {
                      ...newMessage,
                      content: newMessage.content,
                      createdAt: newMessage.createdAt
                    },
                    updatedAt: newMessage.createdAt
                  }
                }
                return conv
              })
            })
            
            // Update conversations list to refresh lastMessage and unreadCount
            // Use debounce to avoid too many calls
            if (loadConversationsTimeoutRef.current) {
              clearTimeout(loadConversationsTimeoutRef.current)
            }
            loadConversationsTimeoutRef.current = setTimeout(() => {
              refreshConversations() // Refresh without loading state
            }, 300)
          }
        })
      } catch (error) {
        console.error('Error setting up WebSocket for messages:', error)
      }
    }

    setupMessageWebSocket()

    return () => {
      if (subscriptionKeyRef.current) {
        websocketService.unsubscribe(subscriptionKeyRef.current)
        subscriptionKeyRef.current = null
      }
      if (loadConversationsTimeoutRef.current) {
        clearTimeout(loadConversationsTimeoutRef.current)
        loadConversationsTimeoutRef.current = null
      }
    }
  }, [selectedConversation?.conversationId, currentUser?.userId, loadMessages])

  // Setup WebSocket for user-specific message deletions (DELETE_FOR_ME)
  useEffect(() => {
    if (!currentUser?.userId) return

    const setupUserMessageWebSocket = async () => {
      try {
        // Đảm bảo WebSocket đã kết nối
        if (!websocketService.isConnectedToServer()) {
          await websocketService.connect()
          // Đợi thêm một chút để đảm bảo connection thực sự ready
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        const topic = `/topic/user/${currentUser.userId}/messages`
        
        if (userMessageSubscriptionKeyRef.current) {
          websocketService.unsubscribe(userMessageSubscriptionKeyRef.current)
        }

        userMessageSubscriptionKeyRef.current = await websocketService.subscribe(topic, (data) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Received user-specific message update via WebSocket:', data)
          }
          
          if (data.type === 'MESSAGE_DELETED') {
            // DELETE_FOR_ME: Only remove message for this user (soft delete)
            setMessages(prev => prev.filter(m => m.messageId !== data.messageId))
            // Update conversations list to refresh lastMessage
            if (loadConversationsTimeoutRef.current) {
              clearTimeout(loadConversationsTimeoutRef.current)
            }
            loadConversationsTimeoutRef.current = setTimeout(() => {
              refreshConversations() // Refresh without loading state
            }, 300)
          } else {
            // Handle new message received (when not viewing the conversation)
            // This could be a new message from another user
            // Update conversations list to refresh lastMessage and unreadCount
            if (loadConversationsTimeoutRef.current) {
              clearTimeout(loadConversationsTimeoutRef.current)
            }
            loadConversationsTimeoutRef.current = setTimeout(() => {
              refreshConversations() // Refresh without loading state
            }, 300)
          }
        })
      } catch (error) {
        console.error('Error setting up WebSocket for user messages:', error)
        // Retry sau 1 giây nếu thất bại
        setTimeout(() => {
          if (currentUser?.userId) {
            setupUserMessageWebSocket()
          }
        }, 1000)
      }
    }

    setupUserMessageWebSocket()

    return () => {
      if (userMessageSubscriptionKeyRef.current) {
        websocketService.unsubscribe(userMessageSubscriptionKeyRef.current)
        userMessageSubscriptionKeyRef.current = null
      }
    }
  }, [currentUser?.userId])

  // Restore scroll position sau khi messages được render (khi load older messages)
  useEffect(() => {
    if (scrollPositionRef.current.height > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const { height: previousHeight, top: previousTop } = scrollPositionRef.current
      
      // Sử dụng requestAnimationFrame để đảm bảo DOM đã render xong
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newHeight = container.scrollHeight
          const heightDifference = newHeight - previousHeight
          if (heightDifference > 0) {
            container.scrollTop = previousTop + heightDifference
            // Reset scroll position ref sau khi đã restore
            scrollPositionRef.current = { height: 0, top: 0 }
          }
        })
      })
    }
  }, [messages.length]) // Trigger khi messages thay đổi

  // Auto scroll to bottom when new messages arrive (chỉ khi không đang load older messages)
  useEffect(() => {
    if (messages.length > 0 && scrollPositionRef.current.height === 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom()
      }, 50)
    }
  }, [messages])
  
  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      // Wait for messages to load, then scroll
      setTimeout(() => {
        scrollToBottomInstant()
      }, 300)
    }
  }, [selectedConversation?.conversationId])

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [messageContent])


  useEffect(() => {
    if (selectedConversation) {
      loadMessages()
    } else {
      setMessages([])
    }
  }, [selectedConversation?.conversationId]) // Only depend on conversationId to avoid re-running

  const scrollToBottom = () => {
    // Try to scroll using messagesEndRef first
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    
    // Fallback: directly scroll the messages container to bottom
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }, 50)
  }
  
  const scrollToBottomInstant = () => {
    // Instant scroll (no animation) - useful when loading messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
    }
    
    // Fallback: directly scroll the messages container to bottom
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }, 50)
  }

  const handleSendMessage = async () => {
    if (!selectedConversation || (!messageContent.trim() && selectedFiles.length === 0)) return

    try {
      setSending(true)
      
      if (selectedFiles.length > 0) {
        // Cho phép gửi file mà không cần nội dung tin nhắn
        const response = await messageService.sendMessageWithFiles(
          selectedConversation.conversationId,
          messageContent.trim() || '', // Cho phép empty string
          selectedFiles,
          replyToMessage?.messageId
        )
        setMessages(prev => [...prev, response.data.result])
      } else {
        const response = await messageService.sendMessage(
          selectedConversation.conversationId,
          messageContent,
          replyToMessage?.messageId
        )
        setMessages(prev => [...prev, response.data.result])
      }
      
      setMessageContent('')
      setReplyToMessage(null)
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      
      // Di chuyển conversation lên đầu ngay lập tức khi gửi tin nhắn
      if (selectedConversation) {
        moveConversationToTop(selectedConversation.conversationId)
      }
      
      refreshConversations() // Refresh conversations list without loading state
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      console.error('Error details:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi không xác định'
      alert('Lỗi khi gửi tin nhắn: ' + errorMessage)
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB in bytes
    
    // Log file info để debug
    files.forEach(file => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      console.log(`File selected: ${file.name}, size: ${sizeMB}MB, type: ${file.type}`)
    })
    
    // Validate file size
    const invalidFiles = files.filter(file => file.size > MAX_FILE_SIZE)
    if (invalidFiles.length > 0) {
      const fileNames = invalidFiles.map(f => {
        const sizeMB = (f.size / (1024 * 1024)).toFixed(2)
        return `${f.name} (${sizeMB}MB)`
      }).join(', ')
      alert(`Các file sau vượt quá giới hạn 100MB: ${fileNames}`)
      return
    }
    
    setSelectedFiles(prev => [...prev, ...files])
  }

  const handleFileRemove = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDeleteMessage = async (messageId, deleteType) => {
    if (!selectedConversation) return

    try {
      await messageService.deleteMessage(selectedConversation.conversationId, messageId, deleteType)
      
      if (deleteType === 'DELETE_FOR_EVERYONE') {
        // Xóa hết - remove khỏi list
        setMessages(prev => prev.filter(m => m.messageId !== messageId))
      } else {
        // Xóa ở phía bạn - remove khỏi list (vì user không thấy nữa)
        setMessages(prev => prev.filter(m => m.messageId !== messageId))
      }
      
      setShowDeleteConfirm(null)
      setMessageMenuOpen(null)
      refreshConversations() // Update unread count without loading state
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('Lỗi khi xóa tin nhắn: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  // Hàm kiểm tra xem string có chỉ chứa emoji không
  // Highlight search text in message content
  const highlightSearchText = (text, searchQuery) => {
    if (!text || !searchQuery) return text
    
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={index} className="bg-yellow-300 text-gray-900 px-0.5 rounded">{part}</mark>
      ) : part
    )
  }
  
  // Search messages in current conversation
  const searchMessages = useCallback((query) => {
    if (!query.trim() || !selectedConversation) {
      setMessageSearchResults([])
      setCurrentSearchIndex(-1)
      return
    }
    
    const lowerQuery = query.toLowerCase()
    const results = messages
      .filter(msg => {
        // Search in message content
        if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
          return true
        }
        // Search in attachment file names
        if (msg.attachments && msg.attachments.some(att => 
          att.fileName && att.fileName.toLowerCase().includes(lowerQuery)
        )) {
          return true
        }
        return false
      })
      .map(msg => msg.messageId)
    
    setMessageSearchResults(results)
    if (results.length > 0) {
      setCurrentSearchIndex(0)
      // Scroll to first result
      setTimeout(() => {
        const firstMessageId = results[0]
        const messageElement = messageSearchRefs.current[firstMessageId]
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } else {
      setCurrentSearchIndex(-1)
    }
  }, [messages, selectedConversation])
  
  // Download attachment file
  const downloadAttachment = async (attachment) => {
    if (!selectedConversation || !attachment.messageId || !attachment.attachmentId) return
    
    try {
      const response = await messageService.downloadAttachment(
        selectedConversation.conversationId,
        attachment.messageId,
        attachment.attachmentId
      )
      
      // Tạo blob URL và download
      const blob = new Blob([response.data], { type: attachment.fileType || 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      setFileContextMenu(null)
    } catch (error) {
      console.error('Error downloading attachment:', error)
      alert('Không thể tải file xuống')
    }
  }

  // Load and scroll to a specific message
  const scrollToMessage = async (messageId) => {
    if (!messageId || !selectedConversation) return
    
    // Kiểm tra xem message đã có trong danh sách messages hiện tại chưa
    const existingMessage = messages.find(m => m.messageId === messageId)
    
    if (!existingMessage) {
      // Nếu chưa có, load message đó
      try {
        const response = await messageService.getMessageById(selectedConversation.conversationId, messageId)
        const messageData = response.data.result
        
        if (messageData) {
          // Thêm message vào danh sách messages
          setMessages(prev => {
            // Kiểm tra xem đã có chưa để tránh duplicate
            const exists = prev.find(m => m.messageId === messageId)
            if (exists) return prev
            
            // Sắp xếp theo createdAt và thêm message vào đúng vị trí
            const newMessages = [...prev, messageData]
            return newMessages.sort((a, b) => {
              const timeA = new Date(a.createdAt).getTime()
              const timeB = new Date(b.createdAt).getTime()
              return timeA - timeB // Sắp xếp từ cũ đến mới
            })
          })
          
          // Đợi React render message mới
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error) {
        console.error('Error loading message:', error)
        return
      }
    }
    
    // Scroll đến message
    const scrollToElement = () => {
      const messageElement = messageSearchRefs.current[messageId]
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Highlight briefly
        messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
        }, 2000)
        return true
      }
      return false
    }
    
    // Thử scroll ngay
    if (!scrollToElement()) {
      // Nếu chưa có element, đợi thêm một chút rồi thử lại
      setTimeout(() => {
        if (!scrollToElement()) {
          // Nếu vẫn không có, thử lại sau 500ms nữa
          setTimeout(scrollToElement, 500)
        }
      }, 300)
    }
  }

  // Pin message
  const handlePinMessage = async (messageId) => {
    if (!selectedConversation) return
    
    try {
      const response = await messageService.pinMessage(selectedConversation.conversationId, messageId)
      const updatedMessage = response.data.result
      
      console.log('Pin message response:', updatedMessage)
      
      // Cập nhật message trong danh sách
      setMessages(prev => prev.map(m => 
        m.messageId === messageId ? { ...m, ...updatedMessage, pinned: true } : { ...m, pinned: false }
      ))
      
      // Set pinned message
      setPinnedMessage({ ...updatedMessage, pinned: true })
      
      // Reload all pinned messages
      await loadPinnedMessages()
      
      // Đóng menu
      setMessageMenuOpen(null)
    } catch (error) {
      console.error('Error pinning message:', error)
      alert('Không thể ghim tin nhắn: ' + (error.response?.data?.message || error.message))
    }
  }

  // Unpin message
  const handleUnpinMessage = async (messageId) => {
    if (!selectedConversation) return
    
    try {
      const response = await messageService.unpinMessage(selectedConversation.conversationId, messageId)
      const updatedMessage = response.data.result
      
      console.log('Unpin message response:', updatedMessage)
      
      // Cập nhật message trong danh sách
      setMessages(prev => prev.map(m => 
        m.messageId === messageId ? { ...m, ...updatedMessage, pinned: false } : m
      ))
      
      // Clear pinned message
      setPinnedMessage(null)
      
      // Reload all pinned messages
      await loadPinnedMessages()
      
      // Đóng menu
      setMessageMenuOpen(null)
    } catch (error) {
      console.error('Error unpinning message:', error)
      alert('Không thể bỏ ghim tin nhắn: ' + (error.response?.data?.message || error.message))
    }
  }

  // Navigate to next/previous search result
  const navigateSearchResult = (direction) => {
    if (messageSearchResults.length === 0) return
    
    let newIndex = currentSearchIndex
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % messageSearchResults.length
    } else {
      newIndex = currentSearchIndex <= 0 ? messageSearchResults.length - 1 : currentSearchIndex - 1
    }
    
    setCurrentSearchIndex(newIndex)
    const messageId = messageSearchResults[newIndex]
    const messageElement = messageSearchRefs.current[messageId]
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight briefly
      messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
      }, 1000)
    }
  }
  
  // Handle message search input change
  useEffect(() => {
    if (messageSearchQuery) {
      searchMessages(messageSearchQuery)
    } else {
      setMessageSearchResults([])
      setCurrentSearchIndex(-1)
    }
  }, [messageSearchQuery, searchMessages])
  
  // Clear search when conversation changes
  useEffect(() => {
    setMessageSearchQuery('')
    setMessageSearchResults([])
    setCurrentSearchIndex(-1)
    messageSearchRefs.current = {}
    setPinnedMessage(null) // Clear pinned message when conversation changes
    setAllPinnedMessages([])
    setShowPinnedMessagesList(false)
  }, [selectedConversation?.conversationId])
  
  const isOnlyEmojis = (text) => {
    if (!text || !text.trim()) return false
    const trimmed = text.trim()
    
    // Loại bỏ khoảng trắng để kiểm tra
    const withoutSpaces = trimmed.replace(/\s/g, '')
    if (!withoutSpaces) return false
    
    // Kiểm tra xem có chứa số không (0-9) - nếu có số thì không phải "chỉ có emoji"
    if (/[0-9]/.test(withoutSpaces)) {
      return false
    }
    
    // Kiểm tra xem có chứa chữ cái không (a-z, A-Z) - nếu có chữ thì không phải "chỉ có emoji"
    if (/[a-zA-Z]/.test(withoutSpaces)) {
      return false
    }
    
    // Kiểm tra xem có chứa dấu câu thông thường không - nếu có thì không phải "chỉ có emoji"
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(withoutSpaces)) {
      return false
    }
    
    // Kiểm tra xem có chứa chữ cái có dấu (tiếng Việt, v.v.) không
    if (/[\u00C0-\u024F\u1E00-\u1EFF]/.test(withoutSpaces)) {
      return false
    }
    
    // Nếu không có số, chữ, dấu câu, thì kiểm tra xem có emoji không
    // Loại bỏ tất cả emoji và các ký tự đặc biệt của emoji, xem còn gì không
    const withoutEmojis = withoutSpaces.replace(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '')
    if (withoutEmojis.length > 0) {
      return false // Còn ký tự không phải emoji
    }
    
    // Kiểm tra xem có ít nhất 1 emoji không
    const emojiRegex = /[\p{Emoji}\p{Emoji_Presentation}]/u
    return emojiRegex.test(withoutSpaces)
  }

  // Common emojis for quick access
  const commonEmojis = [
    // Faces & Emotions
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤯', '😳', '🥺', '😦', '😧', '😮', '😯', '😲', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥱', '😤', '😮‍💨', '😵', '😵‍💫', '🤐', '😪', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕',
    
    // Gestures & Body Parts
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
    '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
    
    // Hearts & Love
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    
    // Objects & Symbols
    '🔥', '💯', '✨', '⭐', '🌟', '💫', '💥', '💢', '💤', '💨', '💦', '💧', '🌊', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈',
    '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '🥃', '🥤', '🧃', '🧉', '🧊',
    
    // Food & Drink
    '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🥞', '🧇', '🥨', '🥯', '🥖', '🍞', '🥐', '🥨', '🧀', '🥗',
    '🥙', '🥪', '🌮', '🌯', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮',
    '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛',
    '🍼', '☕️', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊',
    
    // Animals & Nature
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
    '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋',
    '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖',
    '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🦅', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜', '🐓',
    
    // Travel & Places
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼',
    '🚁', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞',
    '🚟', '🚠', '🚡', '⛱️', '🎆', '🎇', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎀', '🎁', '🎗️', '🎟️',
    
    // Activities & Sports
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣',
    '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🧘', '🏌️',
    
    // Flags & Countries
    '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼',
    
    // Misc
    '✅', '❌', '⭕', '🆗', '🆕', '🆓', '🆒', '🆙', '🆚', '🈁', '🈂️', '🈷️', '🈶', '🈯', '🉐', '🈹', '🈲', '🉑', '🈸', '🈴',
    '🈳', '㊗️', '㊙️', '🈺', '🈵', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻',
    '💠', '🔘', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈',
    '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒',
    '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦',
    '🕧', '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
    '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
    '🔌', '💡', '🔦', '🕯️', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️',
    '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿',
    '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚿',
    '🛁', '🛀', '🧼', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈',
    '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉',
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣',
    '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🧘', '🏌️'
  ]
  
  const handleAddReaction = async (messageId, emoji) => {
    if (!selectedConversation) return

    try {
      const response = await messageService.addReaction(
        selectedConversation.conversationId, 
        messageId, 
        emoji
      )
      
      // Nếu response null, reaction đã bị xóa (toggle)
      if (response.data.result) {
        // Reload message để lấy reactions mới nhất
        const messageRes = await messageService.getMessageById(
          selectedConversation.conversationId, 
          messageId
        )
        setMessages(prev => prev.map(m => 
          m.messageId === messageId 
            ? { ...m, reactions: messageRes.data.result.reactions || [] }
            : m
        ))
      } else {
        // Reaction removed, reload message
        const messageRes = await messageService.getMessageById(
          selectedConversation.conversationId, 
          messageId
        )
        setMessages(prev => prev.map(m => 
          m.messageId === messageId 
            ? { ...m, reactions: messageRes.data.result.reactions || [] }
            : m
        ))
      }
      
      setReactionPickerOpen(null)
    } catch (error) {
      console.error('Error adding reaction:', error)
      alert('Lỗi khi thêm biểu cảm: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  const handleCreateDirectConversation = async (userId) => {
    try {
      const response = await conversationService.createDirectConversation(userId)
      const newConversation = response.data.result
      setConversations(prev => [newConversation, ...prev])
      setSelectedConversation(newConversation)
      setShowNewConversationModal(false)
    } catch (error) {
      console.error('Error creating direct conversation:', error)
      alert('Lỗi khi tạo cuộc trò chuyện: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  const handleCreateGroupConversation = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert('Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên')
      return
    }

    try {
      const userIds = selectedUsers.map(u => u.userId)
      const response = await conversationService.createGroupConversation(groupName, userIds)
      const newConversation = response.data.result
      setConversations(prev => [newConversation, ...prev])
      setSelectedConversation(newConversation)
      setShowNewConversationModal(false)
      setGroupName('')
      setSelectedUsers([])
    } catch (error) {
      console.error('Error creating group conversation:', error)
      alert('Lỗi khi tạo nhóm: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  // Kiểm tra xem user hiện tại có phải là admin của conversation không
  const isCurrentUserAdmin = (conversation) => {
    if (!conversation || !currentUser) return false
    // Kiểm tra xem user có phải là người tạo nhóm không
    if (conversation.createdByUserId === currentUser.userId) return true
    // Kiểm tra role ADMIN trong participants
    const currentParticipant = conversation.participants?.find(p => p.userId === currentUser.userId)
    return currentParticipant?.role === 'ADMIN'
  }

  // Xóa thành viên khỏi nhóm
  const handleRemoveParticipant = async (participantUserId) => {
    if (!selectedConversation) return
    
    if (!window.confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?')) {
      return
    }

    try {
      await conversationService.removeParticipant(selectedConversation.conversationId, participantUserId)
      // Reload conversation để cập nhật danh sách participants
      const response = await conversationService.getConversationById(selectedConversation.conversationId)
      setSelectedConversation(response.data.result)
      refreshConversations()
    } catch (error) {
      console.error('Error removing participant:', error)
      alert('Lỗi khi xóa thành viên: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  // Thêm thành viên vào nhóm
  const handleAddParticipants = async () => {
    if (!selectedConversation || selectedUsersToAdd.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên để thêm')
      return
    }

    try {
      const userIds = selectedUsersToAdd.map(u => u.userId)
      const response = await conversationService.addParticipants(selectedConversation.conversationId, userIds)
      // Reload conversation để cập nhật danh sách participants
      setSelectedConversation(response.data.result)
      refreshConversations()
      setShowAddParticipantsModal(false)
      setSelectedUsersToAdd([])
      alert('Đã thêm thành viên vào nhóm thành công!')
    } catch (error) {
      console.error('Error adding participants:', error)
      alert('Lỗi khi thêm thành viên: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  // Cập nhật thông tin nhóm
  const handleUpdateGroupName = async () => {
    if (!selectedConversation || !editGroupName.trim()) {
      alert('Vui lòng nhập tên nhóm')
      return
    }

    try {
      const response = await conversationService.updateGroupName(selectedConversation.conversationId, editGroupName.trim())
      // Reload conversation để cập nhật tên nhóm
      setSelectedConversation(response.data.result)
      refreshConversations()
      setShowEditGroupModal(false)
      setEditGroupName('')
      alert('Đã cập nhật thông tin nhóm thành công!')
    } catch (error) {
      console.error('Error updating group name:', error)
      alert('Lỗi khi cập nhật thông tin nhóm: ' + (error.response?.data?.message || 'Lỗi không xác định'))
    }
  }

  const loadAvailableUsers = async () => {
    try {
      const response = await userService.getAllUsers(0, 100)
      setAvailableUsers(response.data.result?.content || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }


  useEffect(() => {
    if (showNewConversationModal) {
      if (newConversationType === 'direct' || newConversationType === 'group') {
        loadAvailableUsers()
      }
    }
  }, [showNewConversationModal, newConversationType])

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.name?.toLowerCase().includes(query) ||
      conv.participants?.some(p => 
        p.fullName?.toLowerCase().includes(query) ||
        p.userName?.toLowerCase().includes(query)
      )
    )
  })

  const getConversationName = (conversation) => {
    if (conversation.conversationType === 'DIRECT') {
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.userId)
      return otherParticipant?.fullName || otherParticipant?.userName || 'Unknown'
    }
    return conversation.name || conversation.departmentName || 'Conversation'
  }

  const getConversationAvatar = (conversation) => {
    if (conversation.conversationType === 'DIRECT') {
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.userId)
      return otherParticipant
    }
    return null
  }

  const formatMessageTime = (dateTime) => {
    if (!dateTime) return ''
    const date = new Date(dateTime)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Vừa xong'
    if (minutes < 60) return `${minutes} phút trước`
    if (diff < 86400000) return formatTime(dateTime)
    return formatDateTime(dateTime)
  }

  const getLastMessageTime = (conversation) => {
    if (!conversation.lastMessage) return ''
    return formatMessageTime(conversation.lastMessage.createdAt)
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center -mx-3 -my-4 sm:-mx-4 sm:-my-6">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white overflow-hidden -mx-3 -my-4 sm:-mx-4 sm:-my-6">
      {/* Conversations Sidebar - Messenger Style */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Tin nhắn</h2>
            <button
              onClick={() => setShowNewConversationModal(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Tạo cuộc trò chuyện mới"
            >
              <PlusIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm trên Messenger"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedConversation?.conversationId === conversation.conversationId
              const otherUser = getConversationAvatar(conversation)
              
              return (
                <button
                  key={conversation.conversationId}
                  onClick={async () => {
                    // Reset removed state khi chọn conversation mới
                    setRemovedFromConversation(false)
                    setSelectedConversation(conversation)
                    // Thử load conversation để kiểm tra xem user còn trong nhóm không
                    try {
                      await conversationService.getConversationById(conversation.conversationId)
                    } catch (error) {
                      // Nếu lỗi, có thể user đã bị xóa
                      if (error.response?.status === 400 || error.response?.status === 403) {
                        setRemovedFromConversation(true)
                        setConversations(prev => prev.filter(c => c.conversationId !== conversation.conversationId))
                      }
                    }
                  }}
                  className={`w-full p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      {otherUser ? (
                        <UserAvatar user={otherUser} size={12} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          {conversation.conversationType === 'GROUP' ? (
                            <UserGroupIcon className="w-6 h-6 text-white" />
                          ) : (
                            <BuildingOfficeIcon className="w-6 h-6 text-white" />
                          )}
                        </div>
                      )}
                      {conversation.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                          <span className="text-xs font-bold text-white">{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                          {getConversationName(conversation)}
                        </p>
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {getLastMessageTime(conversation)}
                          </span>
                        )}
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.lastMessage.senderId === currentUser?.userId ? 'Bạn: ' : ''}
                          {conversation.lastMessage.content || 'Đã gửi một tệp'}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area - Messenger Style */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-gray-200 bg-white shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getConversationAvatar(selectedConversation) ? (
                      <UserAvatar user={getConversationAvatar(selectedConversation)} size={10} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        {selectedConversation.conversationType === 'GROUP' ? (
                          <UserGroupIcon className="w-5 h-5 text-white" />
                        ) : (
                          <BuildingOfficeIcon className="w-5 h-5 text-white" />
                        )}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getConversationName(selectedConversation)}
                      </h3>
                      {selectedConversation.conversationType !== 'DIRECT' && (
                        <button
                          onClick={() => setShowParticipantsModal(true)}
                          className="text-xs text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {selectedConversation.participantCount} thành viên
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowMessageSearch(!showMessageSearch)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Tìm kiếm trong đoạn chat"
                    >
                      <MagnifyingGlassIcon className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setConversationMenuOpen(!conversationMenuOpen)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        title="Tùy chọn"
                      >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                      </button>
                      
                      {/* Dropdown menu */}
                      {conversationMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setConversationMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-12 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] py-1">
                            {selectedConversation?.conversationType === 'DIRECT' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowFileManagerModal(true)
                                  setConversationMenuOpen(false)
                                  loadAllAttachments()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                              >
                                <FolderIcon className="w-4 h-4" />
                                <span>Quản lý file</span>
                              </button>
                            )}
                            {selectedConversation?.conversationType === 'GROUP' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowFileManagerModal(true)
                                    setConversationMenuOpen(false)
                                    loadAllAttachments()
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                >
                                  <FolderIcon className="w-4 h-4" />
                                  <span>Quản lý file</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowAddParticipantsModal(true)
                                    setConversationMenuOpen(false)
                                    loadAvailableUsers()
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                >
                                  <UserGroupIcon className="w-4 h-4" />
                                  <span>Thêm thành viên</span>
                                </button>
                                {isCurrentUserAdmin(selectedConversation) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditGroupName(selectedConversation.name || '')
                                      setShowEditGroupModal(true)
                                      setConversationMenuOpen(false)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                    <span>Chỉnh sửa thông tin nhóm</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Message Search Bar */}
              {showMessageSearch && (
                <div className="px-4 pb-3 border-t border-gray-100">
                  <div className="relative flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm trong đoạn chat..."
                        value={messageSearchQuery}
                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      {messageSearchQuery && (
                        <button
                          onClick={() => {
                            setMessageSearchQuery('')
                            setShowMessageSearch(false)
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {messageSearchQuery && messageSearchResults.length > 0 && (
                      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg px-2 py-1.5 border border-gray-300">
                        <span className="text-xs text-gray-700 font-medium min-w-[40px] text-center">
                          {currentSearchIndex >= 0 ? currentSearchIndex + 1 : 0}/{messageSearchResults.length}
                        </span>
                        <div className="h-4 w-px bg-gray-300 mx-1"></div>
                        <button
                          onClick={() => navigateSearchResult('prev')}
                          className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Kết quả trước (↑)"
                          disabled={messageSearchResults.length === 0}
                        >
                          <ChevronUpIcon className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={() => navigateSearchResult('next')}
                          className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Kết quả tiếp theo (↓)"
                          disabled={messageSearchResults.length === 0}
                        >
                          <ChevronDownIcon className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    )}
                    {messageSearchQuery && messageSearchResults.length === 0 && (
                      <div className="text-xs text-gray-500 px-2 py-1">
                        Không tìm thấy
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Message - Fixed position below header */}
            {pinnedMessage && !removedFromConversation && (
              <div className="border-b border-gray-200 bg-white">
                {/* Compact pinned message */}
                <div className="px-3 py-1.5">
                  <div 
                    className="flex items-center space-x-2 px-2 py-1.5 bg-blue-50 border-l-2 border-blue-500 rounded cursor-pointer hover:bg-blue-100 transition-colors group"
                    onClick={() => scrollToMessage(pinnedMessage.messageId)}
                  >
                    <MapPinIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 truncate">
                        <span className="font-medium text-blue-700">{pinnedMessage.senderFullName || pinnedMessage.senderUserName}:</span> {pinnedMessage.content || (pinnedMessage.attachments && pinnedMessage.attachments.length > 0 ? `Đã gửi ${pinnedMessage.attachments.length} file` : 'Tin nhắn')}
                      </div>
                    </div>
                    {allPinnedMessages.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowPinnedMessagesList(!showPinnedMessagesList)
                        }}
                        className="text-blue-500 hover:text-blue-700 p-1 transition-colors flex items-center space-x-1 bg-blue-100 rounded px-2 py-0.5"
                        title={showPinnedMessagesList ? "Thu gọn" : `Mở rộng (${allPinnedMessages.length} tin nhắn đã ghim)`}
                      >
                        <span className="text-xs font-semibold">{allPinnedMessages.length}</span>
                        {showPinnedMessagesList ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnpinMessage(pinnedMessage.messageId)
                      }}
                      className="text-blue-500 hover:text-blue-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Bỏ ghim"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Expanded pinned messages list */}
                {showPinnedMessagesList && allPinnedMessages.length > 0 && (
                  <div className="px-3 pb-2 max-h-64 overflow-y-auto border-t border-blue-100 bg-blue-50/50">
                    <div className="pt-2 space-y-1">
                      {allPinnedMessages.map((msg, index) => (
                        <div
                          key={msg.messageId}
                          className={`group px-2 py-1.5 rounded cursor-pointer hover:bg-blue-100 transition-colors ${
                            msg.messageId === pinnedMessage.messageId ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => {
                            setPinnedMessage(msg)
                            scrollToMessage(msg.messageId)
                          }}
                        >
                          <div className="flex items-start space-x-2">
                            <MapPinIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-700 truncate">
                                <span className="font-medium text-blue-700">{msg.senderFullName || msg.senderUserName}:</span> {msg.content || (msg.attachments && msg.attachments.length > 0 ? `Đã gửi ${msg.attachments.length} file` : 'Tin nhắn')}
                              </div>
                              {msg.pinnedByFullName && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Đã ghim bởi {msg.pinnedByFullName}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnpinMessage(msg.messageId)
                              }}
                              className="text-blue-500 hover:text-blue-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Bỏ ghim"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-1 messages-container"
              onScroll={handleMessagesScroll}
            >
              {removedFromConversation ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <XMarkIcon className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-red-700 mb-2">Bạn không còn ở trong nhóm</h3>
                    <p className="text-sm text-red-600 mb-4">
                      Bạn đã bị xóa khỏi nhóm này. Bạn không thể xem hoặc gửi tin nhắn trong nhóm này nữa.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedConversation(null)
                        setRemovedFromConversation(false)
                        refreshConversations()
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : messagesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                <>
                  {loadingOlderMessages && (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4 text-gray-300" />
                      <p className="text-sm">Chưa có tin nhắn nào</p>
                    </div>
                  ) : (
                messages
                  .filter((message, index, self) => 
                    // Remove duplicates by messageId
                    index === self.findIndex(m => m.messageId === message.messageId)
                  )
                  .map((message, index, filteredMessages) => {
                    const isMyMessage = message.senderId === currentUser?.userId
                    const showAvatar = index === 0 || filteredMessages[index - 1]?.senderId !== message.senderId
                    const showTime = index === filteredMessages.length - 1 || 
                      new Date(message.createdAt).getTime() - new Date(filteredMessages[index + 1]?.createdAt || 0).getTime() > 300000
                    const isSearchMatch = messageSearchResults.includes(message.messageId)
                    const isCurrentSearchResult = messageSearchResults[currentSearchIndex] === message.messageId
                    
                    return (
                      <div 
                        key={`message-${message.messageId}-${message.createdAt}`} 
                        ref={(el) => {
                          if (el) {
                            messageSearchRefs.current[message.messageId] = el
                          }
                        }}
                        className={`flex items-start ${isMyMessage ? 'justify-end' : 'justify-start'} ${showTime ? 'mb-4' : 'mb-1'} group transition-all ${
                          isCurrentSearchResult ? 'bg-yellow-100 rounded-lg p-2 -mx-2' : ''
                        }`}
                      >
                      {isMyMessage && (
                        <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="relative">
                            <button
                              onClick={() => {
                                if (messageMenuOpen === message.messageId) {
                                  setMessageMenuOpen(null)
                                } else {
                                  setMessageMenuOpen(message.messageId)
                                }
                              }}
                              className="p-1.5 rounded-full transition-colors text-blue-500 hover:bg-blue-50"
                              title="Tùy chọn"
                            >
                              <EllipsisVerticalIcon className="w-5 h-5" />
                            </button>
                            
                            {/* Dropdown menu */}
                            {messageMenuOpen === message.messageId && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setMessageMenuOpen(null)}
                                />
                                <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] py-1">
                                  {message.pinned ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleUnpinMessage(message.messageId)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                    >
                                      <MapPinIcon className="w-4 h-4" />
                                      <span>Bỏ ghim</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePinMessage(message.messageId)
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                    >
                                      <MapPinIcon className="w-4 h-4" />
                                      <span>Ghim tin nhắn</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowDeleteConfirm({ messageId: message.messageId, isMyMessage })
                                      setMessageMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <div className={`flex items-end space-x-2 max-w-[70%] ${isMyMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {!isMyMessage && (
                          <div className="w-8 flex-shrink-0">
                            {showAvatar && (
                              <UserAvatar 
                                user={message.senderId === currentUser?.userId ? currentUser : { userId: message.senderId, fullName: message.senderFullName, userName: message.senderUserName, avatarUrl: message.senderAvatarUrl }} 
                                size={8} 
                                className="flex-shrink-0"
                              />
                            )}
                          </div>
                        )}
                        <div className={`flex flex-col relative ${isMyMessage ? 'items-end' : 'items-start'}`}>
                          {!isMyMessage && showAvatar && (
                            <span className="text-xs text-gray-500 mb-1 px-2">
                              {message.senderFullName || message.senderUserName}
                            </span>
                          )}
                          {message.replyToMessage && (
                            <div className={`mb-1 px-3 py-2 rounded-lg text-sm border-l-4 ${
                              isMyMessage 
                                ? 'bg-blue-100 border-blue-400 text-gray-700' 
                                : 'bg-gray-100 border-gray-400 text-gray-700'
                            }`}>
                              <p className="font-medium text-xs mb-1">
                                {message.replyToMessage.senderFullName || message.replyToMessage.senderUserName}
                              </p>
                              <p className="text-xs truncate">{message.replyToMessage.content}</p>
                            </div>
                          )}
                          {/* File đính kèm - hiển thị ngoài box màu xanh */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {message.attachments.map((att) => (
                                <div key={att.attachmentId}>
                                  <MessageAttachment
                                    attachment={att}
                                    messageId={message.messageId}
                                    conversationId={selectedConversation?.conversationId}
                                    isMyMessage={isMyMessage}
                                    attachmentBlobUrls={attachmentBlobUrls}
                                    setAttachmentBlobUrls={setAttachmentBlobUrls}
                                    loadingAttachments={loadingAttachments}
                                    setLoadingAttachments={setLoadingAttachments}
                                    failedAttachments={failedAttachments}
                                    setFailedAttachments={setFailedAttachments}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Box màu xanh chỉ cho nội dung text, không hiển thị nếu chỉ có emoji */}
                          {message.content && (
                            isOnlyEmojis(message.content) ? (
                              // Chỉ có emoji - hiển thị lớn hơn 3 lần, không có box
                              <div className="text-4xl leading-relaxed">
                                {message.content}
                              </div>
                            ) : (
                              // Có text - hiển thị trong box màu xanh
                              <div
                                className={`rounded-2xl px-4 py-2 ${
                                  isMyMessage
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-900 shadow-sm'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm">
                                  {messageSearchQuery ? highlightSearchText(message.content, messageSearchQuery) : message.content}
                                </p>
                              </div>
                            )
                          )}
                          {showTime && (
                            <div className={`flex items-center space-x-1 mt-1 ${isMyMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              <span className="text-xs text-gray-500">
                                {formatMessageTime(message.createdAt)}
                              </span>
                              {isMyMessage && (
                                <span className="text-blue-500">
                                  {message.isRead ? (
                                    <CheckCircleIcon className="w-4 h-4" />
                                  ) : (
                                    <CheckIcon className="w-4 h-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Reactions */}
                          {message.reactions && message.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(
                                message.reactions.reduce((acc, reaction) => {
                                  if (!acc[reaction.emoji]) {
                                    acc[reaction.emoji] = []
                                  }
                                  acc[reaction.emoji].push(reaction)
                                  return acc
                                }, {})
                              ).map(([emoji, reactions]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message.messageId, emoji)}
                                  className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 transition-colors ${
                                    reactions.some(r => r.userId === currentUser?.userId)
                                      ? 'bg-blue-100 border border-blue-300'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                  title={reactions.map(r => r.userFullName || r.userUserName).join(', ')}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-gray-600">{reactions.length}</span>
                                </button>
                              ))}
                              <button
                                onClick={() => setReactionPickerOpen(
                                  reactionPickerOpen === message.messageId ? null : message.messageId
                                )}
                                className="px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Thêm biểu cảm"
                              >
                                <FaceSmileIcon className="w-4 h-4 inline" />
                              </button>
                            </div>
                          )}
                          {/* Add reaction button if no reactions */}
                          {(!message.reactions || message.reactions.length === 0) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReactionPickerOpen(
                                  reactionPickerOpen === message.messageId ? null : message.messageId
                                )
                              }}
                              className="mt-1 px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                              title="Thêm biểu cảm"
                            >
                              <FaceSmileIcon className="w-4 h-4 inline" />
                            </button>
                          )}
                          {/* Emoji Picker */}
                          {reactionPickerOpen === message.messageId && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setReactionPickerOpen(null)}
                              />
                              <div className={`absolute ${isMyMessage ? 'right-0' : 'left-0'} bottom-full mb-2 z-[60] bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[200px]`}>
                                <div className="flex flex-wrap gap-1">
                                  {commonEmojis.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleAddReaction(message.messageId, emoji)
                                      }}
                                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {!isMyMessage && (
                        <div className="flex items-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="relative">
                            <button
                              onClick={() => {
                                if (messageMenuOpen === message.messageId) {
                                  setMessageMenuOpen(null)
                                } else {
                                  setMessageMenuOpen(message.messageId)
                                }
                              }}
                              className="p-1.5 rounded-full transition-colors text-gray-500 hover:bg-gray-100"
                              title="Tùy chọn"
                            >
                              <EllipsisVerticalIcon className="w-5 h-5" />
                            </button>
                            
                            {/* Dropdown menu */}
                            {messageMenuOpen === message.messageId && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setMessageMenuOpen(null)}
                                />
                                <div className="absolute left-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowDeleteConfirm({ messageId: message.messageId, isMyMessage })
                                      setMessageMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyToMessage && (
              <div className="px-4 py-2 bg-white border-t border-gray-200">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Đang trả lời:</p>
                    <p className="text-sm text-gray-700 truncate">{replyToMessage.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyToMessage(null)}
                    className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Message Input - Messenger Style */}
            <div className="px-4 py-3 bg-white border-t border-gray-200 shadow-sm">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-3 py-2 text-sm shadow-sm transition-all hover:shadow-md"
                    >
                      <PaperClipIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700 truncate max-w-[200px] font-medium">{file.name}</span>
                      <button
                        onClick={() => handleFileRemove(index)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full p-0.5 transition-all flex-shrink-0"
                        title="Xóa file"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end space-x-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all flex-shrink-0 active:scale-95"
                  title="Đính kèm file"
                >
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 flex items-end relative transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-md">
                  <textarea
                    ref={textareaRef}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Nhập tin nhắn..."
                    rows={1}
                    className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 max-h-[120px] overflow-y-auto leading-6"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEmojiPickerOpen(!emojiPickerOpen)
                    }}
                    className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                      emojiPickerOpen 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title="Emoji"
                  >
                    <FaceSmileIcon className="w-5 h-5" />
                  </button>
                  {/* Emoji Picker for message input */}
                  {emojiPickerOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setEmojiPickerOpen(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 z-[60] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[320px] max-h-[400px] overflow-y-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {commonEmojis.map((emoji, index) => (
                            <button
                              key={`${emoji}-${index}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setMessageContent(prev => prev + emoji)
                                // Không đóng picker để có thể chọn nhiều emoji cùng lúc
                              }}
                              className="w-9 h-9 flex items-center justify-center text-lg hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={sending || (!messageContent.trim() && selectedFiles.length === 0)}
                  className={`p-2.5 rounded-full transition-all flex-shrink-0 shadow-md active:scale-95 ${
                    sending || (!messageContent.trim() && selectedFiles.length === 0)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-lg'
                  }`}
                  title="Gửi tin nhắn"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-20 h-20 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">Chọn một cuộc trò chuyện để bắt đầu</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Message Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Xóa tin nhắn</h3>
              <div className="space-y-3">
                {showDeleteConfirm.isMyMessage ? (
                  <>
                    <button
                      onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_ME')}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                    >
                      <div className="font-medium">Xóa ở phía bạn</div>
                      <div className="text-sm text-gray-500">Chỉ bạn không thấy tin nhắn này</div>
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_EVERYONE')}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-left"
                    >
                      <div className="font-medium">Xóa hết</div>
                      <div className="text-sm text-red-600">Xóa tin nhắn khỏi hệ thống, mọi người không thấy</div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_ME')}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                  >
                    <div className="font-medium">Xóa ở phía bạn</div>
                    <div className="text-sm text-gray-500">Chỉ bạn không thấy tin nhắn này</div>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDeleteConfirm(null)
                    setMessageMenuOpen(null)
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors mt-2"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Xóa tin nhắn</h3>
              <div className="space-y-3">
                {showDeleteConfirm.isMyMessage ? (
                  <>
                    <button
                      onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_ME')}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                    >
                      <div className="font-medium">Xóa ở phía bạn</div>
                      <div className="text-sm text-gray-500">Chỉ bạn không thấy tin nhắn này</div>
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_EVERYONE')}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-left"
                    >
                      <div className="font-medium">Xóa hết</div>
                      <div className="text-sm text-red-600">Xóa tin nhắn khỏi hệ thống, mọi người không thấy</div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDeleteMessage(showDeleteConfirm.messageId, 'DELETE_FOR_ME')}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                  >
                    <div className="font-medium">Xóa ở phía bạn</div>
                    <div className="text-sm text-gray-500">Chỉ bạn không thấy tin nhắn này</div>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDeleteConfirm(null)
                    setMessageMenuOpen(null)
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors mt-2"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Manager Modal */}
      {showFileManagerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Quản lý file</h3>
                <button
                  onClick={() => {
                    setShowFileManagerModal(false)
                    setFileManagerTab('images')
                    setAllAttachments([])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex space-x-1">
                <button
                  onClick={() => setFileManagerTab('images')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    fileManagerTab === 'images'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <PhotoIcon className="w-4 h-4" />
                    <span>Ảnh</span>
                  </div>
                </button>
                <button
                  onClick={() => setFileManagerTab('videos')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    fileManagerTab === 'videos'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <VideoCameraIcon className="w-4 h-4" />
                    <span>Video</span>
                  </div>
                </button>
                <button
                  onClick={() => setFileManagerTab('links')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    fileManagerTab === 'links'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4" />
                    <span>Link</span>
                  </div>
                </button>
                <button
                  onClick={() => setFileManagerTab('files')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    fileManagerTab === 'files'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <DocumentIcon className="w-4 h-4" />
                    <span>File khác</span>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingAllAttachments ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                (() => {
                  // Phân loại attachments theo tab
                  let filteredAttachments = []
                  
                  if (fileManagerTab === 'images') {
                    filteredAttachments = allAttachments.filter(att => 
                      att.fileType?.startsWith('image/')
                    )
                  } else if (fileManagerTab === 'videos') {
                    filteredAttachments = allAttachments.filter(att => 
                      att.fileType?.startsWith('video/')
                    )
                  } else if (fileManagerTab === 'links') {
                    // Links có thể từ message content hoặc attachments có URL
                    filteredAttachments = allAttachments.filter(att => {
                      // Kiểm tra xem có phải là link không (có thể từ file name hoặc content)
                      const urlRegex = /(https?:\/\/[^\s]+)/gi
                      return urlRegex.test(att.messageContent || '') || 
                             urlRegex.test(att.fileName || '')
                    })
                  } else if (fileManagerTab === 'files') {
                    filteredAttachments = allAttachments.filter(att => 
                      !att.fileType?.startsWith('image/') && 
                      !att.fileType?.startsWith('video/')
                    )
                  }
                  
                  if (filteredAttachments.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <FolderIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm">Chưa có {fileManagerTab === 'images' ? 'ảnh' : fileManagerTab === 'videos' ? 'video' : fileManagerTab === 'links' ? 'link' : 'file'} nào</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {filteredAttachments.map((att) => {
                        const attachmentKey = `${att.messageId}-${att.attachmentId}`
                        const blobUrl = attachmentBlobUrls[attachmentKey]
                        const isImage = att.fileType?.startsWith('image/')
                        const isVideo = att.fileType?.startsWith('video/')
                        
                        return (
                          <div
                            key={att.attachmentId}
                            className="relative group cursor-pointer"
                            onClick={(e) => {
                              // Hiển thị menu context
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setFileContextMenu({
                                attachment: att,
                                x: rect.right,
                                y: rect.top
                              })
                            }}
                          >
                            {isImage ? (
                              blobUrl ? (
                                <img
                                  src={blobUrl}
                                  alt={att.fileName}
                                  className="w-full h-32 object-cover rounded-lg"
                                  onError={(e) => {
                                    // Nếu blob URL bị lỗi, xóa nó để reload
                                    console.warn('Blob URL error in file manager:', attachmentKey)
                                    setAttachmentBlobUrls(prev => {
                                      const newState = { ...prev }
                                      delete newState[attachmentKey]
                                      return newState
                                    })
                                  }}
                                />
                              ) : (
                                <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <PhotoIcon className="w-8 h-8 text-gray-400" />
                                </div>
                              )
                            ) : isVideo ? (
                              blobUrl ? (
                                <video
                                  src={blobUrl}
                                  className="w-full h-32 object-cover rounded-lg"
                                  onError={(e) => {
                                    // Nếu blob URL bị lỗi, xóa nó để reload
                                    console.warn('Blob URL error in file manager:', attachmentKey)
                                    setAttachmentBlobUrls(prev => {
                                      const newState = { ...prev }
                                      delete newState[attachmentKey]
                                      return newState
                                    })
                                  }}
                                />
                              ) : (
                                <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <VideoCameraIcon className="w-8 h-8 text-gray-400" />
                                </div>
                              )
                            ) : (
                              <div className="w-full h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center p-2">
                                <DocumentIcon className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-xs text-gray-600 text-center truncate w-full">
                                  {att.fileName}
                                </p>
                              </div>
                            )}
                            
                            {/* Overlay with info */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="text-white text-xs text-center px-2">
                                <p className="font-medium truncate">{att.fileName}</p>
                                <p className="text-gray-300 mt-1">{att.senderName}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Context Menu */}
      {fileContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setFileContextMenu(null)}
          />
          <div 
            className="fixed z-[60] bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] py-1"
            style={{
              left: `${Math.min(fileContextMenu.x, window.innerWidth - 220)}px`,
              top: `${Math.min(fileContextMenu.y, window.innerHeight - 100)}px`,
              transform: fileContextMenu.x > window.innerWidth - 220 ? 'translateX(-100%)' : 'none'
            }}
          >
            <button
              onClick={async (e) => {
                e.stopPropagation()
                await downloadAttachment(fileContextMenu.attachment)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Tải xuống</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (fileContextMenu.attachment.messageId) {
                  setShowFileManagerModal(false)
                  setFileContextMenu(null)
                  // Đợi modal đóng trước khi scroll
                  await new Promise(resolve => setTimeout(resolve, 100))
                  await scrollToMessage(fileContextMenu.attachment.messageId)
                }
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span>Xem tin nhắn gốc</span>
            </button>
          </div>
        </>
      )}

      {/* New Conversation Modal - Giữ nguyên như cũ */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tạo cuộc trò chuyện mới</h3>
                <button
                  onClick={() => {
                    setShowNewConversationModal(false)
                    setNewConversationType('direct')
                    setSelectedUsers([])
                    setGroupName('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 flex space-x-2">
                <button
                  onClick={() => setNewConversationType('direct')}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    newConversationType === 'direct'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm">Nhắn tin 1-1</span>
                </button>
                <button
                  onClick={() => setNewConversationType('group')}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    newConversationType === 'group'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <UserGroupIcon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm">Nhóm</span>
                </button>
              </div>

              {newConversationType === 'direct' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Chọn người để nhắn tin:</p>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                    {availableUsers
                      .filter(u => u.userId !== currentUser?.userId)
                      .map((user) => (
                        <button
                          key={user.userId}
                          onClick={() => handleCreateDirectConversation(user.userId)}
                          className="w-full p-3 hover:bg-gray-50 text-left flex items-center space-x-3 border-b border-gray-100 last:border-b-0"
                        >
                          <UserAvatar user={user} size={10} />
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName || user.userName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {newConversationType === 'group' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên nhóm
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Nhập tên nhóm..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Chọn thành viên:</p>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                      {availableUsers
                        .filter(u => u.userId !== currentUser?.userId)
                        .map((user) => {
                          const isSelected = selectedUsers.some(u => u.userId === user.userId)
                          return (
                            <button
                              key={user.userId}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedUsers(prev => prev.filter(u => u.userId !== user.userId))
                                } else {
                                  setSelectedUsers(prev => [...prev, user])
                                }
                              }}
                              className={`w-full p-3 hover:bg-gray-50 text-left flex items-center space-x-3 border-b border-gray-100 last:border-b-0 ${
                                isSelected ? 'bg-blue-50' : ''
                              }`}
                            >
                              <UserAvatar user={user} size={10} />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{user.fullName || user.userName}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateGroupConversation}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Tạo nhóm
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipantsModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Thành viên trong nhóm</h3>
                <button
                  onClick={() => setShowParticipantsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                {selectedConversation.participants?.map((participant) => {
                  const isAdmin = participant.role === 'ADMIN' || selectedConversation.createdByUserId === participant.userId
                  const canRemove = isCurrentUserAdmin(selectedConversation) && 
                                    participant.userId !== currentUser?.userId &&
                                    selectedConversation.conversationType === 'GROUP'
                  
                  return (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <UserAvatar user={participant} size={10} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {participant.fullName || participant.userName}
                            {isAdmin && (
                              <span className="ml-2 text-xs text-blue-600 font-semibold">(Admin)</span>
                            )}
                          </p>
                          {participant.userName && participant.userName !== participant.fullName && (
                            <p className="text-sm text-gray-500 truncate">@{participant.userName}</p>
                          )}
                        </div>
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveParticipant(participant.userId)}
                          className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa thành viên"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Participants Modal */}
      {showAddParticipantsModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Thêm thành viên vào nhóm</h3>
                <button
                  onClick={() => {
                    setShowAddParticipantsModal(false)
                    setSelectedUsersToAdd([])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Chọn thành viên để thêm:</p>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                  {availableUsers
                    .filter(u => {
                      // Loại bỏ current user và những người đã có trong nhóm
                      if (u.userId === currentUser?.userId) return false
                      const existingParticipant = selectedConversation.participants?.find(
                        p => p.userId === u.userId
                      )
                      return !existingParticipant
                    })
                    .map((user) => {
                      const isSelected = selectedUsersToAdd.some(u => u.userId === user.userId)
                      return (
                        <button
                          key={user.userId}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUsersToAdd(prev => prev.filter(u => u.userId !== user.userId))
                            } else {
                              setSelectedUsersToAdd(prev => [...prev, user])
                            }
                          }}
                          className={`w-full p-3 hover:bg-gray-50 text-left flex items-center space-x-3 border-b border-gray-100 last:border-b-0 ${
                            isSelected ? 'bg-blue-50' : ''
                          }`}
                        >
                          <UserAvatar user={user} size={10} />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{user.fullName || user.userName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                </div>
                {availableUsers.filter(u => {
                  if (u.userId === currentUser?.userId) return false
                  const existingParticipant = selectedConversation.participants?.find(
                    p => p.userId === u.userId
                  )
                  return !existingParticipant
                }).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Không còn người dùng nào để thêm vào nhóm
                  </p>
                )}
              </div>

              {selectedUsersToAdd.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Đã chọn: {selectedUsersToAdd.length} thành viên
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsersToAdd.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                      >
                        <span>{user.fullName || user.userName}</span>
                        <button
                          onClick={() => {
                            setSelectedUsersToAdd(prev => prev.filter(u => u.userId !== user.userId))
                          }}
                          className="text-blue-700 hover:text-blue-900"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowAddParticipantsModal(false)
                    setSelectedUsersToAdd([])
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddParticipants}
                  disabled={selectedUsersToAdd.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Thêm ({selectedUsersToAdd.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Chỉnh sửa thông tin nhóm</h3>
                <button
                  onClick={() => {
                    setShowEditGroupModal(false)
                    setEditGroupName('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên nhóm
                </label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateGroupName()
                    } else if (e.key === 'Escape') {
                      setShowEditGroupModal(false)
                      setEditGroupName('')
                    }
                  }}
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowEditGroupModal(false)
                    setEditGroupName('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateGroupName}
                  disabled={!editGroupName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessagingPage


