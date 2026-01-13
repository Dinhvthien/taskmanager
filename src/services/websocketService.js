import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

class WebSocketService {
  constructor() {
    this.client = null
    this.subscriptions = new Map() // Map<subscriptionKey, subscription>
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  /**
   * Kết nối WebSocket
   */
  connect() {
    if (this.client && this.client.connected) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          reject(new Error('No authentication token found'))
          return
        }

        // Kết nối trực tiếp đến backend (backend đã có CORS config)
        // Backend có context-path là /api, nên endpoint WebSocket là /api/ws
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
        // Đảm bảo có /api trong URL
        const baseUrl = apiBaseUrl.endsWith('/api') ? apiBaseUrl : `${apiBaseUrl}/api`
        const socketUrl = `${baseUrl}/ws`

        // Tạo client với cấu hình đầy đủ
        this.client = new Client({
          brokerURL: socketUrl,
          webSocketFactory: () => new SockJS(socketUrl),
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          debug: (str) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('STOMP:', str)
            }
          },
          onConnect: (frame) => {
            this.isConnected = true
            this.reconnectAttempts = 0
            if (process.env.NODE_ENV === 'development') {
              console.log('WebSocket connected:', frame)
            }
            resolve()
          },
          onStompError: (frame) => {
            console.error('STOMP error:', frame)
            this.isConnected = false
            reject(frame)
          },
          onWebSocketClose: () => {
            this.isConnected = false
            if (process.env.NODE_ENV === 'development') {
              console.log('WebSocket closed')
            }
          },
          onDisconnect: () => {
            this.isConnected = false
            if (process.env.NODE_ENV === 'development') {
              console.log('WebSocket disconnected')
            }
          },
        })

        this.client.activate()
      } catch (error) {
        console.error('Error connecting WebSocket:', error)
        reject(error)
      }
    })
  }

  /**
   * Ngắt kết nối WebSocket
   */
  disconnect() {
    if (this.client) {
      // Unsubscribe tất cả subscriptions
      this.subscriptions.forEach((subscription) => {
        try {
          subscription.unsubscribe()
        } catch (err) {
          console.error('Error unsubscribing:', err)
        }
      })
      this.subscriptions.clear()

      // Deactivate client
      this.client.deactivate()
      this.client = null
      this.isConnected = false
    }
  }

  /**
   * Subscribe vào một topic
   * @param {string} topic - Topic path (ví dụ: '/topic/task/123/comments')
   * @param {Function} callback - Callback function khi nhận được message
   * @returns {Promise<string>} subscriptionKey - Key để unsubscribe sau này
   */
  async subscribe(topic, callback) {
    // Đảm bảo client đã kết nối và ready
    if (!this.client || !this.isConnected || !this.client.connected) {
      // Tự động kết nối nếu chưa kết nối
      await this.connect()
    }

    // Đợi cho đến khi connection thực sự ready (với retry)
    let retries = 0
    const maxRetries = 20 // 20 * 100ms = 2 seconds max wait
    while (!this.client.connected && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100))
      retries++
    }

    if (!this.client.connected) {
      throw new Error('WebSocket connection not ready after retries')
    }

    return this._doSubscribe(topic, callback)
  }

  _doSubscribe(topic, callback) {
    try {
      // Kiểm tra lại connection trước khi subscribe
      if (!this.client || !this.client.connected) {
        throw new Error('WebSocket not connected')
      }

      // Unsubscribe subscription cũ nếu đã có (tránh duplicate subscriptions)
      if (this.subscriptions.has(topic)) {
        const oldSubscription = this.subscriptions.get(topic)
        try {
          oldSubscription.unsubscribe()
          if (process.env.NODE_ENV === 'development') {
            console.log(`Unsubscribed old subscription for topic: ${topic}`)
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Error unsubscribing old subscription:`, err)
          }
        }
        this.subscriptions.delete(topic)
      }

      const subscription = this.client.subscribe(topic, (message) => {
        try {
          const data = JSON.parse(message.body)
          callback(data)
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
          callback(message.body) // Fallback: trả về raw body
        }
      })

      this.subscriptions.set(topic, subscription)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscribed to topic: ${topic}`)
      }
      return topic
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error)
      throw error
    }
  }

  /**
   * Unsubscribe khỏi một topic
   * @param {string} subscriptionKey - Key trả về từ subscribe()
   */
  unsubscribe(subscriptionKey) {
    const subscription = this.subscriptions.get(subscriptionKey)
    if (subscription) {
      try {
        subscription.unsubscribe()
        this.subscriptions.delete(subscriptionKey)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Unsubscribed from topic: ${subscriptionKey}`)
        }
      } catch (error) {
        console.error(`Error unsubscribing from topic ${subscriptionKey}:`, error)
      }
    }
  }

  /**
   * Gửi message đến server
   * @param {string} destination - Destination path (ví dụ: '/app/task/comment')
   * @param {Object} body - Message body
   */
  send(destination, body) {
    if (!this.client || !this.isConnected) {
      console.error('WebSocket not connected. Cannot send message.')
      return
    }

    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      })
    } catch (error) {
      console.error(`Error sending message to ${destination}:`, error)
    }
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isConnectedToServer() {
    return this.isConnected && this.client && this.client.connected
  }
}

// Export singleton instance
const websocketService = new WebSocketService()

export default websocketService

