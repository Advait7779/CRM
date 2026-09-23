import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { chatDayKey, chatDayLabel, chatTime, chatTimestamp, sortChatMessages, mergeChatPage } from '../../utils/chatDate';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
  Keyboard,
  ActivityIndicator,
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiDelete, apiUpload, getServerUrl, getAuthToken } from '../../config/api';
import Header from '../../components/common/Header';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  Check,
  CheckCheck,
  Smile,
  X,
} from 'lucide-react-native';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
const EMOJIS = ['👍', '👋', '😊', '🚀', '✅', '🔥', '👏', '💼', '📁', '📋', '⏰', '🎉', '🤝', '💡', '📞', '🙏'];

function isImageFile(filename = '') {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function getFileMeta(filename = '') {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return { type: 'PDF', label: 'PDF Document', color: '#ef4444', badge: 'PDF' };
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { type: 'DOC', label: 'Word Document', color: '#2563eb', badge: 'DOC' };
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return { type: 'PPT', label: 'PowerPoint', color: '#ea580c', badge: 'PPT' };
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return { type: 'XLS', label: 'Excel Sheet', color: '#10b981', badge: 'XLS' };
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return { type: 'ZIP', label: 'Zip Archive', color: '#8b5cf6', badge: 'ZIP' };
  if (lower.endsWith('.txt')) return { type: 'TXT', label: 'Text File', color: '#64748b', badge: 'TXT' };
  return { type: 'FILE', label: 'Document Attachment', color: '#0284c7', badge: 'FILE' };
}

export default function ChatConversationScreen({ route, navigation }) {
  const { contact } = route.params || {};
  const { colors } = useTheme();
  const { user } = useAuth();

  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const browsingHistory = useRef(false);
  const conversationKey = useRef('');
  conversationKey.current = contact ? `${contact.isGroup ? 'group' : 'direct'}:${contact.groupId || contact.id}` : '';
  const orderedMessages = useMemo(() => sortChatMessages(messages), [messages]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverBaseUrl, setServerBaseUrl] = useState('');
  const [authToken, setLocalAuthToken] = useState('');
  const { height: currentWindowHeight } = useWindowDimensions();
  const screenHeightRef = useRef(currentWindowHeight);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastKeyboardHeight = useRef(Platform.OS === 'android' ? 310 : 336);

  useEffect(() => {
    if (!isKeyboardVisible && currentWindowHeight > screenHeightRef.current) {
      screenHeightRef.current = currentWindowHeight;
    }
  }, [currentWindowHeight, isKeyboardVisible]);

  useEffect(() => {
    const onShow = (e) => {
      const kh = e?.endCoordinates?.height || 0;
      const finalKh = Math.max(kh, Platform.OS === 'android' ? 310 : 300);
      lastKeyboardHeight.current = finalKh;
      setKeyboardHeight(finalKh);
      setIsKeyboardVisible(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };

    const onHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
    const androidShowSub = Platform.OS === 'android'
      ? Keyboard.addListener('keyboardDidShow', onShow)
      : null;
    const androidHideSub = Platform.OS === 'android'
      ? Keyboard.addListener('keyboardDidHide', onHide)
      : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      androidShowSub?.remove();
      androidHideSub?.remove();
    };
  }, []);

  // Safe bottom padding: when keyboard is hidden, lift above Android 3-button navigation (and iOS home bar)
  // When keyboard is open, keyboard itself is above the navigation buttons, so standard 8px padding is used.
  const inputBottomPadding = isKeyboardVisible || keyboardHeight > 0
    ? 8
    : Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 14);

  const windowAlreadyResized = Platform.OS === 'android' &&
    (screenHeightRef.current - currentWindowHeight > 120);

  const androidNavHeight = Math.max(insets.bottom, 48);
  const effectiveKeyboardOffset = windowAlreadyResized
    ? 0
    : keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === 'android' ? androidNavHeight + 6 : 0)
      : 0;

  const flatListRef = useRef(null);

  useEffect(() => {
    Promise.all([getServerUrl(), getAuthToken()]).then(([url, token]) => {
      setServerBaseUrl(url.replace(/\/api$/, ''));
      setLocalAuthToken(token || '');
    });
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!contact) return;
    try {
      const targetId = contact.isGroup ? contact.groupId || contact.id : contact.id;
      const endpoint = contact.isGroup
        ? `/chat/messages/${targetId}?type=group`
        : `/chat/messages/${targetId}`;

      const key = conversationKey.current;
      const data = await apiGet(endpoint);
      if (conversationKey.current !== key) return;
      const page = Array.isArray(data) ? data : [];
      if (!silent) setHasOlder(page.length === 100);
      setMessages(previous => silent ? mergeChatPage(previous, page) : page);
    } catch (err) {
      if (!silent) console.error('Failed to load chat messages', err);
    }
  }, [contact]);

  useEffect(() => {
    browsingHistory.current = false;
    setMessages([]);
    setHasOlder(false);
    fetchMessages(false);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') fetchMessages(true);
    }, 4000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchMessages(true);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [fetchMessages]);

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    const key = conversationKey.current;
    const target = contact.groupId || contact.id;
    browsingHistory.current = true;
    setLoadingOlder(true);
    try {
      const before = Math.min(...messages.map(message => Number(message.id)));
      const page = await apiGet(`/chat/messages/${target}?before=${before}${contact.isGroup ? '&type=group' : ''}`);
      if (conversationKey.current !== key) return;
      setMessages(previous => mergeChatPage(previous, page, true));
      setHasOlder(page.length === 100);
    } catch (error) { Alert.alert('History unavailable', error.message); }
    finally { setLoadingOlder(false); }
  };

  const handleSendMessage = async (textToSend = inputText, attachmentFile = null) => {
    browsingHistory.current = false;
    const trimmed = (textToSend || '').trim();
    if (!trimmed && !attachmentFile) return;

    setSending(true);

    // Optimistic message
    const optimistic = {
      id: Date.now(),
      senderId: user.id,
      receiverId: contact.isGroup ? null : contact.id,
      groupId: contact.isGroup ? contact.groupId || contact.id : null,
      message: trimmed || (attachmentFile ? `Sent attachment: ${attachmentFile.name}` : ''),
      attachment: attachmentFile ? attachmentFile.uri : null,
      attachmentName: attachmentFile ? attachmentFile.name : null,
      read: false,
      senderName: user.name,
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);

    let uploadedStoredName = null;
    let uploadedOriginalName = attachmentFile ? attachmentFile.name : null;

    if (attachmentFile) {
      const formData = new FormData();
      formData.append('file', {
        uri: attachmentFile.uri,
        name: attachmentFile.name || 'upload.jpg',
        type: attachmentFile.type || 'image/jpeg'
      });

      try {
        const uploadRes = await apiUpload('/chat/upload', formData);
        uploadedStoredName = uploadRes.storedName;
        uploadedOriginalName = uploadRes.originalName || attachmentFile.name;
      } catch (uploadErr) {
        Alert.alert('Upload Failed', uploadErr.message || 'Could not upload file');
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        setSending(false);
        return;
      }
    }

    try {
      const payload = contact.isGroup
        ? {
            groupId: contact.groupId || contact.id,
            isGroup: true,
            message: trimmed,
            attachment: uploadedStoredName || uploadedOriginalName,
            attachmentName: uploadedOriginalName
          }
        : {
            receiverId: contact.id,
            message: trimmed,
            attachment: uploadedStoredName || uploadedOriginalName,
            attachmentName: uploadedOriginalName
          };

      const created = await apiPost('/chat/messages', payload);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? created : m));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to send images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const filename = asset.fileName || `photo_${Date.now()}.jpg`;
      handleSendMessage('', {
        uri: asset.uri,
        name: filename,
        type: 'image/jpeg'
      });
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        handleSendMessage('', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream'
        });
      }
    } catch (err) {
      console.error('Document pick error', err);
    }
  };

  const handleDownloadAttachment = async (storedName, originalName) => {
    const displayName = originalName || storedName || 'document';
    const lookupName = storedName || originalName;
    const downloadUrl = `${serverBaseUrl}/api/chat/download/${encodeURIComponent(lookupName)}?name=${encodeURIComponent(displayName)}`;

    try {
      const localUri = `${FileSystem.documentDirectory}${displayName}`;
      const downloadRes = await FileSystem.downloadAsync(downloadUrl, localUri, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      
      if (downloadRes.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          Alert.alert('Saved', `Saved file to:\n${downloadRes.uri}`);
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      Alert.alert('Download Error', err.message || 'Could not download file');
    }
  };

  const handleDeleteMessage = (msgId, createdAt) => {
    const messageAgeMs = Date.now() - new Date(createdAt).getTime();
    if (messageAgeMs > 10 * 60 * 1000) {
      Alert.alert('Cannot Delete', '10 minutes have passed. This message can no longer be deleted.');
      return;
    }

    setConfirmDeleteMsgId(msgId);
  };

  const getMediaUrl = (attachment) => {
    if (!attachment) return null;
    if (attachment.startsWith('file://') || attachment.startsWith('http')) return attachment;
    return `${serverBaseUrl}/api/chat/media/${encodeURIComponent(attachment)}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={contact?.name || 'Chat'}
        subtitle={contact?.isGroup ? `${contact.memberIds?.length || 0} members` : undefined}
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={orderedMessages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => { if (!browsingHistory.current) flatListRef.current?.scrollToEnd({ animated: true }); }}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={hasOlder ? <TouchableOpacity disabled={loadingOlder} onPress={loadOlder} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: colors.primary }}>{loadingOlder ? 'Loading...' : 'Load older messages'}</Text></TouchableOpacity> : null}
        renderItem={({ item, index }) => {
          const startsDay = index === 0 || chatDayKey(item.createdAt) !== chatDayKey(orderedMessages[index - 1].createdAt);
          const isMe = item.senderId === user?.id;
          const isWithin10Min = (Date.now() - new Date(item.createdAt).getTime()) <= 10 * 60 * 1000;
          const canDelete = (isMe || user?.role === 'super_admin') && isWithin10Min;
          const isImage = isImageFile(item.attachmentName || item.attachment);

          return (
            <View>
              {startsDay && <View style={{ alignItems: 'center', marginVertical: 14 }}>
                <Text accessibilityRole="header" style={{ color: colors.textSecondary, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{chatDayLabel(item.createdAt)}</Text>
              </View>}
            <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
              {/* Outside Delete Button for Sent Messages (within 10 mins) */}
              {isMe && canDelete && (
                <TouchableOpacity
                  style={[styles.outsideDeleteBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleDeleteMessage(item.id, item.createdAt)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color="#ef4444" />
                </TouchableOpacity>
              )}

              {/* Chat Bubble */}
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => {
                  if (canDelete) handleDeleteMessage(item.id, item.createdAt);
                }}
                style={[
                  styles.bubble,
                  isMe
                    ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                    : [styles.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }]
                ]}
              >
                {/* Group Sender Name */}
                {contact?.isGroup && !isMe ? (
                  <Text style={[styles.senderName, { color: colors.primary }]}>
                    {item.senderName || 'Team Member'}
                  </Text>
                ) : null}

                {/* Inline Image Display (WhatsApp style) */}
                {item.attachment && isImage ? (
                  <TouchableOpacity
                    onPress={() => setPreviewImage({
                      uri: getMediaUrl(item.attachment),
                      name: item.attachmentName || 'Photo'
                    })}
                    activeOpacity={0.9}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: getMediaUrl(item.attachment), headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }}
                      style={styles.inlineImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : null}

                {/* Document Card (PDF, Word, PPT, Excel, Zip) with Download */}
                {item.attachment && !isImage ? (
                  <TouchableOpacity
                    style={[styles.docCard, { backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : colors.cardSecondary }]}
                    onPress={() => handleDownloadAttachment(item.attachment, item.attachmentName)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.docBadge, { backgroundColor: getFileMeta(item.attachmentName || item.attachment).color }]}>
                      <Text style={styles.docBadgeText}>
                        {getFileMeta(item.attachmentName || item.attachment).badge}
                      </Text>
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={[styles.docName, { color: isMe ? '#ffffff' : colors.text }]} numberOfLines={1}>
                        {item.attachmentName || item.attachment}
                      </Text>
                      <Text style={[styles.docSub, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                        Tap to download
                      </Text>
                    </View>
                    <Download size={16} color={isMe ? '#ffffff' : colors.primary} />
                  </TouchableOpacity>
                ) : null}

                {/* Message Text (Hide if default attachment text) */}
                {item.message && !item.message.startsWith('Sent attachment:') ? (
                  <Text style={[styles.messageText, { color: isMe ? '#ffffff' : colors.text }]}>
                    {item.message}
                  </Text>
                ) : null}

                {/* Message Footer: Timestamp and ticks */}
                <View style={styles.bubbleFooter}>
                  <Text accessibilityLabel={chatTimestamp(item.createdAt)} style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>
                    {chatTime(item.createdAt)}
                  </Text>
                  {isMe ? (
                    item.read ? (
                      <CheckCheck size={14} color="#93c5fd" />
                    ) : (
                      <Check size={14} color="rgba(255,255,255,0.7)" />
                    )
                  ) : null}
                </View>
              </TouchableOpacity>

              {/* Outside Delete Button for Super Admin on Received Messages */}
              {!isMe && canDelete && (
                <TouchableOpacity
                  style={[styles.outsideDeleteBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleDeleteMessage(item.id, item.createdAt)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
            </View>
          );
        }}
      />

      {/* Floating Emoji Bar */}
      {showEmojiPicker && (
        <View style={[styles.emojiBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EMOJIS.map((emoji, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.emojiBtn}
                onPress={() => {
                  setInputText(prev => prev + emoji);
                }}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: inputBottomPadding,
            marginBottom: effectiveKeyboardOffset,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.inputActionBtn}
          onPress={() => {
            if (!showEmojiPicker) {
              Keyboard.dismiss();
              setKeyboardHeight(0);
            }
            setShowEmojiPicker((prev) => !prev);
          }}
        >
          <Smile size={22} color={showEmojiPicker ? colors.primary : colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inputActionBtn}
          onPress={() => setShowAttachmentMenu(true)}
        >
          <Paperclip size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          style={[styles.inputField, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          onFocus={() => {
            setIsKeyboardVisible(true);
            setShowEmojiPicker(false);
            if (keyboardHeight === 0 && lastKeyboardHeight.current > 0) {
              setKeyboardHeight(lastKeyboardHeight.current);
            }
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 80);
          }}
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={() => handleSendMessage()}
          disabled={sending || !inputText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Send size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Attachment Options Modal */}
      <Modal visible={showAttachmentMenu} transparent animationType="fade" onRequestClose={() => setShowAttachmentMenu(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAttachmentMenu(false)}>
          <View style={[styles.attachmentMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <ImageIcon size={22} color="#6366f1" />
              </View>
              <Text style={[styles.optionText, { color: colors.text }]}>Photo Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={handlePickDocument}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <FileText size={22} color="#ef4444" />
              </View>
              <Text style={[styles.optionText, { color: colors.text }]}>Document / PDF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Lightbox Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.lightboxOverlay}>
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxTitle} numberOfLines={1}>{previewImage?.name}</Text>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setPreviewImage(null)}>
              <X size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {previewImage ? (
            <Image
              source={{ uri: previewImage.uri, headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      <ConfirmDeleteModal
        visible={Boolean(confirmDeleteMsgId)}
        onClose={() => setConfirmDeleteMsgId(null)}
        title="Delete Message"
        message="Are you sure you want to delete this message for all participants? This action cannot be undone."
        confirmText="Delete for Everyone"
        loading={isDeleting}
        onConfirm={async () => {
          if (!confirmDeleteMsgId) return;
          setIsDeleting(true);
          try {
            await apiDelete(`/chat/messages/${confirmDeleteMsgId}`);
            setMessages(prev => prev.filter(m => m.id !== confirmDeleteMsgId));
            setConfirmDeleteMsgId(null);
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not delete message');
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  outsideDeleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 10,
    paddingBottom: 6,
  },
  bubbleMe: {
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  imageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  inlineImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 4,
    minWidth: 180,
  },
  docBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
  },
  docSub: {
    fontSize: 10,
    marginTop: 1,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  emojiBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  emojiBtn: {
    paddingHorizontal: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  inputActionBtn: {
    padding: 6,
  },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 70,
  },
  attachmentMenu: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    gap: 8,
  },
  optionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lightboxHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  lightboxTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  lightboxCloseBtn: {
    padding: 6,
  },
  lightboxImage: {
    width: '100%',
    height: '75%',
  }
});
