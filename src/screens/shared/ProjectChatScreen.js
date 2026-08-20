import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Platform, ActivityIndicator, Image, Alert, Keyboard, Dimensions, Modal, ScrollView, Pressable, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import AppHeader from '../../components/AppHeader';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';
import { useKeyboardOverlap } from '../../utils/useKeyboardOverlap';

const ProjectChatScreen = ({ route }) => {
    const { project } = route.params;
    const { messagesByRoom, setMessagesByRoom, sendMessage, fetchMessages, ensureDirectChatRoom, user, uploadFile } = useApp();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [dmRoomId, setDmRoomId] = useState(null);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();
    const insets = useSafeAreaInsets();
    const keyboardOverlap = useKeyboardOverlap(insets.bottom);
    const composerBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);
    const messageListBottomPadding = 20 + keyboardOverlap;

    const targetId = (project._id || project.id)?.toString();
    const clientUserId = (project.clientId || project.client?.id || project.client?._id)?.toString();
    const peerId = clientUserId || targetId;
    const isGeneral = targetId === 'GENERAL_COMPANY';
    const isPrivate = project.isPrivate || project.type === 'private';
    const myId = user?._id?.toString();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                let fetchId = targetId;
                if (isPrivate) {
                    const rid = await ensureDirectChatRoom(peerId);
                    if (!cancelled && rid) {
                        setDmRoomId(rid);
                        fetchId = rid;
                    } else if (!cancelled) setDmRoomId(null);
                } else {
                    setDmRoomId(null);
                }

                const hasCache = messagesByRoom[fetchId] && messagesByRoom[fetchId].length > 0;
                if (!hasCache && !cancelled) {
                    setLoading(true);
                }

                if (!cancelled) await fetchMessages(fetchId);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [targetId, isPrivate]);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            flatListRef.current?.scrollToEnd({ animated: true });
        });
        return () => showSubscription.remove();
    }, []);

    const chatMessages = useMemo(() => {
        const activeKey = isPrivate ? dmRoomId : targetId;
        if (!activeKey) return [];
        
        const rawList = messagesByRoom[activeKey] || [];
        return [...rawList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [messagesByRoom, dmRoomId, targetId, isPrivate]);

    const handleSend = async () => {
        if (!text.trim()) return;
        const textToSend = text;
        setText(''); // Clear input textbox immediately
        setSending(true);
        try {
            let resolvedDmRoomId = dmRoomId;
            if (isPrivate && !dmRoomId) {
                const rid = await ensureDirectChatRoom(peerId);
                if (rid) {
                    resolvedDmRoomId = rid;
                    setDmRoomId(rid);
                }
            }
            const sendPromise = isPrivate
                ? sendMessage(textToSend, null, resolvedDmRoomId ? null : peerId, resolvedDmRoomId || peerId)
                : sendMessage(textToSend, targetId);

            setSending(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

            const success = await sendPromise;
            if (!success) {
                setText(textToSend); // Restore input text if sending failed
                Alert.alert('Error', 'Message failed to send. Please check your connection.');
            }
        } catch (err) {
            setText(textToSend);
            Alert.alert('Error', 'An error occurred while sending message.');
        } finally {
            setSending(false);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            sendImageMessage(asset.uri);
        }
    };

    const handleTakePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;

            let result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.7,
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
            if (isPrivate && !dmRoomId) {
                const rid = await ensureDirectChatRoom(peerId);
                if (rid) {
                    resolvedDmRoomId = rid;
                    setDmRoomId(rid);
                }
            }
            const targetKey = isPrivate ? (resolvedDmRoomId || peerId) : targetId;

            // Immediately send the message with a placeholder attachment containing isPending: true
            const placeholderAttachment = {
                url: uri,
                name: uri.split('/').pop(),
                fileType: 'image/jpeg',
                isPending: true
            };

            const placeholderMsg = isPrivate
                ? await sendMessage("[Photo Attachment]", null, resolvedDmRoomId ? null : peerId, resolvedDmRoomId || peerId, [placeholderAttachment])
                : await sendMessage("[Photo Attachment]", targetId, null, targetId, [placeholderAttachment]);

            if (!placeholderMsg) {
                Alert.alert('Error', 'Could not send the photo placeholder.');
                return;
            }

            // Scroll to end immediately
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

            // Upload the file in the background (non-blocking for UI)
            const uploadAndResolve = async () => {
                try {
                    // Use the dedicated chat upload endpoint (/chat/upload)
                    // which stores to ImageKit and returns [{ name, url, fileType }]
                    const rawName = uri.split('/').pop() || '';
                    // Detect mime type from uri - camera on Android often returns content:// or raw paths with no extension
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
                    // Update local state
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
                    // PATCH backend so web stops spinning and shows "Upload Failed"
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
            Alert.alert("Upload Error", "Failed to upload image.");
        }
    };

    const renderMessage = useCallback(({ item }) => {
        const itemSenderId = (item.sender?._id || item.sender || item.senderId)?.toString();
        const isMe = itemSenderId === user?._id?.toString() || item.isMe;
        const senderName = item.sender?.fullName || (typeof item.sender === 'string' ? item.sender : '') || 'User';
        const senderInitial = senderName.charAt(0).toUpperCase();

        return (
            <View style={[styles.messageWrapper, isMe ? styles.myMessage : styles.theirMessage]}>
                {!isMe && <View style={styles.avatarMain}><Text style={styles.avatarText}>{senderInitial}</Text></View>}
                <View style={{ flex: 1 }}>
                    {!isMe && <Text style={styles.senderNameText}>{senderName}</Text>}
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                        {item.attachments && item.attachments.length > 0 && (
                            <View style={styles.attachmentContainer}>
                                {item.attachments.map((att, i) => {
                                    const rawUrl = typeof att === 'string' ? att : (att?.url || att?.imageUrl || att?.uri || '');
                                    console.log('--- RENDERING ATTACHMENT ---', att, '->', rawUrl);
                                    const resolvedUri = rawUrl ? getServerUrl(rawUrl) : '';
                                    if (!resolvedUri) {
                                        return (
                                            <View key={i} style={[styles.attachmentImage, { backgroundColor: '#E8F4FD', justifyContent: 'center', alignItems: 'center' }]}>
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
                            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.message}</Text>
                        ) : null}
                        <Text style={[styles.time, isMe ? styles.myTime : styles.theirTime]}>
                            {item.time || new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }, [user?._id]);

    const keyExtractor = useCallback((item, index) => item._id || item.id || index.toString(), []);

    return (
        <View style={styles.container}>
            <AppHeader title={(project.fullName || project.name)} showBack showRight={false} showLogo={true} />

            <View style={styles.chatBody}>
                <FlatList
                    ref={flatListRef}
                    data={chatMessages}
                    keyExtractor={keyExtractor}
                    style={styles.messages}
                    contentContainerStyle={[styles.list, { paddingBottom: messageListBottomPadding }]}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderMessage}
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
                        <TextInput style={styles.mainInputField} placeholder="Message" placeholderTextColor="#5F6368" value={text} onChangeText={setText} multiline />
                        <View style={styles.rightActions}>
                            <TouchableOpacity style={styles.sideIconBtn} onPress={handlePickImage}><MaterialCommunityIcons name="paperclip" size={24} color="#5F6368" /></TouchableOpacity>
                            <TouchableOpacity style={styles.sideIconBtn} onPress={handleTakePhoto}><MaterialCommunityIcons name="camera" size={24} color="#5F6368" /></TouchableOpacity>
                        </View>
                    </View>
                    {text.trim() && (
                        <TouchableOpacity style={styles.sendFab} onPress={handleSend} disabled={sending}>
                            {sending ? <ActivityIndicator color="#fff" size="small" /> : <MaterialCommunityIcons name="send" size={24} color="#fff" />}
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
    list: { padding: SPACING.m },
    messageWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%', gap: SPACING.s },
    myMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    theirMessage: { alignSelf: 'flex-start' },
    avatarMain: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small, borderWidth: 1, borderColor: COLORS.border },
    avatarText: { fontSize: 13, fontWeight: '900', color: COLORS.primaryAccent },
    senderNameText: { fontSize: 10, fontWeight: '900', color: COLORS.primaryAccent, marginBottom: 4, marginLeft: 4, textTransform: 'uppercase' },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: SIZES.radiusCard, ...SHADOWS.small },
    myBubble: { backgroundColor: '#E0F2FE', borderBottomRightRadius: 4 },
    theirBubble: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
    messageText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
    myText: { color: COLORS.textPrimary },
    theirText: { color: COLORS.textPrimary },
    time: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, fontWeight: '600', opacity: 0.7 },
    myTime: { color: COLORS.textSecondary },
    theirTime: { color: COLORS.textMuted },
    attachmentContainer: { marginBottom: 6, borderRadius: SIZES.radiusBtn, overflow: 'hidden' },
    attachmentImage: { width: 220, height: 220, borderRadius: SIZES.radiusBtn },
    viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    viewerScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    viewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
    viewerClose: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingTop: 12,
        backgroundColor: COLORS.background
    },
    whatsAppInputLine: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 28, paddingHorizontal: SPACING.m, minHeight: 52, borderWidth: 1, borderColor: COLORS.border, marginRight: 10 },
    sideIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    mainInputField: { flex: 1, fontSize: 16, color: COLORS.textPrimary, paddingVertical: 10, fontWeight: '500' },
    rightActions: { flexDirection: 'row', alignItems: 'center' },
    sendFab: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryAccent, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium }
});

export default ProjectChatScreen;
