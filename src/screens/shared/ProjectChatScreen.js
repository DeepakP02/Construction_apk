import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Keyboard, Dimensions, Modal, ScrollView, Pressable, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import AppHeader from '../../components/AppHeader';
import { getServerUrl } from '../../utils/api';

const ProjectChatScreen = ({ route }) => {
    const { project } = route.params;
    const { messages, sendMessage, fetchMessages, ensureDirectChatRoom, user, uploadFile } = useApp();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [dmRoomId, setDmRoomId] = useState(null);
    const [viewerUri, setViewerUri] = useState(null);
    const flatListRef = useRef();

    const targetId = (project._id || project.id)?.toString();
    const clientUserId = (project.clientId || project.client?.id || project.client?._id)?.toString();
    const peerId = clientUserId || targetId;
    const isGeneral = targetId === 'GENERAL_COMPANY';
    const isPrivate = project.isPrivate || project.type === 'private';
    const myId = user?._id?.toString();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
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

    const chatMessages = (messages || []).filter(m => {
        const mRoomId = m.roomId != null ? String(m.roomId) : '';
        const mProjId = m.projectId != null ? String(m.projectId) : '';
        const mSenderId = (m.sender?._id || m.sender || m.senderId)?.toString();

        if (isGeneral) return !mProjId && !m.receiverId;
        if (isPrivate) {
            const resolved = dmRoomId?.toString();
            return resolved ? mRoomId === resolved : false;
        }
        return mProjId === targetId;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const handleSend = async () => {
        if (!text.trim()) return;
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
            const success = isPrivate
                ? await sendMessage(text, null, resolvedDmRoomId ? null : peerId, resolvedDmRoomId || peerId)
                : await sendMessage(text, targetId);

            if (success) {
                setText('');
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
            }
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
            Alert.alert('Send Photo', 'Send this photo to the channel?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send', onPress: () => sendImageMessage(asset.uri) }
            ]);
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
            if (isPrivate && !dmRoomId) {
                const rid = await ensureDirectChatRoom(peerId);
                if (rid) {
                    resolvedDmRoomId = rid;
                    setDmRoomId(rid);
                }
            }
            const fileName = uri.split('/').pop();
            const attachment = await uploadFile(uri, fileName, 'image/jpeg');

            await (isPrivate
                ? sendMessage("[Photo Attachment]", null, resolvedDmRoomId ? null : peerId, resolvedDmRoomId || peerId, [attachment])
                : sendMessage("[Photo Attachment]", targetId, null, targetId, [attachment])
            );
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        } catch (err) {
            Alert.alert("Upload Error", "Failed to upload image.");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
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
                            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.message}</Text>
                        ) : null}
                        <Text style={[styles.time, isMe ? styles.myTime : styles.theirTime]}>
                            {item.time || new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <AppHeader title={(project.fullName || project.name)} showBack showRight={false} showLogo={true} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 24}
            >
                <FlatList
                    ref={flatListRef}
                    data={chatMessages}
                    keyExtractor={(item, index) => item._id || item.id || index.toString()}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderMessage}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                />

                <View style={styles.footerContainer}>
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
    list: { padding: 16, paddingBottom: 20 },
    messageWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%', gap: 8 },
    myMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    theirMessage: { alignSelf: 'flex-start' },
    avatarMain: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...SHADOWS.small, borderWidth: 1, borderColor: '#E2E8F0' },
    avatarText: { fontSize: 13, fontWeight: '900', color: COLORS.primaryAccent },
    senderNameText: { fontSize: 10, fontWeight: '900', color: COLORS.primaryAccent, marginBottom: 4, marginLeft: 4, textTransform: 'uppercase' },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, ...SHADOWS.small },
    myBubble: { backgroundColor: '#E0F2FE', borderBottomRightRadius: 4 },
    theirBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
    messageText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
    myText: { color: '#1E293B' },
    theirText: { color: '#1E293B' },
    time: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, fontWeight: '600', opacity: 0.7 },
    myTime: { color: '#64748B' },
    theirTime: { color: '#94A3B8' },
    attachmentContainer: { marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
    attachmentImage: { width: 220, height: 220, borderRadius: 12 },
    viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    viewerScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    viewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
    viewerClose: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 12,
        backgroundColor: '#F8FAFC'
    },
    whatsAppInputLine: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 16, minHeight: 52, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 10 },
    sideIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    mainInputField: { flex: 1, fontSize: 16, color: '#1E293B', paddingVertical: 10, fontWeight: '500' },
    rightActions: { flexDirection: 'row', alignItems: 'center' },
    sendFab: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryAccent, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium }
});

export default ProjectChatScreen;
