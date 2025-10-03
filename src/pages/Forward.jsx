import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersAPI, groupsAPI, messagesAPI, API_ORIGIN } from '../services/api'

export default function Forward() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [messageToForward, setMessageToForward] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'groups'
  const [search, setSearch] = useState('')
  const resolveUrl = (url) => {
    if (!url) return url
    return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`
  }
  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return ''
    const mb = (bytes / 1024 / 1024)
    return `${mb.toFixed(mb < 0.1 ? 2 : 1)} MB`
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('forwardMessage')
      if (raw) setMessageToForward(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [u, g] = await Promise.all([
          usersAPI.getActiveUsers(),
          groupsAPI.getGroups(),
        ])
        setUsers(u.data || [])
        setGroups((g.data || []).filter(x => x.isActive !== false))
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const toggleUser = (id) => {
    setSelectedUsers(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }
  const toggleGroup = (id) => {
    setSelectedGroups(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  const submitForward = async () => {
    if (!messageToForward?.id && !messageToForward?._id) return
    if (selectedUsers.size === 0 && selectedGroups.size === 0) return
    try {
      setSubmitting(true)
      await messagesAPI.forwardMessage({
        messageId: messageToForward.id || messageToForward._id,
        targets: { users: Array.from(selectedUsers), groups: Array.from(selectedGroups) }
      })
      sessionStorage.removeItem('forwardMessage')
      navigate(-1)
    } catch {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  // Filters
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCount = selectedUsers.size + selectedGroups.size

  return (
    <div className="h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-100 text-white">
        {/* Search */}
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search name or group"
            className="w-full bg-white text-gray-800 rounded-full px-4 py-2 text-sm focus:outline-none"
            type="text"
          />
        </div>
        {/* Title + Tabs + selection count in one row */}
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        <div className="inline-flex bg-white rounded-full p-1">
              <button
                className={`px-4 py-1 text-sm rounded-full ${activeTab==='users' ? 'bg-gray-200 text-gray-800' : 'text-gray-800'}`}
                onClick={()=>setActiveTab('users')}
              >Chats</button>
              <button
                className={`px-4 py-1 text-sm rounded-full ${activeTab==='groups' ? 'bg-gray-200 text-gray-800' : 'text-gray-800'}`}
                onClick={()=>setActiveTab('groups')}
              >Groups</button>
            </div>
          <div className="flex-1 flex items-center justify-center">
           
            <div className="font-semibold -ml-4 whitespace-nowrap text-gray-800">Forward</div>
          </div>
          <div className="text-sm opacity-90 whitespace-nowrap text-gray-800">{selectedCount} selected</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-3 pb-24">
        {/* Preview bubble */}
        {messageToForward && (
          <div className="mb-3">
            <div className="bg-gray-100 rounded-2xl p-3 inline-block max-w-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-medium text-gray-600">Preview</div>
              </div>
              {messageToForward.messageType === 'image' ? (
                <div className="max-w-[200px]">
                  <img
                    src={resolveUrl(messageToForward.fileUrl)}
                    alt={messageToForward.fileName || 'image'}
                    className="rounded-lg w-full h-auto max-h-[150px] object-cover"
                  />
                  {messageToForward.message && (
                    <div className="mt-2 text-sm text-gray-800 break-words">{messageToForward.message}</div>
                  )}
                  <div className="mt-2">
                    {selectedUsers.size > 0 && selectedGroups.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Personal</span>
                    )}
                    {selectedGroups.size > 0 && selectedUsers.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Group</span>
                    )}
                  </div>
                </div>
              ) : messageToForward.messageType === 'video' ? (
                <div className="max-w-[200px]">
                  <video
                    src={resolveUrl(messageToForward.fileUrl)}
                    controls
                    className="rounded-lg w-full h-auto max-h-[150px] object-cover"
                  />
                  {messageToForward.message && (
                    <div className="mt-2 text-sm text-gray-800 break-words">{messageToForward.message}</div>
                  )}
                  <div className="mt-2">
                    {selectedUsers.size > 0 && selectedGroups.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Personal</span>
                    )}
                    {selectedGroups.size > 0 && selectedUsers.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Group</span>
                    )}
                  </div>
                </div>
              ) : messageToForward.messageType && messageToForward.messageType !== 'text' ? (
                <div>
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm">
                    <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 18h8v2H8v-2zm0-4h8v2H8v-2zm6-7.5V9h3.5L14 6.5z"/></svg>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{messageToForward.fileName || 'Attachment'}</div>
                      <div className="text-xs text-gray-500">{formatSize(messageToForward.fileSize)}</div>
                      {messageToForward.message && (
                        <div className="text-sm text-gray-800 break-words mt-1">{messageToForward.message}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    {selectedUsers.size > 0 && selectedGroups.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Personal</span>
                    )}
                    {selectedGroups.size > 0 && selectedUsers.size === 0 && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Group</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-800 break-words max-w-[200px]">
                  {messageToForward.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* List */}
        {activeTab === 'users' ? (
          <div className="divide-y border rounded-xl overflow-hidden">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={()=>toggleUser(u.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-green-500 text-white flex items-center justify-center">
                  {u.profileImage ? (
                    <img src={`${API_ORIGIN}${u.profileImage}`} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold">{u.name?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedUsers.has(u.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                  {selectedUsers.has(u.id) && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  )}
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No chats found</div>
            )}
          </div>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {filteredGroups.map(g => {
              const id = g.id || g._id
              return (
                <button
                  key={id}
                  onClick={()=>toggleGroup(id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-green-500 text-white flex items-center justify-center">
                    {g.avatar ? (
                      <img src={`${API_ORIGIN}${g.avatar}`} alt={g.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{g.name}</div>
                    <div className="text-xs text-gray-500 truncate">{(g.members?.length || 0)} members</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedGroups.has(id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {selectedGroups.has(id) && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredGroups.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No groups found</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">{selectedCount} selected</div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={()=>navigate(-1)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={submitting || selectedCount === 0}
              onClick={submitForward}
            >Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}


