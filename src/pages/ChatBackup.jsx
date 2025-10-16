import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usersAPI, groupsAPI, messagesAPI } from '../services/api'
import socketService from '../services/socket'
import { toast } from 'react-hot-toast'
import { 
  Send, 
  Users, 
  MessageSquare, 
  Search,
  MoreVertical,
  UserPlus,
  Settings
} from 'lucide-react'

const Chat = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('personal')
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchInitialData()
    setupSocketListeners()
    
    return () => {
      socketService.removeAllListeners()
    }
  }, [])

  useEffect(() => {
    if (selectedChat) {
      fetchMessages()
    }
  }, [selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [usersRes, groupsRes] = await Promise.all([
        usersAPI.getActiveUsers(),
        groupsAPI.getMyGroups()
      ])
      
      setUsers(usersRes.data.filter(u => u.id !== user.id))
      setGroups(groupsRes.data)
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load chat data')
    } finally {
      setLoading(false)
    }
  }

  const setupSocketListeners = () => {
    socketService.connect()
    socketService.joinUserRoom(user.id)
    
    socketService.onReceiveMessage((data) => {
      setMessages(prev => [...prev, data])
    })
    
    socketService.onReceiveGroupMessage((data) => {
      if (selectedChat && selectedChat.type === 'group' && selectedChat.id === data.groupId) {
        setMessages(prev => [...prev, data])
      }
    })
    
    socketService.onError((error) => {
      toast.error(error.message)
    })
  }

  const fetchMessages = async () => {
    try {
      let response
      if (selectedChat.type === 'personal') {
        if (!selectedChat.id) {
          console.error('User ID is undefined for personal chat')
          return
        }
        response = await messagesAPI.getPersonalMessages(selectedChat.id)
      } else {
        if (!selectedChat.id) {
          console.error('Group ID is undefined for group chat')
          return
        }
        response = await messagesAPI.getGroupMessages(selectedChat.id)
      }
      setMessages(response.data)
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat) return

    try {
      const messageData = {
        sender: user.id,
        message: newMessage.trim()
      }

      if (selectedChat.type === 'personal') {
        messageData.receiver = selectedChat.id
        socketService.sendPersonalMessage(messageData)
        await messagesAPI.sendPersonalMessage(messageData)
      } else {
        messageData.group = selectedChat.id
        socketService.sendGroupMessage(messageData)
        await messagesAPI.sendGroupMessage(messageData)
      }

      setNewMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-gray-900">Chat</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('personal')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'personal'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'groups'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Groups
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card h-full">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'personal' ? (
                  <div className="p-2">
                    {filteredUsers.map((chatUser) => (
                      <div
                        key={chatUser.id}
                        onClick={() => {
                          console.log('Selecting user:', chatUser)
                          setSelectedChat({ type: 'personal', id: chatUser.id, name: chatUser.name })
                        }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChat?.id === chatUser.id
                            ? 'bg-primary-50 border-primary-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-medium">
                              {chatUser.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {chatUser.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {chatUser.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2">
                    {filteredGroups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => setSelectedChat({ type: 'group', id: group.id, name: group.name })}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChat?.id === group.id
                            ? 'bg-primary-50 border-primary-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {group.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {group.members?.length || 0} members
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            {selectedChat ? (
              <div className="card h-full flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        {selectedChat.type === 'personal' ? (
                          <span className="text-primary-600 font-medium">
                            {selectedChat.name.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <Users className="w-5 h-5 text-primary-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{selectedChat.name}</h3>
                        <p className="text-sm text-gray-500">
                          {selectedChat.type === 'personal' ? 'Personal chat' : 'Group chat'}
                        </p>
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.sender?.id === user.id || message.sender === user.id
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender?.id === user.id || message.sender === user.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <p className="text-xs mt-1 opacity-75">
                          {new Date(message.createdAt || message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="card h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a chat to start messaging
                  </h3>
                  <p className="text-gray-500">
                    Choose a user or group from the sidebar to begin your conversation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat


























