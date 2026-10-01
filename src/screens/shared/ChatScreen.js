import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, 
    StatusBar, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, 
    Platform, Alert, FlatList 
} from 'react-native';
import { COLORS, SIZES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

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

const ChatScreen = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const isCompact = width < 360;
    const { user, loading, chatRooms, refreshData, ensureDirectChatRoom, searchHierarchyUsers } = useApp();

    const [activeTab, setActiveTab] = useState('PROJECT_GROUP'); // 'PROJECT_GROUP' | 'DIRECT'
    const [search, setSearch] = useState('');
    const [hierarchyContacts, setHierarchyContacts] = useState([]);
    const [isSearchingContacts, setIsSearchingContacts] = useState(false);
    const [isStartingDirect, setIsStartingDirect] = useState(false);

    // Refresh rooms on screen focus
    useFocusEffect(
        useCallback(() => {
            if (user?._id && refreshData) {
                refreshData().catch((err) => console.warn('[ChatScreen] Refresh error:', err));
            }
        }, [user?._id, refreshData])
    );

    const roomList = chatRooms || [];

    // Calculate unread counts
    const groupUnread = useMemo(() => {
        return (roomList || [])
            .filter((r) => (r.roomType || 'PROJECT_GROUP') === 'PROJECT_GROUP')
            .reduce((sum, r) => sum + (r.unreadCount || 0), 0);
    }, [roomList]);

    const privateUnread = useMemo(() => {
        return (roomList || [])
            .filter((r) => r.roomType === 'DIRECT')
            .reduce((sum, r) => sum + (r.unreadCount || 0), 0);
    }, [roomList]);

    // Debounced search for hierarchy contacts when in PRIVATE tab
    useEffect(() => {
        if (activeTab !== 'DIRECT' || !search.trim()) {
            setHierarchyContacts([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingContacts(true);
            try {
                if (searchHierarchyUsers) {
                    const results = await searchHierarchyUsers(search.trim());
                    setHierarchyContacts(results || []);
                }
            } catch (err) {
                console.error('[ChatScreen] Contact search error:', err);
            } finally {
                setIsSearchingContacts(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [search, activeTab, searchHierarchyUsers]);

    const msgToTime = (raw) => {
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return Number.isFinite(t) ? t : 0;
    };

    // Project Groups list
    const projectSections = useMemo(() => {
        const pool = (roomList || [])
            .filter((room) => (room.roomType || 'PROJECT_GROUP') === 'PROJECT_GROUP')
            .map((room) => ({
                _id: room.projectId || room.id,
                roomId: room.id,
                name: room.projectName || room.name || 'Project Room',
                type: 'project',
                roomType: 'PROJECT_GROUP',
                roomMeta: room,
                __lastActivityAt: msgToTime(room?.lastMessage?.time || room?.updatedAt)
            }))
            .sort((a, b) => b.__lastActivityAt - a.__lastActivityAt);

        const filtered = pool.filter((p) =>
            (p.name || '').toLowerCase().includes(search.toLowerCase())
        );

        if (filtered.length > 0) {
            return [{ title: 'PROJECT ROOMS', data: filtered }];
        }
        return [];
    }, [roomList, search]);

    // Existing Direct Chats list
    const directSections = useMemo(() => {
        const pool = (roomList || [])
            .filter((room) => room.roomType === 'DIRECT')
            .map((room) => ({
                _id: room.id,
                roomId: room.id,
                name: room.otherUser?.fullName || room.name || 'Direct Chat',
                type: 'private',
                roomType: 'DIRECT',
                roomMeta: room,
                __lastActivityAt: msgToTime(room?.lastMessage?.time || room?.updatedAt)
            }))
            .sort((a, b) => b.__lastActivityAt - a.__lastActivityAt);

        const filtered = pool.filter((p) =>
            (p.name || '').toLowerCase().includes(search.toLowerCase())
        );

        if (filtered.length > 0) {
            return [{ title: 'CONVERSATIONS', data: filtered }];
        }
        return [];
    }, [roomList, search]);

    const handleOpenRoom = (item) => {
        navigation.navigate('WorkerChat', {
            room: {
                id: item.roomId || item._id,
                name: item.name,
                type: item.type || (item.roomType === 'DIRECT' ? 'private' : 'project'),
                roomType: item.roomType,
                projectId: item.projectId || item.roomMeta?.projectId || item.roomMeta?.project?._id || item._id,
                otherUser: item.roomMeta?.otherUser,
                isArchived: item.roomMeta?.isArchived || false,
                readOnly: item.roomMeta?.readOnly || false,
                participants: item.roomMeta?.participants || item.participants || [],
                participantCount: item.roomMeta?.participantCount || item.participantCount || 0,
            },
        });
    };

    const handleSelectContact = async (contact) => {
        try {
            setIsStartingDirect(true);
            const directRoom = await ensureDirectChatRoom(contact._id);
            if (directRoom) {
                setSearch('');
                setHierarchyContacts([]);
                navigation.navigate('WorkerChat', {
                    room: {
                        id: directRoom.id || directRoom._id,
                        name: contact.fullName || directRoom.name,
                        type: 'private',
                        roomType: 'DIRECT',
                        otherUser: contact,
                        isArchived: directRoom.isArchived || false,
                        readOnly: directRoom.readOnly || false,
                    }
                });
            }
        } catch (err) {
            Alert.alert('Unable to Connect', err.response?.data?.message || 'Could not start direct conversation.');
        } finally {
            setIsStartingDirect(false);
        }
    };

    const renderChatMember = ({ item }) => {
        const roomMeta = item.roomMeta;
        const isDirect = item.roomType === 'DIRECT';
        const effectiveTime = roomMeta?.lastMessage?.time || roomMeta?.updatedAt || null;
        const previewSender = roomMeta?.lastMessage?.sender || null;
        const previewText = roomMeta?.lastMessage?.text || (isDirect ? 'Direct hierarchy frequency...' : 'Start a project discussion...');
        const unreadCount = Number(roomMeta?.unreadCount || 0);
        const initial = (item.name || 'U').charAt(0).toUpperCase();
        const roleBadge = isDirect && roomMeta?.otherUser?.role ? getRoleBadgeInfo(roomMeta.otherUser.role) : null;

        return (
            <TouchableOpacity
                style={[styles.chatCard, { paddingHorizontal: isCompact ? 14 : 20, paddingVertical: isCompact ? 12 : 16 }]}
                onPress={() => handleOpenRoom(item)}
            >
                <View style={[
                    styles.avatarBox, 
                    { 
                        backgroundColor: isDirect ? '#EEF2FF' : '#ECFDF5', 
                        width: isCompact ? 48 : 56, 
                        height: isCompact ? 48 : 56, 
                        borderRadius: isCompact ? 18 : 22 
                    }
                ]}>
                    <Text style={[styles.avatarInitial, { color: isDirect ? '#4F46E5' : '#10B981', fontSize: isCompact ? 18 : 22 }]}>
                        {initial}
                    </Text>
                    <View style={[
                        styles.statusDot, 
                        { backgroundColor: (isDirect ? roomMeta?.otherUser?.isOnline : true) ? '#10B981' : '#94A3B8' }
                    ]} />
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.chatInfo, { marginLeft: isCompact ? 12 : 18 }]}>
                    <View style={styles.nameRow}>
                        <View style={styles.nameContainer}>
                            <Text style={[styles.chatName, { fontSize: isCompact ? 15 : 17 }]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {roleBadge && (
                                <View style={[styles.inlineBadge, { backgroundColor: roleBadge.bg, borderColor: roleBadge.border }]}>
                                    <Text style={[styles.inlineBadgeText, { color: roleBadge.text }]}>{roleBadge.label}</Text>
                                </View>
                            )}
                            {roomMeta?.isArchived && (
                                <View style={styles.archivedBadge}>
                                    <Text style={styles.archivedBadgeText}>ARCHIVED</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.chatTime}>
                            {effectiveTime
                                ? new Date(effectiveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                        </Text>
                    </View>
                    <View style={styles.msgRow}>
                        {previewSender ? (
                            <Text style={[styles.senderChip, isDirect && { color: '#4F46E5', backgroundColor: '#EEF2FF' }]} numberOfLines={1}>
                                {previewSender.split(' ')[0]}
                            </Text>
                        ) : (
                            <MaterialCommunityIcons 
                                name={isDirect ? "account-lock" : "office-building"} 
                                size={14} 
                                color="#94A3B8" 
                                style={{ marginRight: 6 }} 
                            />
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

    const renderHierarchyContact = ({ item }) => {
        const roleBadge = getRoleBadgeInfo(item.role);
        const initial = (item.fullName || 'U').charAt(0).toUpperCase();

        return (
            <TouchableOpacity 
                style={styles.contactCard} 
                onPress={() => !isStartingDirect && handleSelectContact(item)}
            >
                <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{initial}</Text>
                    <View style={[styles.contactDot, { backgroundColor: item.isOnline ? '#10B981' : '#94A3B8' }]} />
                </View>

                <View style={styles.contactInfo}>
                    <View style={styles.contactNameRow}>
                        <Text style={styles.contactName} numberOfLines={1}>{item.fullName}</Text>
                        <View style={[styles.inlineBadge, { backgroundColor: roleBadge.bg, borderColor: roleBadge.border }]}>
                            <Text style={[styles.inlineBadgeText, { color: roleBadge.text }]}>{roleBadge.label}</Text>
                        </View>
                    </View>
                    {item.sharedProjects?.length > 0 ? (
                        <Text style={styles.contactSub} numberOfLines={1}>
                            Shared: {item.sharedProjects.map(p => p.title).join(', ')}
                        </Text>
                    ) : (
                        <Text style={styles.contactSub} numberOfLines={1}>{item.email}</Text>
                    )}
                </View>

                <View style={styles.messageBtn}>
                    <MaterialCommunityIcons name="message-plus-outline" size={18} color="#2563EB" />
                </View>
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

    const currentSections = activeTab === 'PROJECT_GROUP' ? projectSections : directSections;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Communications" hideSearch showBack={true} />

            <KeyboardAvoidingView
                style={styles.keyboardWrap}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
            >
                {/* Mode Switcher Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'PROJECT_GROUP' && styles.tabButtonActive]}
                        onPress={() => { setActiveTab('PROJECT_GROUP'); setSearch(''); setHierarchyContacts([]); }}
                    >
                        <MaterialCommunityIcons 
                            name="account-group" 
                            size={18} 
                            color={activeTab === 'PROJECT_GROUP' ? '#2563EB' : '#64748B'} 
                        />
                        <Text style={[styles.tabText, activeTab === 'PROJECT_GROUP' && styles.tabTextActive]}>
                            PROJECT GROUPS
                        </Text>
                        {groupUnread > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{groupUnread > 99 ? '99+' : groupUnread}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'DIRECT' && styles.tabButtonActive]}
                        onPress={() => { setActiveTab('DIRECT'); setSearch(''); setHierarchyContacts([]); }}
                    >
                        <MaterialCommunityIcons 
                            name="account-lock-outline" 
                            size={18} 
                            color={activeTab === 'DIRECT' ? '#2563EB' : '#64748B'} 
                        />
                        <Text style={[styles.tabText, activeTab === 'DIRECT' && styles.tabTextActive]}>
                            PRIVATE
                        </Text>
                        {privateUnread > 0 && (
                            <View style={[styles.tabBadge, { backgroundColor: '#2563EB' }]}>
                                <Text style={styles.tabBadgeText}>{privateUnread > 99 ? '99+' : privateUnread}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchSection, { paddingHorizontal: isCompact ? 14 : 20, paddingVertical: isCompact ? 10 : 12 }]}>
                    <View style={[styles.searchBar, { height: isCompact ? 46 : 50, borderRadius: isCompact ? 14 : 16 }]}>
                        <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                        <TextInput
                            style={[styles.searchInput, { fontSize: isCompact ? 13 : 14 }]}
                            placeholder={activeTab === 'PROJECT_GROUP' ? 'Filter project rooms...' : 'Search hierarchy contacts...'}
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearch(''); setHierarchyContacts([]); }}>
                                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Content View */}
                {activeTab === 'DIRECT' && search.trim().length > 0 ? (
                    /* Search results for hierarchy contacts */
                    <View style={styles.resultsContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>HIERARCHY CONTACTS</Text>
                            {isSearchingContacts && <ActivityIndicator size="small" color="#2563EB" style={{ marginLeft: 8 }} />}
                            <View style={styles.sectionLine} />
                        </View>

                        {hierarchyContacts.length > 0 ? (
                            <FlatList
                                data={hierarchyContacts}
                                keyExtractor={(item) => item._id}
                                renderItem={renderHierarchyContact}
                                contentContainerStyle={styles.list}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            />
                        ) : !isSearchingContacts ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="account-search-outline" size={42} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No hierarchy contacts found for "{search}".</Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    /* Standard Sections (Project Groups or Existing Direct Rooms) */
                    <SectionList
                        sections={currentSections}
                        keyExtractor={(item, index) => item.roomId || item._id || item.id || index.toString()}
                        renderItem={renderChatMember}
                        renderSectionHeader={({ section: { title, data } }) =>
                            data.length > 0 ? (
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { fontSize: isCompact ? 10 : 11 }]}>{title}</Text>
                                    <View style={styles.sectionLine} />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons 
                                    name={activeTab === 'PROJECT_GROUP' ? "folder-sync-outline" : "chat-question-outline"} 
                                    size={46} 
                                    color="#CBD5E1" 
                                />
                                <Text style={styles.emptyText}>
                                    {activeTab === 'PROJECT_GROUP' 
                                        ? 'No project group discussions available.'
                                        : 'No direct conversations yet. Type above to search hierarchy contacts.'}
                                </Text>
                            </View>
                        }
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    />
                )}
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    keyboardWrap: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        marginHorizontal: SPACING.m,
        marginTop: 10,
        borderRadius: 14,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        ...SHADOWS.small,
    },
    tabText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    tabTextActive: {
        color: '#2563EB',
    },
    tabBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },

    searchSection: { paddingHorizontal: SPACING.m, paddingVertical: 12, backgroundColor: COLORS.surface },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        height: 50,
        borderRadius: 16,
        paddingHorizontal: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },

    list: { paddingBottom: 100 },
    resultsContainer: { flex: 1 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        marginTop: 20,
        marginBottom: 12,
        gap: SPACING.sm,
    },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1.2 },
    sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.surfaceSecondary },

    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceSecondary,
    },
    avatarBox: {
        width: 56,
        height: 56,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
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
        top: -6,
        right: -6,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadBadgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '900',
    },

    chatInfo: { flex: 1, marginLeft: 16 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    nameContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
    chatName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, maxWidth: '65%' },
    chatTime: { fontSize: 11, color: COLORS.textMuted, fontWeight: '800' },

    inlineBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        borderWidth: 1,
    },
    inlineBadgeText: {
        fontSize: 8,
        fontWeight: '900',
    },
    archivedBadge: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    archivedBadgeText: {
        color: '#D97706',
        fontSize: 8,
        fontWeight: '900',
    },

    msgRow: { flexDirection: 'row', alignItems: 'center' },
    senderChip: {
        fontSize: 11,
        fontWeight: '900',
        color: '#2563EB',
        backgroundColor: '#EAF1FF',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        marginRight: 6,
        maxWidth: 80,
        overflow: 'hidden',
    },
    lastMsg: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', flex: 1 },
    lastMsgUnread: { color: COLORS.textPrimary, fontWeight: '800' },

    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    contactAvatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    contactAvatarText: {
        color: '#2563EB',
        fontWeight: '900',
        fontSize: 16,
    },
    contactDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 11,
        height: 11,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    contactInfo: {
        flex: 1,
        marginLeft: 14,
    },
    contactNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contactName: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textPrimary,
        maxWidth: '65%',
    },
    contactSub: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '600',
        marginTop: 2,
    },
    messageBtn: {
        padding: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
    },

    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 10,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default ChatScreen;
