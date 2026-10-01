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

const ProjectChatScreen = ({ route }) => {
    const { project } = route.params;
    const { messagesByRoom, setMessagesByRoom, sendMessage, fetchMessages, user, uploadFile } = useApp();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();
    const insets = useSafeAreaInsets();
    const keyboardOverlap = useKeyboardOverlap(insets.bottom);
    const composerBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);
    const messageListBottomPadding = 20 + keyboardOverlap;

    const targetId = (project._id || project.id)?.toString();
    const myId = user?._id?.toString();

    // Group participants state
    const [groupParticipants, setGroupParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');

    // Fetch group participants with resilient fallback
    useEffect(() => {
        if (!targetId) {
            setGroupParticipants([]);
            setLoadingParticipants(false);
            return;
        }

        let cancelled = false;
        const fetchParticipants = async () => {
            let fetched = false;
            try {
                setLoadingParticipants(true);
                const res = await api.get(`/chat/${targetId}/participants`);
                const list = res.data?.participants || (Array.isArray(res.data) ? res.data : []);
                if (!cancelled && Array.isArray(list) && list.length > 0) {
                    setGroupParticipants(list);
                    fetched = true;
                }
            } catch (err) {
                console.warn('[ProjectChatScreen] Primary participants endpoint failed, attempting fallback:', err?.message || err);
            }

            // Fallback: If primary failed or empty, try project members & project details
            if (!fetched) {
                const pid = targetId;
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
                        console.warn('[ProjectChatScreen] Fallback participant loading failed:', fallbackErr?.message || fallbackErr);
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
    }, [targetId]);

    const filteredParticipants = useMemo(() => {
        if (!participantSearch.trim()) return groupParticipants;
        const query = participantSearch.toLowerCase();
        return groupParticipants.filter(p => 
            p.fullName?.toLowerCase().includes(query) ||
            p.role?.toLowerCase().includes(query) ||
            p.email?.toLowerCase().includes(query)
        );
    }, [groupParticipants, participantSearch]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const fetchId = targetId;

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
    }, [targetId]);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            flatListRef.current?.scrollToEnd({ animated: true });
        });
        return () => showSubscription.remove();
    }, []);

    const chatMessages = useMemo(() => {
        if (!targetId) return [];
        
        const rawList = messagesByRoom[targetId] || [];
        return [...rawList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [messagesByRoom, targetId]);

    const handleSend = async () => {
        if (sending) return;
        if (!text.trim()) return;
        const textToSend = text;
        setText(''); // Clear input textbox immediately
        setSending(true);
        try {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            const success = await sendMessage(textToSend, targetId);

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
            const targetKey = targetId;

            // Immediately send the message with a placeholder attachment containing isPending: true
            const placeholderAttachment = {
                url: uri,
                name: uri.split('/').pop(),
                fileType: 'image/jpeg',
                isPending: true
            };

            const placeholderMsg = await sendMessage("[Photo Attachment]", targetId, null, targetId, [placeholderAttachment]);

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
                                    {groupParticipants.length} active participants in this project
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
    sendFab: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryAccent, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
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

export default ProjectChatScreen;
