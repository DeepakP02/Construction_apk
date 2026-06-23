import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Alert, Keyboard, Modal, ScrollView, Pressable, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';
import { getServerUrl } from '../../utils/api';
import api from '../../utils/api';

const { width } = Dimensions.get('window');

const WorkerChatScreen = ({ navigation, route }) => {
    const { room } = route.params || {};
    const { user, messages, sendMessage, fetchMessages, ensureDirectChatRoom, uploadFile, socketRef } = useApp();
    const [msgText, setMsgText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    /** Real ChatRoom id for DMs (route only has peer user id). */
    const [dmRoomId, setDmRoomId] = useState(null);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();
    // Track the resolved room id for socket subscriptions
    const resolvedRoomIdRef = useRef(null);

    // Resolve the actual ChatRoom id and load initial messages
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!room?.id) return;

            setLoading(true);
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

    // ── FALLBACK: 3-second polling while screen is focused ─────────────────────
    useFocusEffect(
        useCallback(() => {
            let timer = null;
            const refreshActiveRoom = async () => {
                const fetchId = resolvedRoomIdRef.current;
                if (!fetchId) return;
                await fetchMessages(fetchId);
            };

            refreshActiveRoom();
            timer = setInterval(refreshActiveRoom, 3000);

            return () => {
                if (timer) clearInterval(timer);
            };
        }, [fetchMessages])
    );

    const peerId = room?.id?.toString();
    const myId = user?._id?.toString();

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            flatListRef.current?.scrollToEnd({ animated: true });
        });
        return () => showSubscription.remove();
    }, []);

    const roomMessages = (messages || []).filter(m => {
        if (!room) return false;
        const mRoomId = m.roomId != null ? String(m.roomId) : '';
        const mProjId = m.projectId != null ? String(m.projectId) : '';
        const mSenderId = (m.sender?._id || m.sender || m.senderId)?.toString();
        const key = room.id?.toString();

        if (room.type === 'private') {
            const resolved = dmRoomId?.toString();
            return resolved ? mRoomId === resolved : false;
        }

        if (mRoomId === key) return true;
        if (key === 'GENERAL_COMPANY') return !mProjId && !m.receiverId;
        if (room.type === 'project') return mProjId === key;
        return false;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

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
                Alert.alert('Send Photo', 'Send this photo to the channel?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Send', onPress: () => sendImageMessage(asset.uri) }
                ]);
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
                Alert.alert('Send Photo', 'Send this photo to the channel?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Send', onPress: () => sendImageMessage(asset.uri) }
                ]);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open camera');
        }
    };

    const sendImageMessage = async (uri) => {
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
            const fileName = uri.split('/').pop();
            const attachment = await uploadFile(uri, fileName, 'image/jpeg');

            const success = room.type === 'private'
                ? await sendMessage("[Photo Attachment]", null, resolvedDmRoomId ? null : room.id, resolvedDmRoomId || room.id, [attachment])
                : await sendMessage("[Photo Attachment]", room.projectId || null, null, room.id, [attachment]);

            if (success) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
            } else {
                Alert.alert('Error', 'Could not send the photo.');
            }
        } catch (err) {
            Alert.alert("Upload Error", "Failed to upload image. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item, index }) => {
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
                                        <Image
                                            source={{ uri: resolvedUri }}
                                            style={styles.attachmentImage}
                                            resizeMode="cover"
                                            onError={(e) => console.warn('Image load error:', resolvedUri, e.nativeEvent.error)}
                                        />
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
    };

    return (
        <View style={styles.container}>
            <AppHeader title={room?.name || 'Discussion Room'} showBack showRight={false} showLogo={true} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={roomMessages}
                    keyExtractor={(item, index) => item._id || item.id || index.toString()}
                    contentContainerStyle={styles.messageList}
                    renderItem={renderMessage}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                <View style={styles.footerContainer}>
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    messageList: { padding: 16, paddingBottom: 20 },
    messageRow: { marginBottom: 16, width: '100%' },
    sentRow: { alignItems: 'flex-end' },
    receivedRow: { alignItems: 'flex-start' },
    bubble: {
        maxWidth: '82%',
        padding: 12,
        borderRadius: 20,
        ...SHADOWS.small,
    },
    sentBubble: {
        backgroundColor: '#E0F2FE',
        borderBottomRightRadius: 4,
    },
    receivedBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    senderHeader: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 4 },
    messageText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
    sentText: { color: '#1E293B' },
    receivedText: { color: '#1E293B' },
    timeText: { fontSize: 10, marginTop: 4, opacity: 0.7, fontWeight: '600' },
    sentTime: { color: '#64748B', textAlign: 'right' },
    receivedTime: { color: '#94A3B8' },
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
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 10,
        backgroundColor: '#F8FAFC'
    },
    whatsAppInputLine: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
