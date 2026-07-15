import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, FlatList, StatusBar, ActivityIndicator, Dimensions, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const TABS = [
    { id: 'TASKS', icon: 'clipboard-check-outline', label: 'TASKS' },
    { id: 'HISTORY', icon: 'history', label: 'HISTORY' },
    { id: 'NOTES', icon: 'note-text-outline', label: 'NOTES' }
];

const SubcontractorJobDetailsScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { job } = route.params;
    const { tasks, projects } = useApp();
    const [activeTab, setActiveTab] = useState('TASKS');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusScope, setStatusScope] = useState('all');
    const [prioScope, setPrioScope] = useState('all');
    const [jobNotes, setJobNotes] = useState([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    const jobId = job._id || job.id;
    const projRef = job.projectId?._id || job.projectId;
    const project = projects.find((p) => String(p._id || p.id) === String(projRef || ''));

    const jobTasks = useMemo(() => {
        const idStr = String(jobId || '');
        return (tasks || []).filter((t) => {
            const tJob = t.jobId?._id || t.jobId;
            if (tJob != null && String(tJob) === idStr) return true;
            if (job.name && t.job === job.name) return true;
            return false;
        });
    }, [tasks, jobId, job.name]);

    const completedTasks = jobTasks.filter((t) => t.status === 'completed' || t.status === 'done').length;
    const workersRaw = job.assignedWorkers || job.assignedTo || [];
    const assignedWorkers = Array.isArray(workersRaw) ? workersRaw : [];

    const filteredTasks = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return jobTasks.filter((t) => {
            if (q) {
                const title = (t.title || '').toLowerCase();
                const desc = (t.description || '').toLowerCase();
                if (!title.includes(q) && !desc.includes(q)) return false;
            }
            const st = String(t.status || '').toLowerCase();
            const done = st === 'completed' || st === 'done';
            if (statusScope === 'active' && done) return false;
            if (statusScope === 'done' && !done) return false;
            if (prioScope === 'high' && String(t.priority) !== 'High') return false;
            return true;
        });
    }, [jobTasks, searchQuery, statusScope, prioScope]);

    const completedHistory = useMemo(() => {
        return jobTasks
            .filter((t) => {
                const st = String(t.status || '').toLowerCase();
                return st === 'completed' || st === 'done';
            })
            .sort(
                (a, b) =>
                    new Date(b.updatedAt || b.completedAt || b.createdAt || 0) -
                    new Date(a.updatedAt || a.completedAt || a.createdAt || 0)
            );
    }, [jobTasks]);

    const fetchNotes = useCallback(async () => {
        if (!jobId) return;
        setNotesLoading(true);
        try {
            const res = await api.get(`/jobs/${jobId}/notes`);
            setJobNotes(Array.isArray(res.data) ? res.data : []);
        } catch {
            setJobNotes([]);
        } finally {
            setNotesLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (activeTab !== 'NOTES' || !jobId) return;
        fetchNotes();
    }, [activeTab, jobId, fetchNotes]);

    const cycleStatusFilter = () => {
        setStatusScope((s) => (s === 'all' ? 'active' : s === 'active' ? 'done' : 'all'));
    };

    const cyclePrioFilter = () => {
        setPrioScope((p) => (p === 'all' ? 'high' : 'all'));
    };

    const statusFilterLabel =
        statusScope === 'all' ? 'ALL' : statusScope === 'active' ? 'ACTIVE' : 'DONE';
    const prioFilterLabel = prioScope === 'high' ? 'HIGH' : 'ALL';

    const submitNote = async () => {
        const content = noteDraft.trim();
        if (!content || !jobId) return;
        setSavingNote(true);
        try {
            await api.post(`/jobs/${jobId}/notes`, { content });
            setNoteDraft('');
            await fetchNotes();
        } catch {
            Alert.alert('Error', 'Could not save note.');
        } finally {
            setSavingNote(false);
        }
    };

    const renderTaskItem = ({ item }) => {
        const assignee = Array.isArray(item.assignedTo) ? item.assignedTo[0] : item.assignedTo;
        const initial = (assignee?.fullName || assignee?.name || 'U').charAt(0);
        const statusShort = String(item.status || 'todo')
            .substring(0, 4)
            .toUpperCase();
        return (
            <View style={styles.tableRow}>
                <View style={[styles.col, { flex: isSmallDevice ? 1.2 : 1.5 }]}>
                    <View
                        style={[
                            styles.statusPill,
                            {
                                backgroundColor:
                                    item.status === 'completed' || item.status === 'done'
                                        ? '#DCFCE7'
                                        : '#F1F5F9'
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusText,
                                {
                                    color:
                                        item.status === 'completed' || item.status === 'done'
                                            ? '#16A34A'
                                            : '#64748B'
                                }
                            ]}
                        >
                            {statusShort}
                        </Text>
                    </View>
                </View>
                <View style={[styles.col, { flex: 3 }]}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                        {item.title}
                    </Text>
                </View>
                <View style={[styles.col, { flex: 1.5, alignItems: 'center' }]}>
                    <View style={styles.avatarMini}>
                        <Text style={styles.avatarTxt}>{initial}</Text>
                    </View>
                </View>
                <View style={[styles.col, { flex: 1.2, alignItems: 'flex-end' }]}>
                    <Text
                        style={[
                            styles.priorityTxt,
                            { color: item.priority === 'High' ? '#EF4444' : '#64748B' }
                        ]}
                    >
                        {item.priority?.substring(0, 3) || 'Med'}
                    </Text>
                </View>
            </View>
        );
    };

    const renderHistoryItem = ({ item }) => (
        <View style={styles.historyRow}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.historyTitle} numberOfLines={2}>
                    {item.title}
                </Text>
                <Text style={styles.historyMeta}>
                    {item.updatedAt || item.completedAt || item.createdAt
                        ? new Date(item.updatedAt || item.completedAt || item.createdAt).toLocaleString()
                        : 'Completed'}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <View style={styles.backCircle}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color="#1E293B" />
                    </View>
                    <Text style={styles.backText}>BACK TO JOB ASSIGNMENTS</Text>
                </TouchableOpacity>

                <View style={[styles.titleRow, { flexWrap: 'wrap' }]}>
                    <Text style={styles.jobName}>{job.name}</Text>
                    <View style={styles.planBadge}>
                        <Text style={styles.planText}>{(job.status || 'PLANNING').toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.locRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color="#94A3B8" />
                    <Text style={styles.locText} numberOfLines={1}>
                        {project?.name || 'No location set'}
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <View style={styles.metricsContainer}>
                    <View style={styles.metricRow}>
                        <View
                            style={[
                                styles.metricCard,
                                SHADOWS.small,
                                { backgroundColor: '#EFF6FF' }
                            ]}
                        >
                            <View style={styles.mIconHeader}>
                                <Text style={styles.pChartText}>{job.progress || 0}%</Text>
                                <MaterialCommunityIcons
                                    name="chart-pie"
                                    size={isSmallDevice ? 14 : 16}
                                    color="#2563EB"
                                />
                            </View>
                            <Text style={styles.mLabel}>PROGRESS</Text>
                            <Text style={styles.mVal}>{job.progress || 0}%</Text>
                        </View>

                        <View
                            style={[
                                styles.metricCard,
                                SHADOWS.small,
                                { backgroundColor: '#FFF7ED' }
                            ]}
                        >
                            <View style={styles.mIconHeader}>
                                <MaterialCommunityIcons
                                    name="check-circle-outline"
                                    size={isSmallDevice ? 16 : 18}
                                    color="#EA580C"
                                />
                                <Text style={styles.mValSmall}>
                                    {completedTasks}/{jobTasks.length}
                                </Text>
                            </View>
                            <Text style={styles.mLabel}>TASKS</Text>
                            <Text style={styles.mVal}>Overview</Text>
                        </View>

                        <View
                            style={[
                                styles.metricCard,
                                SHADOWS.small,
                                { backgroundColor: '#F0FDF4' }
                            ]}
                        >
                            <View style={styles.mIconHeader}>
                                <MaterialCommunityIcons
                                    name="account-group-outline"
                                    size={isSmallDevice ? 16 : 18}
                                    color="#10B981"
                                />
                                <Text style={styles.mValSmall}>{assignedWorkers.length}</Text>
                            </View>
                            <Text style={styles.mLabel}>TEAM</Text>
                            <Text style={styles.mVal}>Staff</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.tabContainer, SHADOWS.small]}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <MaterialCommunityIcons
                                name={tab.icon}
                                size={isSmallDevice ? 12 : 14}
                                color={activeTab === tab.id ? '#2563EB' : '#94A3B8'}
                            />
                            <Text
                                style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTab === 'TASKS' && (
                    <>
                        <View style={styles.taskHeader}>
                            <View style={styles.searchBar}>
                                <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                                <TextInput
                                    placeholder="Search tasks..."
                                    style={styles.searchInput}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            <View style={styles.filterRow}>
                                <TouchableOpacity style={styles.filterBtn} onPress={cycleStatusFilter}>
                                    <MaterialCommunityIcons name="tune-variant" size={12} color="#475569" />
                                    <Text style={styles.filterBtnTxt}>{statusFilterLabel}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.filterBtn} onPress={cyclePrioFilter}>
                                    <Text style={styles.filterBtnTxt}>PRIO: {prioFilterLabel}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeadTxt, { flex: isSmallDevice ? 1.2 : 1.5 }]}>
                                STATUS
                            </Text>
                            <Text style={[styles.tableHeadTxt, { flex: 3 }]}>TASKS</Text>
                            <Text
                                style={[styles.tableHeadTxt, { flex: 1.5, textAlign: 'center' }]}
                            >
                                TEAM
                            </Text>
                            <Text style={[styles.tableHeadTxt, { flex: 1.2, textAlign: 'right' }]}>
                                PRIO
                            </Text>
                        </View>

                        <FlatList
                            data={filteredTasks}
                            keyExtractor={(item) => String(item._id || item.id)}
                            renderItem={renderTaskItem}
                            scrollEnabled={false}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>No tasks match your filters.</Text>
                                </View>
                            }
                        />
                    </>
                )}

                {activeTab === 'HISTORY' && (
                    <View style={styles.panelPad}>
                        <FlatList
                            data={completedHistory}
                            keyExtractor={(item) => String(item._id || item.id)}
                            renderItem={renderHistoryItem}
                            scrollEnabled={false}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>No completed tasks for this job yet.</Text>
                                </View>
                            }
                        />
                    </View>
                )}

                {activeTab === 'NOTES' && (
                    <View style={styles.panelPad}>
                        <View style={styles.noteComposer}>
                            <TextInput
                                style={styles.noteInput}
                                placeholder="Add a site note..."
                                value={noteDraft}
                                onChangeText={setNoteDraft}
                                multiline
                                placeholderTextColor="#94A3B8"
                            />
                            <TouchableOpacity
                                style={[
                                    styles.noteSaveBtn,
                                    (!noteDraft.trim() || savingNote) && { opacity: 0.5 }
                                ]}
                                disabled={!noteDraft.trim() || savingNote}
                                onPress={submitNote}
                            >
                                {savingNote ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.noteSaveTxt}>SAVE NOTE</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {notesLoading ? (
                            <ActivityIndicator style={{ marginTop: 24 }} color="#2563EB" />
                        ) : jobNotes.length === 0 ? (
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>No notes yet.</Text>
                            </View>
                        ) : (
                            jobNotes.map((n) => (
                                <View key={String(n._id)} style={styles.noteCard}>
                                    <Text style={styles.noteAuthor}>
                                        {n.createdBy?.fullName || 'User'}
                                    </Text>
                                    <Text style={styles.noteDate}>
                                        {n.createdAt
                                            ? new Date(n.createdAt).toLocaleString()
                                            : ''}
                                    </Text>
                                    <Text style={styles.noteBody}>{n.content}</Text>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: SPACING.m, backgroundColor: COLORS.surface, paddingBottom: 12 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    backCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    backText: { fontSize: 9, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 0.8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s, marginBottom: 4 },
    jobName: { fontSize: isSmallDevice ? 18 : 22, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -1 },
    planBadge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.surfaceSecondary, borderRadius: SIZES.radiusCard },
    planText: { fontSize: 8, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 1 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },

    metricsContainer: { paddingHorizontal: SPACING.m, marginTop: 10 },
    metricRow: { flexDirection: 'row', gap: isSmallDevice ? 6 : 8 },
    metricCard: {
        flex: 1,
        padding: isSmallDevice ? 10 : 12,
        borderRadius: SIZES.radiusCard,
        justifyContent: 'space-between',
        height: isSmallDevice ? 85 : 95
    },
    mIconHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pChartText: { fontSize: isSmallDevice ? 10 : 12, fontWeight: '900', color: '#2563EB' },
    mLabel: { fontSize: 8, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 0.5, marginTop: 8 },
    mVal: { fontSize: isSmallDevice ? 11 : 12, fontWeight: '900', color: COLORS.textPrimary },
    mValSmall: { fontSize: 10, fontWeight: '900', color: COLORS.textSecondary },

    tabContainer: {
        marginHorizontal: 16,
        marginVertical: 12,
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusCard,
        flexDirection: 'row',
        padding: 4,
        justifyContent: 'space-between'
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: SIZES.radiusBtn,
        justifyContent: 'center'
    },
    tabActive: { backgroundColor: COLORS.surfaceSecondary },
    tabText: { fontSize: isSmallDevice ? 8 : 9, fontWeight: '900', color: COLORS.textMuted },
    tabTextActive: { color: '#2563EB' },

    taskHeader: { paddingHorizontal: SPACING.m, gap: 10, marginBottom: 12 },
    searchBar: {
        height: 44,
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusBtn,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
    filterRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.s },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8
    },
    filterBtnTxt: { fontSize: 8, fontWeight: '900', color: COLORS.textSecondary },

    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    tableHeadTxt: { fontSize: 8, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.5 },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.m,
        paddingVertical: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceSecondary,
        alignItems: 'center'
    },
    col: { justifyContent: 'center' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 7, fontWeight: '900' },
    taskTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
    avatarMini: {
        width: 22,
        height: 22,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarTxt: { fontSize: 9, fontWeight: '900', color: COLORS.textSecondary },
    priorityTxt: { fontSize: 9, fontWeight: '900' },

    panelPad: { paddingHorizontal: SPACING.m, paddingTop: 4 },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 14,
        borderRadius: SIZES.radiusBtn,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    historyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    historyMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },

    noteComposer: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusBtn,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.m
    },
    noteInput: {
        minHeight: 72,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlignVertical: 'top'
    },
    noteSaveBtn: {
        marginTop: 10,
        backgroundColor: '#2563EB',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center'
    },
    noteSaveTxt: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
    noteCard: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusBtn,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    noteAuthor: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
    noteDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
    noteBody: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

    empty: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '700' }
});

export default SubcontractorJobDetailsScreen;
