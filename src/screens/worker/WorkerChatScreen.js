import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Alert, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const WorkerChatScreen = ({ navigation, route }) => {
    const { room } = route.params || {};
    const { user, messages, sendMessage, fetchMessages, ensureDirectChatRoom, uploadFile } = useApp();
    const [msgText, setMsgText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    /** Real ChatRoom id for DMs (route only has peer user id). */
    const [dmRoomId, setDmRoomId] = useState(null);
    const flatListRef = useRef();

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
                if (!cancelled) {
                    await fetchMessages(fetchId);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
                }
            }
        };
        const cleanupPromise = load();
        return () => { 
            cancelled = true; 
            cleanupPromise.then(cleanupFn => {
                if (typeof cleanupFn === 'function') cleanupFn();
            });
        };
    }, [room?.id, room?.type, user?._id]);

    useFocusEffect(
        useCallback(() => {
            let timer = null;
            const refreshActiveRoom = async () => {
                if (!room?.id) return;
                const fetchId = room.type === 'private' ? (dmRoomId || null) : room.id;
                if (!fetchId) return;
                await fetchMessages(fetchId);
            };

            refreshActiveRoom();
            timer = setInterval(refreshActiveRoom, 5000);

            return () => {
                if (timer) clearInterval(timer);
            };
        }, [room?.id, room?.type, dmRoomId, fetchMessages])
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
            if (resolved && mRoomId && mRoomId === resolved) return true;
            // API stores messages on Chat.roomId; legacy filter missed own messages (no receiverId on Chat)
            if (!mProjId && peerId && myId && (mSenderId === peerId || mSenderId === myId)) return true;
            return false;
        }

        if (mRoomId === key) return true;
        if (key === 'GENERAL_COMPANY') return !mProjId && !m.receiverId;
        if (room.type === 'project') return mProjId === key;
        return false;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const effectiveRoomId = room?.type === 'private' ? (dmRoomId || null) : (room?.id || null);

    const handleSend = async () => {
        if (!msgText.trim()) return;
        setSending(true);
        try {
            if (room.type === 'private' && !dmRoomId) {
                const rid = await ensureDirectChatRoom(room.id);
                if (rid) setDmRoomId(rid);
            }
            // Pass correct params: sendMessage(text, projectId, receiverId, roomId)
            const success = room.type === 'private'
                ? await sendMessage(msgText, null, room.id, effectiveRoomId || room.id)
                : await sendMessage(msgText, room.projectId || null, null, room.id);

            if (success) {
                setMsgText('');
                setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
            } else {
                Alert.alert('Error', 'Message could not be sent. Check your connection and permissions.');
            }
        } catch (err) {
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
                mediaTypes: ['images'], // Fix for deprecation warning
                allowsEditing: true,
                quality: 0.7,
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
                quality: 0.7,
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
            if (room.type === 'private' && !dmRoomId) {
                const rid = await ensureDirectChatRoom(room.id);
                if (rid) setDmRoomId(rid);
            }
            const fileName = uri.split('/').pop();
            const attachment = await uploadFile(uri, fileName, 'image/jpeg');

            const success = room.type === 'private'
                ? await sendMessage("[Photo Attachment]", null, room.id, effectiveRoomId || room.id, [attachment])
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
                            {item.attachments.map((att, i) => (
                                <Image 
                                    key={i} 
                                    source={{ uri: att.url }} 
                                    style={styles.attachmentImage} 
                                    resizeMode="cover"
                                />
                            ))}
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
