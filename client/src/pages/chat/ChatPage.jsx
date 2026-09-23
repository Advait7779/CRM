import { Fragment, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { chatDayKey, chatDayLabel, chatTime, chatTimestamp, chatPreviewDate, sortChatMessages, mergeChatPage } from '../../utils/chatDate'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPost, apiDelete, apiUpload, apiDownload } from '../../utils/api'
import toast from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import {
  Search, Send, Paperclip, Smile, CheckCheck,
  Phone, Mail, Clock, RefreshCw, Trash2, ArrowLeft,
  MessageSquare, Shield, Sparkles, X, FileText,
  Users, UserPlus, ChevronRight, Info, Plus, Download
} from 'lucide-react'

// Helpful quick CRM message templates
const QUICK_TEMPLATES = [
  { label: 'Follow-up on Lead', text: 'Hi! Could you please share an update on the latest sales lead?' },
  { label: 'Review GST Report', text: 'Please review the monthly GST draft report when you get a moment.' },
  { label: 'Installation Update', text: 'Are today’s GPS / CCTV installations progressing as scheduled?' },
  { label: 'Task Status', text: 'Quick check-in on the pending tasks assigned for today.' },
]

const EMOJIS = ['👍', '👋', '😊', '🚀', '✅', '🔥', '👏', '💼', '📁', '📋', '⏰', '🎉', '🤝', '💡', '📞', '🙏']

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']

function isImageFile(filename = '') {
  if (!filename) return false
  const lower = filename.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function getFileMeta(filename = '') {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('.pdf')) return { type: 'PDF', label: 'PDF Document', color: '#ef4444', badge: 'PDF' }
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { type: 'DOC', label: 'Word Document', color: '#2563eb', badge: 'DOC' }
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return { type: 'PPT', label: 'PowerPoint', color: '#ea580c', badge: 'PPT' }
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return { type: 'XLS', label: 'Excel Sheet', color: '#10b981', badge: 'XLS' }
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return { type: 'ZIP', label: 'Zip Archive', color: '#8b5cf6', badge: 'ZIP' }
  if (lower.endsWith('.txt')) return { type: 'TXT', label: 'Text File', color: '#64748b', badge: 'TXT' }
  return { type: 'FILE', label: 'Document', color: '#0284c7', badge: 'FILE' }
}

// Specific avatar colors matching reference image palette
const COLOR_MAP = {
  'pramod joshi': '#10b981',
  'shriram traders': '#0284c7',
  'innovation solutions': '#2563eb',
  'matoshree net cafe': '#06b6d4',
  'gautam computer education': '#1d4ed8',
  'kumar graphics xerox': '#0d9488',
  'integral computer': '#0f766e',
  'tejaswi netcafe & csc center': '#0891b2',
  'rahul sharma': '#10b981',
  'priya patel': '#ec4899',
  'sahil': '#8b5cf6',
}

const PALETTE = ['#10b981', '#06b6d4', '#2563eb', '#8b5cf6', '#0d9488', '#ec4899', '#f59e0b', '#0284c7']

