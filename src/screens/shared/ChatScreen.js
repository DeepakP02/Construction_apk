import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, StatusBar, ActivityIndicator, useWindowDimensions } from 'react-native';
import { COLORS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

const ChatScreen = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const isCompact = width < 360;
    const { user, loading, chatRooms } = useApp();
    const [search, setSearch] = useState('');
    const [roomList, setRoomList] = useState([]);
    const [chatUsers, setChatUsers] = useState([]);

    const loadCommunications = useCallback(async () => {
        try {
            const [roomsRes, usersRes] = await Promise.all([
                api.get('/chat/rooms'),
                api.get('/chat/users')
            ]);
            setRoomList(Array.isArray(roomsRes.data) ? roomsRes.data : []);
            setChatUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        } catch (e) {
            setRoomList([]);
            setChatUsers([]);
        }
    }, []);

    useEffect(() => {
        if (!user?._id) return undefined;
        loadCommunications();
    }, [user?._id, loadCommunications]);

    useEffect(() => {
        if (!Array.isArray(chatRooms) || chatRooms.length === 0) return;
        setRoomList(chatRooms);
    }, [chatRooms]);

    useFocusEffect(
        useCallback(() => {
            if (user?._id) loadCommunications();
        }, [user?._id, loadCommunications])
    );

    const listSections = useMemo(() => {
        const msgToTime = (raw) => {
            if (!raw) return 0;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) ? t : 0;
        };

        const projectPool = (roomList || [])
            .filter((room) => room.roomType === 'PROJECT_GROUP')
            .map((room) => ({
                _id: room.projectId || room.id,
                name: room.projectName || room.name || 'Project Room',
                type: 'project',
                __lastActivityAt: msgToTime(room?.lastMessage?.time || room?.updatedAt)
            }))
            .sort((a, b) => b.__lastActivityAt - a.__lastActivityAt);

        const channelPool = (roomList || [])
            .filter((room) => !['PROJECT_GROUP', 'DIRECT'].includes(room.roomType))
            .map((room) => ({
                _id: room.id,
                name: room.name || 'Company Channel',
                type: 'general',
                __lastActivityAt: msgToTime(room?.lastMessage?.time || room?.updatedAt)
            }))
            .sort((a, b) => b.__lastActivityAt - a.__lastActivityAt);

        const directRooms = (roomList || []).filter((room) => room.roomType === 'DIRECT');
        const directByUser = new Map();
        directRooms.forEach((room) => {
            const uid = String(room.otherUserId || '');
            if (!uid) return;
            const previous = directByUser.get(uid);
            const currentTime = msgToTime(room?.lastMessage?.time || room?.updatedAt);
            const previousTime = msgToTime(previous?.lastMessage?.time || previous?.updatedAt);
            if (!previous || currentTime > previousTime) directByUser.set(uid, room);
        });

        const memberPool = (chatUsers || [])
            .map((u) => {
                const uid = String(u._id || u.id);
                const room = directByUser.get(uid);
                return {
                    ...u,
                    _id: u._id || u.id,
                    name: u.fullName || u.name || 'Team Member',
                    type: 'private',
                    __lastActivityAt: msgToTime(room?.lastMessage?.time || room?.updatedAt)
                };
            })
            .sort((a, b) => b.__lastActivityAt - a.__lastActivityAt);

        const filteredProjects = projectPool.filter((p) => (p.name || '').toLowerCase().includes(search.toLowerCase()));
        const filteredChannels = channelPool.filter((c) => (c.name || '').toLowerCase().includes(search.toLowerCase()));
        const filteredMembers = memberPool.filter((m) =>
            (m.fullName || m.name || '').toLowerCase().includes(search.toLowerCase())
        );

        const sections = [];

        if (filteredProjects.length > 0) {
            sections.push({
                title: 'PROJECT ROOMS',
                data: filteredProjects.map((p) => ({ ...p, type: 'project' })),
            });
        }

        if (filteredChannels.length > 0) {
            sections.push({
                title: 'COMPANY CHANNELS',
                data: filteredChannels.map((c) => ({ ...c, type: 'general' })),
            });
        }

        if (filteredMembers.length > 0) {
            sections.push({
                title: 'DIRECT MESSAGES',
                data: filteredMembers,
            });
        }

        return sections;
    }, [user, roomList, chatUsers, search]);

    const renderChatMember = ({ item }) => {
        const itemId = String(item._id || item.id || '');
        const roomMeta =
            item.type === 'private'
                ? (roomList || []).find((r) => r.roomType === 'DIRECT' && String(r.otherUserId || '') === itemId)
                : item.type === 'project'
                    ? (roomList || []).find((r) => r.roomType === 'PROJECT_GROUP' && String(r.projectId || '') === itemId)
                    : item.type === 'general'
                        ? (roomList || []).find((r) => String(r.id || '') === itemId)
                    : null;

        const effectiveTime = roomMeta?.lastMessage?.time || roomMeta?.updatedAt || null;
        const previewSender = roomMeta?.lastMessage?.sender || null;
        const previewText = roomMeta?.lastMessage?.text || 'Start a new conversation...';
        const unreadCount = Number(roomMeta?.unreadCount || 0);

        const initial = (item.name || 'U').charAt(0).toUpperCase();

        const typeConfig = {
            general: { bg: '#EFF6FF', iconColor: '#2563EB', icon: 'domain' },
            project: { bg: '#ECFDF5', iconColor: '#10B981', icon: 'office-building' },
            private: { bg: '#F5F3FF', iconColor: '#8B5CF6', icon: 'account' },
        };
        const config = typeConfig[item.type] || typeConfig.private;

        return (
            <TouchableOpacity
                style={[styles.chatCard, { paddingHorizontal: isCompact ? 14 : 20, paddingVertical: isCompact ? 12 : 16 }]}
                onPress={() =>
                    navigation.navigate('WorkerChat', {
                        room: {
                            id: item._id || item.id,
                            name: item.name,
                            type: item.type,
                            ...(item.type === 'project' ? { projectId: item._id || item.id } : {}),
                        },
                    })
                }
            >
                <View style={[styles.avatarBox, { backgroundColor: config.bg, width: isCompact ? 48 : 56, height: isCompact ? 48 : 56, borderRadius: isCompact ? 18 : 22 }]}>
                    <Text style={[styles.avatarInitial, { color: config.iconColor, fontSize: isCompact ? 18 : 22 }]}>{initial}</Text>
                    <View style={styles.statusDot} />
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.chatInfo, { marginLeft: isCompact ? 12 : 18 }]}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.chatName, { fontSize: isCompact ? 15 : 17 }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.chatTime}>
                            {effectiveTime
                                ? new Date(effectiveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                        </Text>
                    </View>
                    <View style={styles.msgRow}>
                        {previewSender ? (
                            <Text style={styles.senderChip} numberOfLines={1}>
                                {previewSender}
                            </Text>
                        ) : (
                            <MaterialCommunityIcons name={config.icon} size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                        )}
                        <Text style={[styles.lastMsg, unreadCount > 0 && styles.lastMsgUnread]} numberOfLines={1}>
                            {previewText}
                        </Text>
                    </View>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={18} color="#E2E8F0" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Communications" hideSearch showBack={true} />

            <View style={[styles.searchSection, { paddingHorizontal: isCompact ? 14 : 20, paddingVertical: isCompact ? 10 : 15 }]}>
                <View style={[styles.searchBar, { height: isCompact ? 48 : 54, borderRadius: isCompact ? 14 : 18 }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        style={[styles.searchInput, { fontSize: isCompact ? 13 : 14 }]}
                        placeholder="Search chats or members..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            <SectionList
                sections={listSections}
                keyExtractor={(item, index) => item._id || item.id || index.toString()}
                renderItem={renderChatMember}
                renderSectionHeader={({ section: { title, data } }) =>
                    data.length > 0 ? (
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { fontSize: isCompact ? 10 : 11 }]}>{title}</Text>
                            <View style={styles.sectionLine} />
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    searchSection: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFFFFF' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        height: 54,
        borderRadius: 18,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '700', color: '#1E293B' },

    list: { paddingBottom: 100 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 25,
        marginBottom: 15,
        gap: 12,
    },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
    sectionLine: { flex: 1, height: 1, backgroundColor: '#F1F5F9' },

    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    avatarBox: {
        width: 56,
        height: 56,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    avatarInitial: { fontSize: 22, fontWeight: '900' },
    statusDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    unreadBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },

    chatInfo: { flex: 1, marginLeft: 18 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    chatName: { fontSize: 17, fontWeight: '800', color: '#0F172A', maxWidth: '75%' },
    chatTime: { fontSize: 11, color: '#94A3B8', fontWeight: '800' },

    msgRow: { flexDirection: 'row', alignItems: 'center' },
    senderChip: {
        fontSize: 12,
        fontWeight: '900',
        color: '#2563EB',
        backgroundColor: '#EAF1FF',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 8,
        maxWidth: 90,
        overflow: 'hidden',
    },
    lastMsg: { fontSize: 13, color: '#64748B', fontWeight: '600', flex: 1 },
    lastMsgUnread: { color: '#334155', fontWeight: '800' },
});

export default ChatScreen;
