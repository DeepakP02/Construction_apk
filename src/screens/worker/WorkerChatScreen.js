import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Platform, ActivityIndicator, Dimensions, Alert, Keyboard, Modal, ScrollView, Pressable, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';
import { useKeyboardOverlap } from '../../utils/useKeyboardOverlap';

const { width } = Dimensions.get('window');

const WorkerChatScreen = ({ navigation, route }) => {
    const { room } = route.params || {};
    const { user, messagesByRoom, setMessagesByRoom, sendMessage, fetchMessages, ensureDirectChatRoom, uploadFile, socketRef } = useApp();
    const [msgText, setMsgText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    /** Real ChatRoom id for DMs (route only has peer user id). */
    const [dmRoomId, setDmRoomId] = useState(null);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();
    // Track the resolved room id for socket subscriptions
    const resolvedRoomIdRef = useRef(null);
    const insets = useSafeAreaInsets();
    const keyboardOverlap = useKeyboardOverlap(insets.bottom);
    const composerBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);
    const messageListBottomPadding = 20 + keyboardOverlap;

    // Resolve the actual ChatRoom id and load initial messages
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!room?.id) return;

            try {
                let fetchId = room.id;
                if (room.type === 'private') {
                    const rid = await ensureDirectChatRoom(room.id);
                    if (!cancelled && rid) {
                        setDmRoomId(rid);
                        fetchId = rid;
                    } else if (!cancelled) {
                        setDmRoomId(null);
                    }
                } else {
                    setDmRoomId(null);
                }
                resolvedRoomIdRef.current = fetchId;

                const hasCache = messagesByRoom[fetchId] && messagesByRoom[fetchId].length > 0;
                if (!hasCache && !cancelled) {
                    setLoading(true);
                }

                if (!cancelled) {
                    await fetchMessages(fetchId);
                    // Join socket room immediately
                    const socket = socketRef?.current;
                    if (socket?.connected && fetchId) {
                        socket.emit('join_room', String(fetchId));
                    }
                    // Mark as read
                    api.put(`/chat/mark-read/${fetchId}`).catch(() => {});
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [room?.id, room?.type, user?._id]);

    // ── REAL-TIME: Subscribe to socket new_message events directly ──────────────
    useEffect(() => {
        const socket = socketRef?.current;
        if (!socket) return;

        const handleNewMessage = (incoming) => {
            if (!incoming) return;
            const incomingRoomId = String(incoming.roomId?._id || incoming.roomId || '');
            const resolved = resolvedRoomIdRef.current;
            // Only handle messages for the room we're currently in
            if (!resolved || incomingRoomId !== String(resolved)) return;

            // The context already deduplicates and adds to messages[], 
            // so we just need to scroll to bottom and mark as read
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            api.put(`/chat/mark-read/${resolved}`).catch(() => {});
        };

        socket.on('new_message', handleNewMessage);

        // Re-join room on socket reconnect
        const handleReconnect = () => {
            const rid = resolvedRoomIdRef.current;
            if (rid && socket.connected) {
                socket.emit('join_room', String(rid));
            }
        };
        socket.on('connect', handleReconnect);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('connect', handleReconnect);
        };
    }, [socketRef?.current]);

    // ── FALLBACK: 5-second polling while screen is focused (only runs if socket is disconnected) ─────────────────────
    useFocusEffect(
        useCallback(() => {
            let timer = null;
            const refreshActiveRoom = async () => {
                const socket = socketRef?.current;
                // Only poll if socket is NOT connected
                if (!socket || !socket.connected) {
                    console.log('[WorkerChatScreen] Socket inactive. Running HTTP sync fallback...');
                    const fetchId = resolvedRoomIdRef.current;
                    if (!fetchId) return;
                    await fetchMessages(fetchId);
                }
            };

            const initLoad = async () => {
                const fetchId = resolvedRoomIdRef.current;
                if (fetchId) await fetchMessages(fetchId);
            };
            initLoad();

            timer = setInterval(refreshActiveRoom, 5000);

            return () => {
                if (timer) clearInterval(timer);
            };
        }, [fetchMessages, socketRef])
    );

    const peerId = room?.id?.toString();
    const myId = user?._id?.toString();

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            flatListRef.current?.scrollToEnd({ animated: true });
        });
        return () => showSubscription.remove();
    }, []);

    const roomMessages = useMemo(() => {
        const activeKey = room?.type === 'private' ? dmRoomId : room?.id;
        if (!activeKey) return [];
        
        const rawList = messagesByRoom[activeKey] || [];
        return [...rawList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [messagesByRoom, dmRoomId, room?.id, room?.type]);

    const effectiveRoomId = room?.type === 'private' ? (dmRoomId || null) : (room?.id || null);

    const handleSend = async () => {
        if (!msgText.trim()) return;
        const textToSend = msgText;
        setMsgText('');
        setSending(true);
        try {
            let resolvedDmRoomId = dmRoomId;
            if (room.type === 'private' && !dmRoomId) {
                const rid = await ensureDirectChatRoom(room.id);
                if (rid) {
                    resolvedDmRoomId = rid;
                    setDmRoomId(rid);
                }
            }
            // Pass correct params: sendMessage(text, projectId, receiverId, roomId)
            const sendPromise = room.type === 'private'
                ? sendMessage(textToSend, null, resolvedDmRoomId ? null : room.id, resolvedDmRoomId || room.id)
                : sendMessage(textToSend, room.projectId || null, null, room.id);

            // Do not block input on network RTT; optimistic message is already inserted in context.
            setSending(false);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
            const success = await sendPromise;

            if (success) {
                setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
            } else {
                setMsgText(textToSend);
                Alert.alert('Error', 'Message could not be sent. Check your connection and permissions.');
            }
        } catch (err) {
            setMsgText(textToSend);
            Alert.alert("Error", "Message could not be sent.");
        } finally {
            setSending(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'We need access to your gallery to send photos.');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.4, // Lower quality for faster upload
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                sendImageMessage(asset.uri);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open gallery');
        }
    };

    const handleTakePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'We need camera access to take photos.');
                return;
            }

            let result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.4, // Lower quality for faster upload
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                sendImageMessage(asset.uri);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open camera');
        }
    };

    const sendImageMessage = async (uri) => {
        try {
            let resolvedDmRoomId = dmRoomId;
            if (room.type === 'private' && !dmRoomId) {
                const rid = await ensureDirectChatRoom(room.id);
                if (rid) {
                    resolvedDmRoomId = rid;
                    setDmRoomId(rid);
                }
            }
            const targetKey = resolvedDmRoomId || room.id;

            // Immediately send the message with a placeholder attachment containing isPending: true
            const placeholderAttachment = {
                url: uri,
                name: uri.split('/').pop(),
                fileType: 'image/jpeg',
                isPending: true
            };

            const placeholderMsg = room.type === 'private'
                ? await sendMessage("[Photo Attachment]", null, resolvedDmRoomId ? null : room.id, resolvedDmRoomId || room.id, [placeholderAttachment])
                : await sendMessage("[Photo Attachment]", room.projectId || null, null, room.id, [placeholderAttachment]);

            if (!placeholderMsg) {
                Alert.alert('Error', 'Could not send the photo placeholder.');
                return;
            }
            console.log('[IMAGE SEND] placeholderMsg._id:', placeholderMsg._id, 'id:', placeholderMsg.id);

            // Scroll to end immediately
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

            // Upload the file in the background (non-blocking for UI)
            const uploadAndResolve = async () => {
                try {
                    // Use the dedicated chat upload endpoint (/chat/upload)
                    // which stores to ImageKit and returns [{ name, url, fileType }]
                    const rawName = uri.split('/').pop() || '';
                    // Detect mime type from uri or asset - camera on Android often returns content:// or raw paths
                    const isGif = uri.toLowerCase().includes('.gif');
                    const isPng = uri.toLowerCase().includes('.png');
                    const ext = isGif ? '.gif' : isPng ? '.png' : '.jpg';
                    const mimeType = isGif ? 'image/gif' : isPng ? 'image/png' : 'image/jpeg';
                    // Ensure filename always has a proper extension (camera URIs often have no extension)
                    const hasExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(rawName);
                    const fileName = hasExt ? rawName : `photo_${Date.now()}${ext}`;
                    
                    const formData = new FormData();
                    formData.append('files', {
                        uri: uri,
                        name: fileName,
                        type: mimeType
                    });

                    const uploadRes = await uploadMultipart('/chat/upload', formData).catch(e => {
                        console.error('[UPLOAD STEP] /chat/upload failed:', e?.response?.status, e?.response?.data || e?.message);
                        throw e;
                    });

                    const uploadedFile = Array.isArray(uploadRes.data) ? uploadRes.data[0] : uploadRes.data;
                    const cloudUrl = uploadedFile?.url;

                    if (!cloudUrl) throw new Error('No URL returned from upload');

                    const attachment = {
                        url: cloudUrl,
                        name: uploadedFile?.name || fileName,
                        fileType: uploadedFile?.fileType || 'image/jpeg',
                        isPending: false
                    };

                    // Patch the message attachments on the backend
                    const msgId = placeholderMsg._id || placeholderMsg.id;
                    console.log('[PATCH STEP] Patching msgId:', msgId, 'attachment url:', cloudUrl);
                    await api.patch(`/chat/${msgId}/attachments`, {
                        attachments: [attachment]
                    }).catch(e => {
                        console.error('[PATCH STEP] /chat/:id/attachments failed:', e?.response?.status, e?.response?.data || e?.message, 'msgId:', msgId);
                        throw e;
                    });

                    // Update the local messages in this room to replace placeholder with final image URL
                    setMessagesByRoom(prev => {
                        const roomMsgs = prev[targetKey] || [];
                        return {
                            ...prev,
                            [targetKey]: roomMsgs.map(m => {
                                if (String(m._id || m.id) === String(msgId)) {
                                    return {
                                        ...m,
                                        attachments: [attachment]
                                    };
                                }
                                return m;
                            })
                        };
                    });
                } catch (err) {
                    console.error('Background upload/resolve failed:', err);
                    const msgId = placeholderMsg._id || placeholderMsg.id;
                    // Update local state to show failed
                    setMessagesByRoom(prev => {
                        const roomMsgs = prev[targetKey] || [];
                        return {
                            ...prev,
                            [targetKey]: roomMsgs.map(m => {
                                if (String(m._id || m.id) === String(msgId)) {
                                    return {
                                        ...m,
                                        attachments: m.attachments.map(a => ({ ...a, isPending: false, failed: true }))
                                    };
                                }
                                return m;
                            })
                        };
                    });
                    // Also PATCH the backend so the web knows the upload failed (isPending → false)
                    // This stops the web spinner from spinning forever
                    try {
                        const failedAttachments = (placeholderMsg.attachments || []).map(a => ({
                            ...a,
                            isPending: false,
                            failed: true
                        }));
                        await api.patch(`/chat/${msgId}/attachments`, { attachments: failedAttachments });
                    } catch (patchErr) {
                        console.warn('Could not update failed status on backend:', patchErr.message);
                    }
                }
            };

            // Execute upload in the background
            uploadAndResolve();
        } catch (err) {
            Alert.alert("Upload Error", "Failed to upload image. Please try again.");
        }
    };

    const renderMessage = useCallback(({ item, index }) => {
        const itemSenderId = (item.sender?._id || item.sender || item.senderId)?.toString();
        const isMe = itemSenderId === user?._id?.toString() || item.isMe;
        const senderName = item.sender?.fullName || item.senderName || item.sender || 'User';

        return (
            <View style={[styles.messageRow, isMe ? styles.sentRow : styles.receivedRow]}>
                <View style={[styles.bubble, isMe ? styles.sentBubble : styles.receivedBubble]}>
                    {!isMe && <Text style={styles.senderHeader}>{senderName}</Text>}
                    
                    {item.attachments && item.attachments.length > 0 && (
                        <View style={styles.attachmentContainer}>
                            {item.attachments.map((att, i) => {
                                const rawUrl = typeof att === 'string' ? att : (att?.url || att?.imageUrl || att?.uri || '');
                                console.log('--- RENDERING ATTACHMENT ---', att, '->', rawUrl);
                                const resolvedUri = rawUrl ? getServerUrl(rawUrl) : '';
                                if (!resolvedUri) {
                                    // Upload pending or URL missing — show a placeholder
                                    return (
                                        <View key={i} style={[styles.attachmentImage, styles.attachmentPlaceholder]}>
                                            <ActivityIndicator color="#90CAF9" size="small" />
                                        </View>
                                    );
                                }
                                return (
                                    <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setViewerUri(resolvedUri)}>
                                        <View style={{ position: 'relative' }}>
                                            <Image
                                                source={{ uri: resolvedUri }}
                                                style={styles.attachmentImage}
                                                resizeMode="cover"
                                                onError={(e) => console.warn('Image load error:', resolvedUri, e.nativeEvent.error)}
                                            />
                                            {att.isPending && (
                                                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }]}>
                                                    <ActivityIndicator size="small" color="#ffffff" />
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {(item.message && item.message !== "[Photo Attachment]") ? (
                        <Text style={[styles.messageText, isMe ? styles.sentText : styles.receivedText]}>
                            {item.message}
                        </Text>
                    ) : null}
                    <Text style={[styles.timeText, isMe ? styles.sentTime : styles.receivedTime]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    }, [user?._id]);

    const keyExtractor = useCallback((item, index) => item._id || item.id || index.toString(), []);

    return (
        <View style={styles.container}>
            <AppHeader title={room?.name || 'Discussion Room'} showBack showRight={false} showLogo={true} />

            <View style={styles.chatBody}>
                <FlatList
                    ref={flatListRef}
                    data={roomMessages}
                    keyExtractor={keyExtractor}
                    style={styles.messages}
                    contentContainerStyle={[styles.messageList, { paddingBottom: messageListBottomPadding }]}
                    renderItem={renderMessage}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={20}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={Platform.OS === 'android'}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                />

                <View
                    style={[
                        styles.footerContainer,
                        {
                            paddingBottom: composerBottomPadding,
                            transform: [{ translateY: -keyboardOverlap }],
                        },
                    ]}
                >
                    <View style={[styles.whatsAppInputLine, SHADOWS.small]}>
                        <TextInput
                            style={styles.inputField}
                            placeholder="Message"
                            placeholderTextColor="#5F6368"
                            value={msgText}
                            onChangeText={setMsgText}
                            multiline
                        />

                        <View style={styles.rightActions}>
                            <TouchableOpacity style={styles.sideBtn} onPress={handlePickImage}>
                                <MaterialCommunityIcons name="paperclip" size={24} color="#5F6368" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sideBtn} onPress={handleTakePhoto} >
                                <MaterialCommunityIcons name="camera" size={24} color="#5F6368" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {msgText.trim() && (
                        <TouchableOpacity 
                            style={styles.sendFab} 
                            onPress={handleSend}
                            disabled={sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <MaterialCommunityIcons name="send" size={24} color="#fff" />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
                <View style={styles.viewerBackdrop}>
                    <StatusBar barStyle="light-content" backgroundColor="#000" />
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.viewerScroll}
                        maximumZoomScale={4}
                        minimumZoomScale={1}
                        centerContent
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                    >
                        <Pressable onPress={() => setViewerUri(null)}>
                            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
                        </Pressable>
                    </ScrollView>
                    <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    chatBody: { flex: 1, minHeight: 0, overflow: 'visible' },
    messages: { flex: 1 },
    messageList: { padding: SPACING.m },
    messageRow: { marginBottom: SPACING.m, width: '100%' },
    sentRow: { alignItems: 'flex-end' },
    receivedRow: { alignItems: 'flex-start' },
    bubble: {
        maxWidth: '82%',
        padding: 12,
        borderRadius: SIZES.radiusCard,
        ...SHADOWS.small,
    },
    sentBubble: {
        backgroundColor: '#E0F2FE',
        borderBottomRightRadius: 4,
    },
    receivedBubble: {
        backgroundColor: COLORS.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    senderHeader: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
    messageText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
    sentText: { color: COLORS.textPrimary },
    receivedText: { color: COLORS.textPrimary },
    timeText: { fontSize: 10, marginTop: 4, opacity: 0.7, fontWeight: '600' },
    sentTime: { color: COLORS.textSecondary, textAlign: 'right' },
    receivedTime: { color: COLORS.textMuted },
    timeMuted: { color: '#999' },

    attachmentContainer: { marginBottom: 6, borderRadius: 8, overflow: 'hidden' },
    attachmentImage: { width: width * 0.6, height: width * 0.6, borderRadius: 8 },
    attachmentPlaceholder: { backgroundColor: '#E8F4FD', justifyContent: 'center', alignItems: 'center' },
    viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    viewerScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    viewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
    viewerClose: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },

    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
        backgroundColor: COLORS.background
    },
    whatsAppInputLine: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        flex: 1,
        marginRight: 10,
    },
    sideBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    inputField: {
        flex: 1,
        fontSize: 16,
        color: '#111',
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    rightActions: { flexDirection: 'row', alignItems: 'center' },
    sendFab: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#075E54',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        elevation: 2,
    }
});

export default WorkerChatScreen;