function getAvatarColor(name = '') {
  const lower = name.toLowerCase().trim()
  if (COLOR_MAP[lower]) return COLOR_MAP[lower]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function getInitials(name = '') {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatChatTime(dateString) {
  return chatPreviewDate(dateString)
}

function formatMessageTime(dateString) {
  return chatTime(dateString)
}

export default function ChatPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeContact, setActiveContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const browsingHistory = useRef(false)
  const conversationKey = useRef('')
  conversationKey.current = activeContact ? `${activeContact.isGroup ? 'group' : 'direct'}:${activeContact.groupId || activeContact.id}` : ''
  const orderedMessages = useMemo(() => sortChatMessages(messages), [messages])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  
  // Group creation modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    avatarColor: '#10b981',
    memberIds: []
  })
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupSearchQuery, setGroupSearchQuery] = useState('')

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // Scroll to bottom of message list
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    }
  }, [])

  // Fetch contacts list
  const fetchContacts = useCallback(async (silent = false) => {
    if (!silent) setLoadingContacts(true)
    try {
      const data = await apiGet('/chat/users')
      setContacts(Array.isArray(data) ? data : [])
    } catch (err) {
      if (!silent) toast.error(`Failed to load users: ${err.message}`)
    } finally {
      if (!silent) setLoadingContacts(false)
    }
  }, [])

  // Initial load & periodic contact refresh
  useEffect(() => {
    fetchContacts()
    const interval = setInterval(() => fetchContacts(true), 5000)
    return () => clearInterval(interval)
  }, [fetchContacts])

  // Fetch messages for active contact / group
  const fetchMessages = useCallback(async (contactId, silent = false, isGroup = false) => {
    if (!contactId) return
    if (!silent) setLoadingMessages(true)
    try {
      const endpoint = isGroup 
        ? `/chat/messages/${contactId}?type=group` 
        : `/chat/messages/${contactId}`
      const key = `${isGroup ? 'group' : 'direct'}:${contactId}`
      const data = await apiGet(endpoint)
      if (conversationKey.current !== key) return
      const page = Array.isArray(data) ? data : []
      if (!silent) setHasOlder(page.length === 100)
      setMessages(previous => silent ? mergeChatPage(previous, page) : page)
      if (!silent) {
        setTimeout(() => scrollToBottom(false), 50)
      }
    } catch (err) {
      if (!silent) toast.error(`Failed to load chat: ${err.message}`)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }, [scrollToBottom])

  // When active contact changes
  useEffect(() => {
    browsingHistory.current = false
    setMessages([])
    setHasOlder(false)
    if (activeContact) {
      fetchMessages(activeContact.groupId || activeContact.id, false, activeContact.isGroup)
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, unreadCount: 0 } : c))
    } else {
      setMessages([])
    }
  }, [activeContact, fetchMessages])

  // Live polling for new messages in active chat
  useEffect(() => {
    if (!activeContact) return
    const interval = setInterval(() => {
      fetchMessages(activeContact.groupId || activeContact.id, true, activeContact.isGroup)
    }, 2500)
    return () => clearInterval(interval)
  }, [activeContact, fetchMessages])

  // Scroll to bottom when messages update
  useEffect(() => {
    if (!browsingHistory.current) scrollToBottom(true)
  }, [messages.length, scrollToBottom])

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return
    const key = conversationKey.current
    const target = activeContact.groupId || activeContact.id
    const before = Math.min(...messages.map(message => Number(message.id)))
    browsingHistory.current = true
    setLoadingOlder(true)
    try {
      const page = await apiGet(`/chat/messages/${target}?before=${before}${activeContact.isGroup ? '&type=group' : ''}`)
      if (conversationKey.current !== key) return
      setMessages(previous => mergeChatPage(previous, page, true))
      setHasOlder(page.length === 100)
    } catch (error) { toast.error(error.message) }
    finally { setLoadingOlder(false) }
  }

  // Download / Save attachment to user device
  const handleDownloadAttachment = async (e, storedName, originalName) => {
    if (e) e.stopPropagation()
    const displayName = originalName || storedName || 'document'
    const lookupName = storedName || originalName
    try {
      const toastId = toast.loading(`Downloading ${displayName}...`)
      await apiDownload(`/chat/download/${encodeURIComponent(lookupName)}?name=${encodeURIComponent(displayName)}`, displayName)
      toast.success(`Saved "${displayName}" to device!`, { id: toastId })
    } catch (err) {
      toast.error(`Download failed: ${err.message}`)
    }
  }

  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(null)

  // Delete message within 10 minutes
  const handleDeleteMessage = (msgId, createdAt) => {
    const messageAgeMs = Date.now() - new Date(createdAt).getTime()
    if (messageAgeMs > 10 * 60 * 1000) {
      return toast.error('10 minutes have passed. This message cannot be deleted.')
    }
    setConfirmDeleteMsg({ id: msgId, createdAt })
  }

  const executeDeleteMessage = async () => {
    if (!confirmDeleteMsg) return
    const { id: msgId } = confirmDeleteMsg
    try {
      await apiDelete(`/chat/messages/${msgId}`)
      setMessages(prev => prev.filter(m => m.id !== msgId))
      toast.success('Message deleted')
      fetchContacts(true)
      setConfirmDeleteMsg(null)
    } catch (err) {
      toast.error(`Could not delete message: ${err.message}`)
    }
  }

  // Send message (Supports 1-on-1 and Groups)
  const handleSendMessage = async (e) => {
    browsingHistory.current = false
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed && !selectedFile) return
    if (!activeContact) return

    setSending(true)

    let optimisticBlobUrl = null
    if (selectedFile && isImageFile(selectedFile.name)) {
      try {
        optimisticBlobUrl = URL.createObjectURL(selectedFile)
      } catch  {}
    }

    const optimisticMessage = {
      id: Date.now(),
      senderId: user.id,
      receiverId: activeContact.isGroup ? null : activeContact.id,
      groupId: activeContact.isGroup ? activeContact.groupId : null,
      message: trimmed || (selectedFile ? `Sent attachment: ${selectedFile.name}` : ''),
      attachment: optimisticBlobUrl || (selectedFile ? selectedFile.name : null),
      attachmentName: selectedFile ? selectedFile.name : null,
      read: false,
      senderName: user.name,
      createdAt: new Date().toISOString(),
      pending: true
    }

    setMessages(prev => [...prev, optimisticMessage])
    setInputText('')
    setShowEmojiPicker(false)

    let uploadedStoredName = null
    let uploadedOriginalName = selectedFile ? selectedFile.name : null

    if (selectedFile) {
      const formData = new FormData()
      formData.append('file', selectedFile)
      try {
        const uploadRes = await apiUpload('/chat/upload', formData)
        uploadedStoredName = uploadRes.storedName
        uploadedOriginalName = uploadRes.originalName || selectedFile.name
      } catch (uploadErr) {
        toast.error(`Failed to upload file: ${uploadErr.message}`)
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        setSending(false)
        return
      }
    }

    setSelectedFile(null)

    try {
      const payload = activeContact.isGroup
        ? {
            groupId: activeContact.groupId,
            isGroup: true,
            message: trimmed,
            attachment: uploadedStoredName || uploadedOriginalName,
            attachmentName: uploadedOriginalName
          }
        : {
            receiverId: activeContact.id,
            message: trimmed,
            attachment: uploadedStoredName || uploadedOriginalName,
            attachmentName: uploadedOriginalName
          }

      const created = await apiPost('/chat/messages', payload)
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? created : m))
      fetchContacts(true)
    } catch (err) {
      toast.error(`Message not sent: ${err.message}`)
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
    } finally {
      setSending(false)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }

  // Handle textarea enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Quick template selection
  const handleSelectTemplate = (text) => {
    setInputText(text)
    if (textareaRef.current) textareaRef.current.focus()
  }

  // Handle File Attachment
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        return toast.error('File size must be under 10MB')
      }
      setSelectedFile(file)
      toast.success(`Attached "${file.name}"`)
    }
  }

  // Open Create Group Modal
  const openCreateGroup = () => {
    const availableUsers = contacts.filter(c => !c.isGroup).map(c => c.id)
    setGroupForm({
      name: '',
      description: '',
      avatarColor: '#10b981',
      memberIds: availableUsers.slice(0, 3)
    })
    setGroupSearchQuery('')
    setShowCreateGroupModal(true)
  }

  // Handle Group Member Toggle
  const toggleGroupMember = (userId) => {
    setGroupForm(prev => {
      const exists = prev.memberIds.includes(userId)
      return {
        ...prev,
        memberIds: exists 
          ? prev.memberIds.filter(id => id !== userId) 
          : [...prev.memberIds, userId]
      }
    })
  }

  // Select all group members
  const toggleSelectAllMembers = () => {
    const allIds = contacts.filter(c => !c.isGroup).map(c => c.id)
    setGroupForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.length === allIds.length ? [] : allIds
    }))
  }

  // Handle Create Group Submission
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault()
    if (!groupForm.name.trim()) {
      return toast.error('Please enter a group name')
    }
    if (groupForm.memberIds.length === 0) {
      return toast.error('Please select at least one member for the group')
    }

    setCreatingGroup(true)
    try {
      const created = await apiPost('/chat/groups', groupForm)
      toast.success(`Group "${created.name}" created successfully!`)
      setShowCreateGroupModal(false)
      await fetchContacts()
      // Select the new group
      setActiveContact({
        id: `group_${created.id}`,
        groupId: created.id,
        name: created.name,
        description: created.description,
        avatarColor: created.avatarColor || '#10b981',
        isGroup: true,
        memberIds: created.members || [],
        role: `${(created.members || []).length} members`
      })
    } catch (err) {
      toast.error(`Failed to create group: ${err.message}`)
    } finally {
      setCreatingGroup(false)
    }
  }

  // Filter contacts by search query
  const filteredContacts = contacts.filter(contact => {
    return (
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery) ||
      (contact.lastMessage?.message?.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Outer Split Layout Container */}
      <div 
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          position: 'relative',
          height: '100%',
          width: '100%'
        }}
      >
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CONTACTS LIST (Matches Shared Image Exactly)                  */}
        {/* ========================================================================= */}
        <div 
          style={{
            width: '360px',
            minWidth: '340px',
            maxWidth: '380px',
            flexShrink: 0,
            height: '100%',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card)',
            zIndex: 10
          }}
          className={`${activeContact ? 'hidden md:flex' : 'flex'} w-full md:w-[360px]`}
        >
          {/* Top Search Bar (Exact Matching Shared Image 1) */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search 
                  size={15} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-muted)',
                    pointerEvents: 'none'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Group Create Button */}
              <button
                type="button"
                onClick={openCreateGroup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Create Group"
              >
                <Plus size={14} />
                <span>Group</span>
              </button>
            </div>
          </div>

          {/* Contacts List Scroll Container (Exact layout from Shared Image 1) */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingContacts ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#10b981' }} />
                <div style={{ fontSize: '13px' }}>Loading contacts...</div>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={30} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                <div style={{ fontSize: '13.5px', fontWeight: 600 }}>No contacts found</div>
              </div>
            ) : (
              filteredContacts.map(contact => {
                const isSelected = activeContact?.id === contact.id
                const avatarColor = contact.isGroup ? (contact.avatarColor || '#10b981') : getAvatarColor(contact.name)
                const initials = contact.isGroup ? 'G' : getInitials(contact.name).slice(0, 1)
                const hasUnread = contact.unreadCount > 0

                return (
                  <div
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected 
                        ? 'rgba(16, 185, 129, 0.08)' 
                        : hasUnread 
                          ? 'rgba(16, 185, 129, 0.03)' 
                          : 'transparent',
                      borderRight: isSelected ? '4px solid #10b981' : '4px solid transparent',
                      transition: 'background 0.15s ease'
                    }}
                    className="hover:bg-slate-500/5 group"
                  >
                    {/* Avatar Circle (Image 1 style) */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: avatarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '18px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        {contact.isGroup ? <Users size={20} /> : initials}
                      </div>
                    </div>

                    {/* Contact Info (Name, Preview, Today timestamp, Unread badge, New chat tag) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span 
                          style={{ 
                            fontSize: '14.5px', 
                            fontWeight: isSelected || hasUnread ? 700 : 600, 
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {contact.name}
                        </span>
                        <span style={{ fontSize: '11.5px', color: hasUnread ? '#10b981' : '#94a3b8', flexShrink: 0, fontWeight: hasUnread ? 700 : 500 }}>
                          {formatChatTime(contact.lastMessage?.createdAt || contact.lastActive)}
                        </span>
                      </div>

                      {/* Message Snippet & Unread Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <p 
                          style={{ 
                            fontSize: '12.5px', 
                            color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: hasUnread ? 600 : 400,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            margin: 0,
                            flex: 1
                          }}
                        >
                          {contact.lastMessage ? (
                            <>
                              {contact.lastMessage.senderId === user?.id && <span style={{ opacity: 0.75 }}>You: </span>}
                              {contact.lastMessage.message}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>?</span>
                          )}
                        </p>

                        {hasUnread && (
                          <span 
                            style={{
                              background: '#10b981',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              minWidth: '18px',
                              height: '18px',
                              borderRadius: '9999px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 5px',
                              flexShrink: 0
                            }}
                          >
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Tag pill below message snippet (Exact matching "New chat" in Image 1) */}
                      <div style={{ marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {contact.isGroup ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.12)',
                            padding: '1px 7px',
                            borderRadius: '4px'
                          }}>
                            Group
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: '#d97706',
                            background: '#fef3c7',
                            padding: '1px 7px',
                            borderRadius: '4px',
                            border: '1px solid #fde68a'
                          }}>
                            New chat
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: MAIN CONVERSATION PANEL (Takes Full Remaining Width)        */}
        {/* ========================================================================= */}
        <div 
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            position: 'relative'
          }}
          className={`${activeContact ? 'flex' : 'hidden md:flex'} w-full h-full`}
        >
          {activeContact ? (
            <>
              {/* Active Chat Header */}
              <div 
                style={{
                  padding: '12px 20px',
                  background: 'var(--bg-card)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  zIndex: 5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setActiveContact(null)}
                    className="md:hidden"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '8px'
                    }}
                  >
                    <ArrowLeft size={20} />
                  </button>

                  {/* Contact Avatar in Header */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: activeContact.isGroup ? (activeContact.avatarColor || '#10b981') : getAvatarColor(activeContact.name),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: activeContact.isGroup ? '12px' : '17px'
                      }}
                    >
                      {activeContact.isGroup ? <Users size={20} /> : getInitials(activeContact.name).slice(0, 1)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeContact.name}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: activeContact.isGroup ? '#10b981' : '#6366f1',
                        background: activeContact.isGroup ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.1)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {activeContact.isGroup ? 'Group' : 'Direct Chat'}
                      </span>
                    </div>
                    {activeContact.isGroup && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {activeContact.memberIds?.length || 0} members
                      </div>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeContact.phone && (
                    <a
                      href={`tel:${activeContact.phone}`}
                      title={`Call ${activeContact.phone}`}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none'
                      }}
                    >
                      <Phone size={16} />
                    </a>
                  )}
                  {activeContact.email && (
                    <a
                      href={`mailto:${activeContact.email}`}
                      title={`Email ${activeContact.email}`}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none'
                      }}
                    >
                      <Mail size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => setShowInfoModal(true)}
                    title="Info & Details"
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Info size={16} />
                  </button>
                  <button
                    onClick={() => fetchMessages(activeContact.groupId || activeContact.id, false, activeContact.isGroup)}
                    title="Refresh Chat"
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Chat Message History Area */}
              <div 
                style={{
                  flex: 1,
                  padding: '20px 24px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }}
              >
                {/* Date Badge */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px 0' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-card)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}>
                    Today
                  </span>
                </div>

                {/* Loading state or Empty Conversation Starter */}
                {hasOlder && <button type="button" disabled={loadingOlder} onClick={loadOlder} style={{ alignSelf: 'center', padding: '8px 16px', margin: 12, borderRadius: 16, cursor: 'pointer' }}>
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </button>}
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#10b981' }} />
                    <div>Loading messages...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    margin: 'auto',
                    textAlign: 'center',
                    maxWidth: '420px',
                    padding: '24px',
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(16,185,129,0.12)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto'
                    }}>
                      <Sparkles size={24} />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Start conversation with {activeContact.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Type a message below or click a quick prompt template:
                    </p>

                    {/* Quick CRM Action Prompts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {QUICK_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectTemplate(tmpl.text)}
                          style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            fontSize: '12.5px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          className="hover:border-emerald-500 hover:bg-emerald-500/5"
                        >
                          <span>{tmpl.label}</span>
                          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  orderedMessages.map((msg, index) => {
                    const startsDay = index === 0 || chatDayKey(msg.createdAt) !== chatDayKey(orderedMessages[index - 1].createdAt)
                    const isMe = msg.senderId === user?.id
                    const isWithin10Min = (Date.now() - new Date(msg.createdAt).getTime()) <= 10 * 60 * 1000
                    const canDelete = (isMe || user?.role === 'super_admin') && isWithin10Min
                    const isHovered = hoveredMsgId === msg.id

                    return (
                      <Fragment key={msg.id || index}>
                        {startsDay && <div role="separator" aria-label={chatDayLabel(msg.createdAt)} style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 8px' }}>
                          <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{chatDayLabel(msg.createdAt)}</span>
                        </div>}
                      <div
                        key={msg.id || index}
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                        style={{
                          display: 'flex',
                          justifyContent: isMe ? 'flex-end' : 'flex-start',
                          alignItems: 'center',
                          gap: '6px',
                          position: 'relative'
                        }}
                      >
                        {/* Received contact mini avatar */}
                        {!isMe && (
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: getAvatarColor(msg.senderName || activeContact.name),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0,
                              alignSelf: 'flex-end',
                              marginBottom: '2px'
                            }}
                          >
                            {getInitials(msg.senderName || activeContact.name).slice(0, 1)}
                          </div>
                        )}

                        {/* OUTSIDE Delete Trash Button (Left of bubble on sent messages - Visible on Hover) */}
                        {isMe && canDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMessage(msg.id, msg.createdAt)
                            }}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              flexShrink: 0,
                              opacity: isHovered ? 1 : 0,
                              pointerEvents: isHovered ? 'auto' : 'none',
                              transform: isHovered ? 'scale(1)' : 'scale(0.85)',
                              transition: 'opacity 0.15s ease, transform 0.15s ease'
                            }}
                            className="hover:scale-110 hover:bg-red-500/10"
                            title="Delete message for everyone (available within 10 mins)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {/* WhatsApp-Style Chat Bubble */}
                        <div
                          style={{
                            maxWidth: '75%',
                            minWidth: '100px',
                            padding: '10px 14px',
                            borderRadius: isMe 
                              ? '14px 14px 2px 14px' 
                              : '14px 14px 14px 2px',
                            background: isMe 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                              : 'var(--bg-card)',
                            color: isMe ? '#ffffff' : 'var(--text-primary)',
                            border: isMe ? 'none' : '1px solid var(--border-color)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            position: 'relative',
                            wordBreak: 'break-word',
                            fontSize: '13.5px',
                            lineHeight: 1.45
                          }}
                        >
                          {/* Group Message: Sender Name */}
                          {activeContact.isGroup && !isMe && (
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '3px' }}>
                              {msg.senderName || 'Team Member'}
                            </div>
                          )}

                          {/* Media / Attachment Rendering */}
                          {msg.attachment && (
                            <>
                              {isImageFile(msg.attachmentName || msg.attachment) ? (
                                /* Direct Inline Image (WhatsApp Style - Clean & Direct) */
                                <div 
                                  style={{
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    marginBottom: (msg.message && !msg.message.startsWith('Sent attachment:') && !msg.message.startsWith('Sent:')) ? '6px' : '0',
                                    cursor: 'pointer',
                                    background: 'rgba(0,0,0,0.06)'
                                  }}
                                  onClick={() => setPreviewImage({
                                    src: (msg.attachment.startsWith('blob:') || msg.attachment.startsWith('http') || msg.attachment.startsWith('data:'))
                                      ? msg.attachment
                                      : `/api/chat/media/${encodeURIComponent(msg.attachment)}`,
                                    name: msg.attachmentName || msg.attachment
                                  })}
                                  title="Click to view full photo"
                                >
                                  <img
                                    src={
                                      (msg.attachment.startsWith('blob:') || msg.attachment.startsWith('http') || msg.attachment.startsWith('data:'))
                                        ? msg.attachment
                                        : `/api/chat/media/${encodeURIComponent(msg.attachment)}`
                                    }
                                    alt={msg.attachmentName || 'Photo'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '280px',
                                      objectFit: 'contain',
                                      borderRadius: '8px',
                                      display: 'block'
                                    }}
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                /* Document Card for PDF, Word, PPT, Excel, Zip (with Download button) */
                                <div 
                                  onClick={(e) => handleDownloadAttachment(e, msg.attachment, msg.attachmentName)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    padding: '9px 12px',
                                    borderRadius: '10px',
                                    background: isMe ? 'rgba(0,0,0,0.2)' : 'var(--bg-secondary)',
                                    border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)',
                                    marginBottom: (msg.message && !msg.message.startsWith('Sent attachment:') && !msg.message.startsWith('Sent:')) ? '8px' : '0',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  className="hover:scale-[1.01] group/att"
                                  title="Click to save and download file to your device"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                    <div 
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: getFileMeta(msg.attachmentName || msg.attachment).color,
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                      }}
                                    >
                                      {getFileMeta(msg.attachmentName || msg.attachment).badge}
                                    </div>

                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div 
                                        style={{ 
                                          fontSize: '13px', 
                                          fontWeight: 700, 
                                          color: isMe ? '#ffffff' : 'var(--text-primary)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}
                                      >
                                        {msg.attachmentName || msg.attachment}
                                      </div>
                                      <div 
                                        style={{ 
                                          fontSize: '11px', 
                                          color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                                          marginTop: '1px'
                                        }}
                                      >
                                        {getFileMeta(msg.attachmentName || msg.attachment).label} • Click to download
                                      </div>
                                    </div>
                                  </div>

                                  {/* Download Icon Button */}
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.12)',
                                      color: isMe ? '#ffffff' : '#10b981',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      transition: 'all 0.15s ease'
                                    }}
                                    className="group-hover/att:bg-emerald-500 group-hover/att:text-white"
                                  >
                                    <Download size={16} />
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Message Text (Hide if it's purely default "Sent attachment: filename") */}
                          {msg.message && 
                           !msg.message.startsWith('Sent attachment:') && 
                           !msg.message.startsWith('Sent: ') && (
                            <div>{msg.message}</div>
                          )}

                          {/* Bottom metadata (pure time and ticks ONLY) */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '4px',
                              marginTop: '4px',
                              fontSize: '10.5px',
                              color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)'
                            }}
                          >
                            <time dateTime={msg.createdAt} title={chatTimestamp(msg.createdAt)} aria-label={chatTimestamp(msg.createdAt)}>{formatMessageTime(msg.createdAt)}</time>
                            {isMe && (
                              <span>
                                {msg.pending ? (
                                  <Clock size={11} style={{ opacity: 0.6 }} />
                                ) : msg.read ? (
                                  <CheckCheck size={13} style={{ color: '#93c5fd' }} />
                                ) : (
                                  <CheckCheck size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* OUTSIDE Delete Trash Button (Right of bubble for superadmin on received messages - Visible on Hover) */}
                        {!isMe && canDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMessage(msg.id, msg.createdAt)
                            }}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              flexShrink: 0,
                              opacity: isHovered ? 1 : 0,
                              pointerEvents: isHovered ? 'auto' : 'none',
                              transform: isHovered ? 'scale(1)' : 'scale(0.85)',
                              transition: 'opacity 0.15s ease, transform 0.15s ease'
                            }}
                            className="hover:scale-110 hover:bg-red-500/10"
                            title="Delete message (Super Admin)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      </Fragment>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Quick Starter Chips (when active) */}
              {messages.length > 0 && (
                <div 
                  style={{ 
                    padding: '6px 16px', 
                    background: 'var(--bg-card)', 
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex', 
                    gap: '8px', 
                    overflowX: 'auto' 
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    Quick chips:
                  </span>
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectTemplate(tmpl.text)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11.5px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      className="hover:border-emerald-500 hover:text-emerald-600"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Attached file preview chip */}
              {selectedFile && (
                <div 
                  style={{ 
                    padding: '8px 18px', 
                    background: 'rgba(16,185,129,0.1)', 
                    borderTop: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#10b981', fontWeight: 600 }}>
                    <FileText size={16} />
                    <span>Attached: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Emoji Drawer Popover */}
              {showEmojiPicker && (
                <div 
                  style={{
                    padding: '10px 16px',
                    background: 'var(--bg-card)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    animation: 'fadeIn 0.2s ease'
                  }}
                >
                  {EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(prev => prev + emoji)
                        if (textareaRef.current) textareaRef.current.focus()
                      }}
                      style={{
                        fontSize: '20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px'
                      }}
                      className="hover:bg-slate-500/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Bottom Message Input Bar (WhatsApp Layout) */}
              <form 
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px 18px',
                  background: 'var(--bg-card)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                {/* Emoji Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(p => !p)}
                  title="Insert emoji"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: showEmojiPicker ? '#10b981' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover:bg-slate-500/10"
                >
                  <Smile size={20} />
                </button>

                {/* Attachment Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.zip,.rar,.7z,.txt"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: selectedFile ? '#10b981' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover:bg-slate-500/10"
                >
                  <Paperclip size={20} />
                </button>

                {/* Message Input Field */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={textareaRef}
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '24px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  />
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !selectedFile)}
                  title="Send message"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: (!inputText.trim() && !selectedFile)
                      ? 'var(--bg-secondary)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: (!inputText.trim() && !selectedFile) ? 'var(--text-muted)' : '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (!inputText.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
                    boxShadow: (!inputText.trim() && !selectedFile) ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            /* ========================================================================= */
            /* EMPTY STATE: CLEAN WHATSAPP WEB STYLE (Matches Image 1 Exactly)           */
            /* ========================================================================= */
            <div 
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                background: 'var(--bg-primary)'
              }}
            >
              {/* WhatsApp Circular Icon matching Image 1 */}
              <div 
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  color: '#10b981'
                }}
              >
                <MessageSquare size={40} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Select a chat to start messaging
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5, marginBottom: '28px' }}>
                Send and receive real-time messages with team members and customers.
              </p>

              {/* Protected Note */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Shield size={13} style={{ color: '#10b981' }} />
                <span>End-to-end encrypted CRM team messaging</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POPUP FORM MODAL: CREATE TEAM GROUP (Separate option on this page)        */}
      {/* ========================================================================= */}
      {showCreateGroupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowCreateGroupModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Create Team Group
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Coordinate tasks and chat with multiple team members
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateGroupModal(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleCreateGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '2px' }}>
              {/* Group Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sales & Dispatch Operations"
                  value={groupForm.name}
                  onChange={e => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Group Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Description / Topic (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., For tracking client installations and billing follow-ups"
                  value={groupForm.description}
                  onChange={e => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Group Avatar Color Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Group Color Theme
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {PALETTE.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setGroupForm(prev => ({ ...prev, avatarColor: col }))}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: col,
                        border: groupForm.avatarColor === col ? '3px solid #fff' : '2px solid transparent',
                        outline: groupForm.avatarColor === col ? `2px solid ${col}` : 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.15s'
                      }}
                      className="hover:scale-110"
                    />
                  ))}
                </div>
              </div>

              {/* Select Members Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Select Group Members ({groupForm.memberIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAllMembers}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#10b981',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {groupForm.memberIds.length === contacts.filter(c => !c.isGroup).length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Member Search input */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search 
                    size={14} 
                    style={{ 
                      position: 'absolute', 
                      left: '10px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      color: 'var(--text-muted)',
                      pointerEvents: 'none'
                    }} 
                  />
                  <input
                    type="text"
                    placeholder="Search users to add..."
                    value={groupSearchQuery}
                    onChange={e => setGroupSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 28px 7px 30px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Members Checklist Box */}
                <div 
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    padding: '6px'
                  }}
                >
                  {contacts
                    .filter(c => !c.isGroup && c.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                    .map(contact => {
                      const isChecked = groupForm.memberIds.includes(contact.id)

                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleGroupMember(contact.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(16,185,129,0.1)' : 'transparent',
                            marginBottom: '2px',
                            transition: 'background 0.15s'
                          }}
                          className="hover:bg-slate-500/10"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: getAvatarColor(contact.name),
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {getInitials(contact.name).slice(0, 1)}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{contact.role}</div>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{
                              width: '16px',
                              height: '16px',
                              accentColor: '#10b981',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px' }}
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && activeContact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowInfoModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {activeContact.isGroup ? 'Group Information' : 'Contact Details'}
              </h3>
              <button onClick={() => setShowInfoModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: activeContact.isGroup ? (activeContact.avatarColor || '#10b981') : getAvatarColor(activeContact.name),
                color: '#fff',
                fontWeight: 700,
                fontSize: activeContact.isGroup ? '16px' : '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}>
                {activeContact.isGroup ? <Users size={32} /> : getInitials(activeContact.name).slice(0, 1)}
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{activeContact.name}</h4>
              <p style={{ fontSize: '13px', color: '#10b981', fontWeight: 600, margin: '4px 0 0 0' }}>
                {activeContact.isGroup ? `${activeContact.memberIds?.length || 0} Members` : activeContact.role}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
              {activeContact.isGroup ? (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>Description:</strong> {activeContact.description || 'No description provided.'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>Members:</strong> {activeContact.memberNames?.join(', ') || 'All team members'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{activeContact.email || 'No email provided'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Phone size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{activeContact.phone || 'No phone number'}</span>
                  </div>

                </>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setShowInfoModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Lightbox Preview Modal (WhatsApp Style) */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '24px'
          }}
          onClick={() => setPreviewImage(null)}
        >
          {/* Top bar with file name, download, and close */}
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: '24px',
              right: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
              {previewImage.name}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={(e) => handleDownloadAttachment(e, previewImage.name, previewImage.name)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                className="hover:bg-white/25"
                title="Save image to device"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                className="hover:bg-white/25"
                title="Close preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Center Image */}
          <img
            src={previewImage.src}
            alt={previewImage.name}
            style={{
              maxWidth: '92vw',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteMsg)}
        onClose={() => setConfirmDeleteMsg(null)}
        title="Delete for Everyone"
        subtitle="This message will be removed for all participants"
        message="Are you sure you want to delete this message for everyone? This action cannot be undone."
        confirmText="Delete for Everyone"
        onConfirm={executeDeleteMessage}
      />
    </div>
  )
}
