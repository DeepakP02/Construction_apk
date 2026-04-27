import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, StatusBar, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { COLORS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getManagedProjectIdsForPm,
    getAllowedDmPeerIdsForPm,
    getDmPeerIdsForPmScopedToProject,
} from '../../utils/siteChatScope';

const { width } = Dimensions.get('window');

const ChatScreen = ({ navigation }) => {
    const { messages, projects, teamMembers, user, loading, jobs, tasks, resolveUser } = useApp();
    const [search, setSearch] = useState('');
    const [pmDmFilter, setPmDmFilter] = useState('all');

    const pmProjectIds = useMemo(() => getManagedProjectIdsForPm(projects, user), [projects, user]);

    const allowedDmIds = useMemo(() => {
        if (user?.role !== 'PM') return null;
        if (pmDmFilter === 'all') {
            return getAllowedDmPeerIdsForPm(projects, jobs, tasks, user);
        }
        return getDmPeerIdsForPmScopedToProject(projects, jobs, tasks, user, pmDmFilter);
    }, [user, projects, jobs, tasks, pmDmFilter]);

    const managedProjectsChips = useMemo(() => {
        if (user?.role !== 'PM' || !pmProjectIds) return [];
        return (projects || [])
            .filter((p) => pmProjectIds.has(String(p._id || p.id)))
            .map((p) => ({ id: String(p._id || p.id), name: p.name || 'Project' }));
    }, [user, projects, pmProjectIds]);

    const pmMemberRows = useMemo(() => {
        if (user?.role !== 'PM' || !allowedDmIds) return [];
        const known = new Map((teamMembers || []).map((m) => [String(m._id || m.id), m]));
        const rows = [];
        allowedDmIds.forEach((id) => {
            const sid = String(id);
            if (sid === String(user?._id)) return;
            const m = known.get(sid);
            if (m) {
                rows.push(m);
            } else {
                const r = resolveUser(sid);
                rows.push({ _id: id, name: r.fullName, fullName: r.fullName });
            }
        });
        return rows;
    }, [user, allowedDmIds, teamMembers, resolveUser]);

    const listSections = useMemo(() => {
        const isPm = user?.role === 'PM';

        const projectPool = isPm
            ? (projects || []).filter((p) => {
                const id = p._id || p.id;
                return id && pmProjectIds && pmProjectIds.has(String(id));
            })
            : (projects || []);

        const memberPool = isPm
            ? pmMemberRows
            : (teamMembers || []).filter((m) => m._id !== user?._id);

        const filteredProjects = projectPool.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));
        const filteredMembers = memberPool.filter((m) =>
            (m.fullName || m.name || '').toLowerCase().includes(search.toLowerCase())
        );

        const sections = [];

        if (!isPm) {
            sections.push({
                title: 'COMPANY CHANNELS',
                data: [{ _id: 'GENERAL_COMPANY', name: 'Global Site Discussion', type: 'general', icon: 'earth' }],
            });
        }

        sections.push({
            title: 'PROJECT ROOMS',
            data: filteredProjects.map((p) => ({ ...p, type: 'project' })),
        });
        sections.push({
            title: 'DIRECT MESSAGES',
            data: filteredMembers.map((m) => ({ ...m, name: m.fullName || m.name, type: 'private' })),
        });

        return sections;
    }, [user, projects, teamMembers, search, pmProjectIds, pmMemberRows]);

    const renderChatMember = ({ item }) => {
        let lastMsg = null;
        if (item.type === 'general') {
            lastMsg = (messages || []).find((m) => !m.projectId && !m.receiverId);
        } else if (item.type === 'project') {
            lastMsg = (messages || []).find((m) => m.projectId === (item._id || item.id));
        } else {
            lastMsg = (messages || []).find(
                (m) =>
                    (m.sender?._id === item._id ||
                        m.sender === item._id ||
                        m.senderId === item._id ||
                        m.receiverId === item._id) &&
                    !m.projectId
            );
        }

        const initial = (item.name || 'U').charAt(0).toUpperCase();

        const typeConfig = {
            general: { bg: '#EFF6FF', iconColor: '#2563EB', icon: 'domain' },
            project: { bg: '#ECFDF5', iconColor: '#10B981', icon: 'office-building' },
            private: { bg: '#F5F3FF', iconColor: '#8B5CF6', icon: 'account' },
        };
        const config = typeConfig[item.type];

        return (
            <TouchableOpacity
                style={styles.chatCard}
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
                <View style={[styles.avatarBox, { backgroundColor: config.bg }]}>
                    <Text style={[styles.avatarInitial, { color: config.iconColor }]}>{initial}</Text>
                    <View style={styles.statusDot} />
                </View>

                <View style={styles.chatInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.chatName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.chatTime}>
                            {lastMsg
                                ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                        </Text>
                    </View>
                    <View style={styles.msgRow}>
                        <MaterialCommunityIcons name={config.icon} size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                        <Text style={styles.lastMsg} numberOfLines={1}>
                            {lastMsg ? lastMsg.message || lastMsg.text : 'Start a new conversation...'}
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

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search chats or members..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {user?.role === 'PM' && managedProjectsChips.length > 0 && (
                <View style={styles.pmFilterSection}>
                    <Text style={styles.pmFilterLabel}>Message list by project (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pmChipScroll}>
                        <TouchableOpacity
                            style={[styles.pmChip, pmDmFilter === 'all' && styles.pmChipActive]}
                            onPress={() => setPmDmFilter('all')}
                        >
                            <Text style={[styles.pmChipText, pmDmFilter === 'all' && styles.pmChipTextActive]}>All contacts</Text>
                        </TouchableOpacity>
                        {managedProjectsChips.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[styles.pmChip, pmDmFilter === p.id && styles.pmChipActive]}
                                onPress={() => setPmDmFilter(p.id)}
                            >
                                <Text
                                    style={[styles.pmChipText, pmDmFilter === p.id && styles.pmChipTextActive]}
                                    numberOfLines={1}
                                >
                                    {p.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <SectionList
                sections={listSections}
                keyExtractor={(item, index) => item._id || item.id || index.toString()}
                renderItem={renderChatMember}
                renderSectionHeader={({ section: { title, data } }) =>
                    data.length > 0 ? (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
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

    pmFilterSection: { paddingLeft: 20, paddingBottom: 8, backgroundColor: '#FFFFFF' },
    pmFilterLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 8 },
    pmChipScroll: { flexDirection: 'row', alignItems: 'center', paddingRight: 20 },
    pmChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxWidth: width * 0.55,
        marginRight: 8,
    },
    pmChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    pmChipText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
    pmChipTextActive: { color: '#FFFFFF' },

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

    chatInfo: { flex: 1, marginLeft: 18 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    chatName: { fontSize: 17, fontWeight: '800', color: '#0F172A', maxWidth: '75%' },
    chatTime: { fontSize: 11, color: '#94A3B8', fontWeight: '800' },

    msgRow: { flexDirection: 'row', alignItems: 'center' },
    lastMsg: { fontSize: 13, color: '#64748B', fontWeight: '600', flex: 1 },
});

export default ChatScreen;
