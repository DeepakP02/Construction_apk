import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Platform, ActivityIndicator, Dimensions, Alert, Keyboard, Modal, ScrollView, Pressable, StatusBar, KeyboardAvoidingView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';

const { width } = Dimensions.get('window');

const getRoleBadgeInfo = (role) => {
    switch (role) {
        case 'SUPER_ADMIN':
            return { label: 'SUPER ADMIN', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
        case 'COMPANY_OWNER':
        case 'ADMIN':
            return { label: 'ADMIN', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
        case 'PM':
            return { label: 'PROJECT MGR', bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' };
        case 'ENGINEER':
            return { label: 'ENGINEER', bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' };
        case 'FOREMAN':
            return { label: 'FOREMAN', bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' };
        case 'SUBCONTRACTOR':
            return { label: 'SUBCONTRACTOR', bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' };
        case 'WORKER':
            return { label: 'WORKER', bg: '#D1FAE5', text: '#047857', border: '#A7F3D0' };
        case 'CLIENT':
            return { label: 'CLIENT', bg: '#FFE4E6', text: '#BE123C', border: '#FECDD3' };
        default:
            return { label: role || 'USER', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
};

const WorkerChatScreen = ({ navigation, route }) => {
    const { room } = route.params || {};
    const isDirect = room?.type === 'private' || room?.roomType === 'DIRECT';
    const isArchived = Boolean(room?.isArchived || room?.readOnly);
    const roleBadge = isDirect && room?.otherUser?.role ? getRoleBadgeInfo(room.otherUser.role) : null;
    const { user, messagesByRoom, setMessagesByRoom, sendMessage, retryMessage, fetchMessages, uploadFile, socketRef } = useApp();
    const [msgText, setMsgText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();
    // Track the resolved room id for socket subscriptions
    const resolvedRoomIdRef = useRef(null);
    const insets = useSafeAreaInsets();
    const composerBottomPadding = Math.max(insets.bottom, 10);

    // Group participants state
    const [groupParticipants, setGroupParticipants] = useState(() => {
        if (!isDirect && Array.isArray(room?.participants) && room.participants.length > 0) {
            return room.participants;
        }
        return [];
    });
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');

    // Fetch group participants when opening a group channel with resilient fallback
    useEffect(() => {
        if (isDirect || !room?.id) {
            setGroupParticipants([]);
            setLoadingParticipants(false);
            return;
        }

        // Preload from room if available, otherwise clear stale state
        if (Array.isArray(room.participants) && room.participants.length > 0) {
            setGroupParticipants(room.participants);
        } else {
            setGroupParticipants([]);
        }

        let cancelled = false;
        const fetchParticipants = async () => {
            let fetched = false;
            try {
                setLoadingParticipants(true);
                const res = await api.get(`/chat/${room.id}/participants`);
                const list = res.data?.participants || (Array.isArray(res.data) ? res.data : []);
                if (!cancelled && Array.isArray(list) && list.length > 0) {
                    setGroupParticipants(list);
                    fetched = true;
                }
            } catch (err) {
                console.warn('[WorkerChatScreen] Primary participants endpoint failed, attempting fallback:', err?.message || err);
            }

            // Fallback: If primary failed or empty, try project members & project details
            if (!fetched) {
                const pid = (room?.projectId?._id || room?.projectId || (room?.roomType === 'PROJECT_GROUP' ? room.id : null))?.toString();
                if (pid) {
                    try {
                        const [membersRes, projectRes] = await Promise.allSettled([
                            api.get(`/projects/${pid}/members`),
                            api.get(`/projects/${pid}`)
                        ]);

                        const membersList = membersRes.status === 'fulfilled' && Array.isArray(membersRes.value.data)
                            ? membersRes.value.data
                            : [];
                        const projectData = projectRes.status === 'fulfilled' ? projectRes.value.data : null;

                        const userMap = new Map();

                        if (projectData?.clientId) {
                            const c = projectData.clientId;
                            const cId = (c._id || c)?.toString();
                            if (cId) {
                                userMap.set(cId, {
                                    id: cId,
                                    participantId: cId,
                                    userId: cId,
                                    fullName: c.fullName || 'Client',
                                    role: 'CLIENT',
                                    avatar: c.avatar || null,
                                    email: c.email || null,
                                    isOnline: false
                                });
                            }
                        }

                        membersList.forEach(m => {
                            if (m && m._id) {
                                const mId = m._id.toString();
                                userMap.set(mId, {
                                    id: mId,
                                    participantId: mId,
                                    userId: mId,
                                    fullName: m.fullName || 'User',
                                    role: m.role || 'MEMBER',
                                    avatar: m.avatar || null,
                                    email: m.email || null,
                                    isOnline: false
                                });
                            }
                        });

                        const fallbackList = Array.from(userMap.values());
                        if (!cancelled && fallbackList.length > 0) {
                            setGroupParticipants(fallbackList);
                        }
                    } catch (fallbackErr) {
                        console.warn('[WorkerChatScreen] Fallback participant loading failed:', fallbackErr?.message || fallbackErr);
                    }
                }
            }

            if (!cancelled) {
                setLoadingParticipants(false);
            }
        };

        fetchParticipants();
        return () => {
            cancelled = true;
        };
    }, [room?.id, room?.projectId, isDirect]);

    const filteredParticipants = useMemo(() => {
        if (!participantSearch.trim()) return groupParticipants;
        const query = participantSearch.toLowerCase();
        return groupParticipants.filter(p => 
            p.fullName?.toLowerCase().includes(query) ||
            p.role?.toLowerCase().includes(query) ||
            p.email?.toLowerCase().includes(query)
        );
    }, [groupParticipants, participantSearch]);

    // Load initial messages for the project chat room
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!room?.id) return;

            try {
                const fetchId = room.id;
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
    }, [room?.id, user?._id]);

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
        const activeKey = room?.id;
        if (!activeKey) return [];
        
        const rawList = messagesByRoom[activeKey] || [];
        return [...rawList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [messagesByRoom, room?.id]);

    const effectiveRoomId = room?.id || null;

    const handleSend = async () => {
        if (isArchived) {
            Alert.alert('Read-Only', 'This conversation is archived and cannot receive new messages.');
            return;
        }
        if (!msgText.trim()) return;
        const textToSend = msgText.trim();
        setMsgText('');
        try {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
            await sendMessage(textToSend, room?.projectId || null, null, room?.id);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
        } catch (err) {
            console.error('[WorkerChatScreen handleSend error]', err);
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
            const targetKey = room.id;

            // Immediately send the message with a placeholder attachment containing isPending: true
            const placeholderAttachment = {
                url: uri,
                name: uri.split('/').pop(),
                fileType: 'image/jpeg',
                isPending: true
            };

            const placeholderMsg = await sendMessage("[Photo Attachment]", room.projectId || null, null, room.id, [placeholderAttachment]);

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
                    const isGif = uri.toLowerCase().includes('.gif');
                    const isPng = uri.toLowerCase().includes('.png');
                    const ext = isGif ? '.gif' : isPng ? '.png' : '.jpg';
                    const mimeType = isGif ? 'image/gif' : isPng ? 'image/png' : 'image/jpeg';
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
                                const resolvedUri = rawUrl ? getServerUrl(rawUrl) : '';
                                if (!resolvedUri) {
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                        <Text style={[styles.timeText, isMe ? styles.sentTime : styles.receivedTime, { marginRight: 4 }]}>
                            {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && (
                            item.pending ? (
                                <ActivityIndicator size="small" color="#90CAF9" style={{ width: 10, height: 10 }} />
                            ) : item.failed ? (
                                <TouchableOpacity onPress={() => retryMessage && retryMessage(item)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <MaterialCommunityIcons name="refresh" size={12} color="#DC2626" />
                                    <Text style={{ fontSize: 9, color: '#DC2626', fontWeight: '800', marginLeft: 2 }}>Retry</Text>
                                </TouchableOpacity>
                            ) : (
                                <MaterialCommunityIcons name="check" size={12} color="#90CAF9" />
                            )
                        )}
                    </View>
                </View>
            </View>
        );
    }, [user?._id, retryMessage]);

    const keyExtractor = useCallback((item, index) => item._id || item.id || index.toString(), []);

    return (
        <View style={styles.container}>
            <AppHeader title={room?.name || 'Discussion Room'} showBack showRight={false} showLogo={true} />

            {isDirect && (
                <View style={styles.directSubHeader}>
                    <View style={styles.directPeerInfo}>
                        <View style={[styles.directPeerDot, { backgroundColor: room?.otherUser?.isOnline ? '#10B981' : '#94A3B8' }]} />
                        <Text style={styles.directPeerName} numberOfLines={1}>
                            {room?.otherUser?.fullName || room?.name}
                        </Text>
                        {roleBadge && (
                            <View style={[styles.directRoleChip, { backgroundColor: roleBadge.bg, borderColor: roleBadge.border }]}>
                                <Text style={[styles.directRoleText, { color: roleBadge.text }]}>{roleBadge.label}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.directFrequencyText} numberOfLines={1}>
                        {room?.otherUser?.email ? room.otherUser.email : (room?.otherUser?.isOnline ? 'Active Online' : 'Direct Frequency')}
                    </Text>
                </View>
            )}

            {!isDirect && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowMembersModal(true)}
                    style={styles.groupSubHeader}
                >
                    <View style={styles.groupSubHeaderLeft}>
                        <MaterialCommunityIcons name="account-group" size={17} color="#2563EB" />
                        <Text style={styles.groupSubHeaderTitle}>Group Members</Text>
                        <View style={styles.groupMemberCountBadge}>
                            <Text style={styles.groupMemberCountText}>{groupParticipants.length}</Text>
                        </View>
                    </View>
                    <View style={styles.groupSubHeaderRight}>
                        {/* Compact Avatar Stack */}
                        <View style={styles.groupAvatarStack}>
                            {groupParticipants.slice(0, 3).map((p, idx) => (
                                <View key={p.userId || p.id || idx} style={[styles.stackAvatarCircle, { marginLeft: idx > 0 ? -8 : 0 }]}>
                                    {p.avatar ? (
                                        <Image source={{ uri: getServerUrl(p.avatar) }} style={styles.stackAvatarImg} />
                                    ) : (
                                        <View style={styles.stackAvatarPlaceholder}>
                                            <Text style={styles.stackAvatarInitial}>{(p.fullName || 'U').charAt(0).toUpperCase()}</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                        <Text style={styles.groupSubHeaderLink}>View All</Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color="#2563EB" />
                    </View>
                </TouchableOpacity>
            )}

            {isArchived && (
                <View style={styles.archivedBanner}>
                    <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#B45309" />
                    <Text style={styles.archivedBannerText}>
                        Archived conversation (Read-Only). Assignment or hierarchy permissions are inactive.
                    </Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.chatBody}>
                    <FlatList
                        ref={flatListRef}
                        data={roomMessages}
                        keyExtractor={keyExtractor}
                        style={styles.messages}
                        contentContainerStyle={styles.messageList}
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
                            },
                        ]}
                    >
                        {isArchived ? (
                            <View style={styles.readOnlyFooter}>
                                <MaterialCommunityIcons name="lock-outline" size={16} color="#94A3B8" />
                                <Text style={styles.readOnlyFooterText}>This conversation is read-only</Text>
                            </View>
                        ) : (
                            <>
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
                            </>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>

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

            {/* Group Members Modal */}
            <Modal
                visible={showMembersModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowMembersModal(false);
                    setParticipantSearch('');
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Project Group Members</Text>
                                <Text style={styles.modalSubtitle}>
                                    {groupParticipants.length} active participants in this group
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => {
                                    setShowMembersModal(false);
                                    setParticipantSearch('');
                                }}
                            >
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.modalSearchContainer}>
                            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" style={styles.searchIcon} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search by name or role..."
                                placeholderTextColor="#94A3B8"
                                value={participantSearch}
                                onChangeText={setParticipantSearch}
                                autoCapitalize="none"
                            />
                            {Boolean(participantSearch) && (
                                <TouchableOpacity onPress={() => setParticipantSearch('')} style={styles.clearSearchBtn}>
                                    <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Participants List */}
                        {loadingParticipants && groupParticipants.length === 0 ? (
                            <View style={styles.modalLoadingContainer}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={styles.modalLoadingText}>Loading group members...</Text>
                            </View>
                        ) : filteredParticipants.length === 0 ? (
                            <View style={styles.modalEmptyContainer}>
                                <MaterialCommunityIcons name="account-search-outline" size={40} color="#CBD5E1" />
                                <Text style={styles.modalEmptyText}>
                                    {participantSearch ? 'No members matching search' : 'No participants found'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredParticipants}
                                keyExtractor={(item, index) => item.userId || item.id || index.toString()}
                                contentContainerStyle={styles.modalList}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => {
                                    const badge = getRoleBadgeInfo(item.role);
                                    const isMe = String(item.userId) === String(user?._id);
                                    const avatarUri = item.avatar ? getServerUrl(item.avatar) : null;
                                    return (
                                        <View style={styles.memberRow}>
                                            <View style={styles.memberAvatarContainer}>
                                                {avatarUri ? (
                                                    <Image source={{ uri: avatarUri }} style={styles.memberAvatarImg} />
                                                ) : (
                                                    <View style={styles.memberAvatarPlaceholder}>
                                                        <Text style={styles.memberAvatarText}>
                                                            {(item.fullName || 'U').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View
                                                    style={[
                                                        styles.memberOnlineDot,
                                                        { backgroundColor: item.isOnline ? '#10B981' : '#CBD5E1' }
                                                    ]}
                                                />
                                            </View>
                                            <View style={styles.memberInfo}>
                                                <View style={styles.memberNameRow}>
                                                    <Text style={styles.memberName} numberOfLines={1}>
                                                        {item.fullName}
                                                    </Text>
                                                    {isMe && (
                                                        <View style={styles.youBadge}>
                                                            <Text style={styles.youBadgeText}>YOU</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.memberStatusText} numberOfLines={1}>
                                                    {item.email || (item.isOnline ? 'Active Online' : 'Offline')}
                                                </Text>
                                            </View>
                                            <View style={[styles.memberRoleBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                                <Text style={[styles.memberRoleText, { color: badge.text }]}>
                                                    {badge.label}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
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
    },
    directSubHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    directPeerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    directPeerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    directPeerName: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textPrimary,
        maxWidth: '55%',
    },
    directRoleChip: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    directRoleText: {
        fontSize: 8,
        fontWeight: '900',
    },
    directFrequencyText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    archivedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        backgroundColor: '#FEF3C7',
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
    },
    archivedBannerText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400E',
        flex: 1,
    },
    readOnlyFooter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F1F5F9',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    readOnlyFooterText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    groupSubHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: 9,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    groupSubHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    groupSubHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    groupMemberCountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    groupMemberCountText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#2563EB',
    },
    groupSubHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    groupAvatarStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stackAvatarCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        overflow: 'hidden',
        backgroundColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stackAvatarImg: {
        width: '100%',
        height: '100%',
    },
    stackAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
    },
    stackAvatarInitial: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
    },
    groupSubHeaderLink: {
        fontSize: 11,
        fontWeight: '700',
        color: '#2563EB',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.textPrimary,
    },
    modalSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.l,
        marginVertical: SPACING.m,
        paddingHorizontal: SPACING.m,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: COLORS.textPrimary,
        paddingVertical: 0,
    },
    clearSearchBtn: {
        padding: 4,
    },
    modalLoadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8,
    },
    modalLoadingText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    modalEmptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8,
    },
    modalEmptyText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
    },
    modalList: {
        paddingHorizontal: SPACING.l,
        paddingBottom: 16,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    memberAvatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    memberAvatarImg: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
    },
    memberAvatarPlaceholder: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    memberAvatarText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#2563EB',
    },
    memberOnlineDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    memberInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    memberNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    memberName: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textPrimary,
        maxWidth: '75%',
    },
    youBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        backgroundColor: '#EFF6FF',
        borderRadius: 4,
    },
    youBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#2563EB',
    },
    memberStatusText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    memberRoleBadge: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    memberRoleText: {
        fontSize: 9,
        fontWeight: '900',
    }
});

export default WorkerChatScreen;
