import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    useWindowDimensions,
    ActivityIndicator,
    Image,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl } from '../../utils/api';

const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};
const getTaskParentRef = (t) =>
    t?.parentSubTaskId?._id ||
    t?.parentSubTaskId ||
    t?.parentTaskId?._id ||
    t?.parentTaskId ||
    t?.taskId?._id ||
    t?.taskId;

const ClientProgressScreen = ({ route, navigation }) => {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { rfis, refreshData } = useApp();
    const isCompact = width < 380;
    const isTablet = width >= 768;
    const { project } = route.params || {};
    const projectId = project?._id || project?.id;
    const [activeTab, setActiveTab] = useState('activity');

    const [loading, setLoading] = useState(true);
    const [bootstrapped, setBootstrapped] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [progressData, setProgressData] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [projectTasks, setProjectTasks] = useState([]);
    const [collapsedMainTaskIds, setCollapsedMainTaskIds] = useState(new Set());
    const isFetchingRef = useRef(false);

    const asList = (res) => {
        const d = res?.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        return [];
    };

    const buildHierarchyRows = useCallback((rows, pid) => {
        const all = Array.isArray(rows) ? rows : [];
        const byId = new Map(all.map((t) => [String(t._id || t.id), t]));
        const taskProjectRef = (t) =>
            t?.projectId?._id ||
            t?.projectId ||
            t?.taskId?.projectId?._id ||
            t?.taskId?.projectId ||
            t?.jobId?.projectId?._id ||
            t?.jobId?.projectId;

        const belongsToProject = (task) => {
            const ownProject = taskProjectRef(task);
            if (ownProject != null && String(ownProject) === String(pid)) return true;

            let cursor = task;
            let hop = 0;
            while (cursor && hop < 12) {
                const parentRef = getTaskParentRef(cursor);
                if (!parentRef) break;
                const parent = byId.get(String(parentRef));
                if (!parent) break;
                const parentProject = taskProjectRef(parent);
                if (parentProject != null && String(parentProject) === String(pid)) return true;
                cursor = parent;
                hop += 1;
            }
            return false;
        };

        const relevant = all.filter((t) => belongsToProject(t));
        const relevantIds = new Set(relevant.map((t) => String(t._id || t.id)));
        const childrenByParent = new Map();
        const roots = [];

        relevant.forEach((task) => {
            const parentRaw = getTaskParentRef(task);
            const parentId = parentRaw != null ? String(parentRaw) : '';
            if (parentId && relevantIds.has(parentId)) {
                const list = childrenByParent.get(parentId) || [];
                list.push(task);
                childrenByParent.set(parentId, list);
            } else {
                roots.push(task);
            }
        });

        const sortTasks = (list) =>
            [...list].sort((a, b) => {
                const pathA = String(a.path || '');
                const pathB = String(b.path || '');
                if (pathA && pathB && pathA !== pathB) return pathA.localeCompare(pathB);
                const posA = Number(a.position ?? 0);
                const posB = Number(b.position ?? 0);
                if (posA !== posB) return posA - posB;
                return String(a.title || '').localeCompare(String(b.title || ''));
            });

        const ordered = [];
        const walk = (node, level = 0) => {
            ordered.push({ ...node, _level: level });
            const id = String(node._id || node.id);
            const kids = sortTasks(childrenByParent.get(id) || []);
            kids.forEach((k) => walk(k, level + 1));
        };

        sortTasks(roots).forEach((r) => walk(r, 0));
        return ordered;
    }, []);

    const load = useCallback(async ({ withLoader = false } = {}) => {
        if (!projectId) {
            setLoading(false);
            return;
        }
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            if (withLoader) setLoading(true);
            const tasksReq = api
                .get(`/tasks/project/${projectId}`)
                .catch(() => api.get('/tasks', { params: { projectId } }));
            const [progRes, updateRes, tasksRes] = await Promise.all([
                api.get(`/projects/${projectId}/client-progress`),
                api.get(`/projects/${projectId}/client-updates`),
                tasksReq,
            ]);
            setProgressData(progRes.data);
            setUpdates(Array.isArray(updateRes.data) ? updateRes.data : []);
            const rootTasks = asList(tasksRes).map((t) => ({ ...t, _id: t._id || t.id }));

            // Mirror web hierarchy: fetch subtasks from each root task endpoint.
            const subTaskBatches = await Promise.all(
                rootTasks.map(async (root) => {
                    const rootId = root?._id || root?.id;
                    if (!rootId) return [];
                    try {
                        const subRes = await api.get(`/tasks/${rootId}/subtasks`);
                        return asList(subRes).map((s) => ({
                            ...s,
                            _id: s._id || s.id,
                            taskId: s.taskId || rootId,
                            projectId: s.projectId || root.projectId,
                        }));
                    } catch {
                        return [];
                    }
                })
            );
            const flatRows = [...rootTasks, ...subTaskBatches.flat()];
            setProjectTasks(buildHierarchyRows(flatRows, projectId));
            setBootstrapped(true);
        } catch (e) {
            console.warn('Client progress fetch:', e?.response?.data || e?.message);
            setProgressData(null);
            setUpdates([]);
            setProjectTasks([]);
            setBootstrapped(true);
        } finally {
            if (withLoader) setLoading(false);
            isFetchingRef.current = false;
        }
    }, [projectId, buildHierarchyRows]);

    const visibleProjectTasks = useMemo(() => {
        const all = Array.isArray(projectTasks) ? projectTasks : [];
        if (collapsedMainTaskIds.size === 0) return all;
        const byId = new Map(all.map((t) => [String(t._id || t.id), t]));
        return all.filter((task) => {
            const level = task._level || 0;
            if (level === 0) return true;
            let cursor = task;
            let hop = 0;
            while (cursor && hop < 12) {
                const parentId = getTaskParentRef(cursor);
                if (!parentId) break;
                const parent = byId.get(String(parentId));
                if (!parent) break;
                if ((parent._level || 0) === 0 && collapsedMainTaskIds.has(String(parent._id || parent.id))) {
                    return false;
                }
                cursor = parent;
                hop += 1;
            }
            return true;
        });
    }, [projectTasks, collapsedMainTaskIds]);
    const tableLayout = useMemo(() => {
        const task = width < 420 ? 320 : 380;
        return {
            task,
            priority: 95,
            progress: 85,
            status: 120,
            minWidth: task + 95 + 85 + 120,
        };
    }, [width]);

    useEffect(() => {
        // Initial screen load only once per project change.
        setBootstrapped(false);
        load({ withLoader: true });
    }, [projectId, load]);

    useEffect(() => {
        // Silent refresh on focus to keep backend-synced data fresh.
        const unsubscribe = navigation.addListener('focus', () => {
            load({ withLoader: false });
        });
        return unsubscribe;
    }, [navigation, load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Manual hard sync only when user explicitly pulls.
            await refreshData?.();
            await load({ withLoader: false });
        } finally {
            setRefreshing(false);
        }
    }, [load, refreshData]);

    const displayName = progressData?.projectName || project?.name || 'Project';
    const statusRaw = (progressData?.status || project?.status || 'planning').toString();
    const rfiList = (rfis || []).filter((r) => {
        const rawProjectId = r?.projectId?._id || r?.projectId || r?.project?._id || r?.project;
        return rawProjectId != null && String(rawProjectId) === String(projectId);
    });
    if (!projectId) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <Text style={styles.centerMsgTxt}>Missing project.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <Text style={styles.linkBack}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (loading && !bootstrapped) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={[styles.centerMsgTxt, { marginTop: 12 }]}>Loading live progress…</Text>
            </View>
        );
    }

    if (!progressData) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <Text style={styles.centerMsgTxt}>Could not load progress for this project.</Text>
                <TouchableOpacity onPress={load} style={{ marginTop: 16 }}>
                    <Text style={styles.linkBack}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 8 }}>
                    <Text style={styles.linkBack}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: isCompact ? 12 : 20 }]}>
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
                    </TouchableOpacity>
                    <View style={[styles.projectHeaderInfo, { flexWrap: 'wrap' }]}>
                        <Text style={[styles.projectName, { fontSize: isCompact ? 22 : 28 }]} numberOfLines={2}>
                            {displayName}
                        </Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{statusRaw.replace(/_/g, ' ').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.breadcrumbRow}>
                    <MaterialCommunityIcons name="pulse" size={16} color="#3B82F6" />
                    <Text style={styles.breadcrumbText}>LIVE WORK PROGRESS VIEW</Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingHorizontal: isCompact ? 12 : 16, maxWidth: isTablet ? 980 : undefined, alignSelf: 'center', width: '100%' },
                ]}
            >
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tabChip, activeTab === 'activity' && styles.tabChipActive]}
                        onPress={() => setActiveTab('activity')}
                    >
                        <Text style={[styles.tabChipText, activeTab === 'activity' && styles.tabChipTextActive]}>
                            Recent Site Activity
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabChip, activeTab === 'deliverables' && styles.tabChipActive]}
                        onPress={() => setActiveTab('deliverables')}
                    >
                        <Text style={[styles.tabChipText, activeTab === 'deliverables' && styles.tabChipTextActive]}>
                            Project Deliverables & Tasks
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabChip, activeTab === 'rfis' && styles.tabChipActive]}
                        onPress={() => setActiveTab('rfis')}
                    >
                        <Text style={[styles.tabChipText, activeTab === 'rfis' && styles.tabChipTextActive]}>Project RFIs</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'activity' ? (
                    <>
                        <View style={styles.activityHeader}>
                            <MaterialCommunityIcons name="comment-outline" size={18} color="#3B82F6" />
                            <Text style={styles.activitySectionTitle}>Recent site activity</Text>
                        </View>

                        {updates.length === 0 ? (
                            <View style={styles.emptyActivityBox}>
                                <MaterialCommunityIcons name="comment-text-outline" size={32} color="#E2E8F0" style={{ marginBottom: 16 }} />
                                <Text style={styles.emptyActivityText}>NO UPDATES POSTED YET.</Text>
                            </View>
                        ) : (
                            <View style={{ gap: 16, marginBottom: 24 }}>
                                {updates.map((update) => (
                                    <View key={update._id || update.id} style={[styles.updateCard, SHADOWS.small]}>
                                        <View style={styles.updateCardHead}>
                                            <Text style={styles.updateTitle} numberOfLines={2}>
                                                {update.title || 'Update'}
                                            </Text>
                                            <Text style={styles.updateDatePill}>{fmtDate(update.date)}</Text>
                                        </View>
                                        <Text style={styles.updateBody}>{update.description}</Text>
                                        {update.images?.length > 0 ? (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                                                {update.images.map((img, i) => (
                                                    <Image
                                                        key={i}
                                                        source={{ uri: getServerUrl(img) || img }}
                                                        style={styles.updateThumb}
                                                    />
                                                ))}
                                            </ScrollView>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                ) : activeTab === 'deliverables' ? (
                    <View style={{ gap: 12, marginBottom: 24 }}>
                        <View style={[styles.tableCard, SHADOWS.small]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={{ minWidth: Math.max(width - (isCompact ? 40 : 52), tableLayout.minWidth) }}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.tableHeadTxt, { width: tableLayout.task }]}>Task Details</Text>
                                        <Text style={[styles.tableHeadTxt, styles.tableHeadCenter, { width: tableLayout.priority }]}>Priority</Text>
                                        <Text style={[styles.tableHeadTxt, styles.tableHeadCenter, { width: tableLayout.progress }]}>Progress</Text>
                                        <Text style={[styles.tableHeadTxt, styles.tableHeadCenter, { width: tableLayout.status }]}>Status</Text>
                                    </View>
                                    {visibleProjectTasks.length === 0 ? (
                                        <Text style={styles.emptyNoteText}>No project tasks found.</Text>
                                    ) : (
                                        visibleProjectTasks.map((task) => {
                                    const status = String(task.status || 'todo')
                                        .replace(/_/g, ' ')
                                        .toLowerCase();
                                    const progressVal = Number(task.progress ?? task.progressPercentage ?? 0);
                                    const safeProgress = Number.isFinite(progressVal)
                                        ? Math.max(0, Math.min(100, Math.round(progressVal)))
                                        : 0;
                                    const level = task._level || 0;
                                    const leftPad = 8 + (level * 14);
                                    const levelLabel =
                                        level === 0 ? 'Main task' : level === 1 ? 'Subtask' : `Nested subtask L${level}`;
                                    const id = String(task._id || task.id);
                                    const hasChildren = projectTasks.some(
                                        (t) => (t._level || 0) > level && String(getTaskParentRef(t) || '') === id
                                    );
                                    const isCollapsed = collapsedMainTaskIds.has(id);
                                    return (
                                        <View
                                            key={task._id || task.id}
                                            style={[styles.tableDataRow, level === 0 && styles.mainTaskDataRow]}
                                        >
                                            <View style={{ width: tableLayout.task, paddingLeft: leftPad }}>
                                                {level === 0 ? (
                                                    <TouchableOpacity
                                                        style={styles.mainTaskRow}
                                                        activeOpacity={hasChildren ? 0.7 : 1}
                                                        onPress={() => {
                                                            if (!hasChildren) return;
                                                            setCollapsedMainTaskIds((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(id)) next.delete(id);
                                                                else next.add(id);
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        {hasChildren ? (
                                                            <MaterialCommunityIcons
                                                                name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                                                                size={16}
                                                                color="#64748B"
                                                            />
                                                        ) : (
                                                            <View style={{ width: 16 }} />
                                                        )}
                                                        <Text style={styles.taskCell} numberOfLines={2}>
                                                            {task.title}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <Text style={styles.subTaskCell} numberOfLines={2}>
                                                        {level > 0 ? `↳ ${task.title}` : task.title}
                                                    </Text>
                                                )}
                                                <Text style={[styles.levelPill, level === 0 && styles.levelPillMain]}>{levelLabel}</Text>
                                            </View>
                                            <Text style={[styles.cellTxt, styles.cellCenter, { width: tableLayout.priority }]} numberOfLines={1}>
                                                {task.priority || 'Medium'}
                                            </Text>
                                            <Text style={[styles.cellTxt, styles.cellCenter, { width: tableLayout.progress }]}>{safeProgress}%</Text>
                                            <Text style={[styles.cellTxt, styles.cellCenter, { width: tableLayout.status }]} numberOfLines={1}>
                                                {status}
                                            </Text>
                                        </View>
                                    );
                                        })
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                ) : (
                    <View style={{ gap: 12, marginBottom: 24 }}>
                        {rfiList.length === 0 ? (
                            <View style={styles.emptyActivityBox}>
                                <MaterialCommunityIcons name="file-question-outline" size={32} color="#E2E8F0" style={{ marginBottom: 16 }} />
                                <Text style={styles.emptyActivityText}>NO PROJECT RFIS FOUND.</Text>
                            </View>
                        ) : (
                            rfiList.map((rfi) => (
                                <View key={rfi._id || rfi.id} style={[styles.updateCard, SHADOWS.small]}>
                                    <View style={styles.updateCardHead}>
                                        <Text style={styles.updateTitle} numberOfLines={2}>
                                            {rfi.subject || rfi.title || 'RFI'}
                                        </Text>
                                        <Text style={styles.updateDatePill}>{(rfi.status || 'open').toString().toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.updateBody}>
                                        Priority: {(rfi.priority || 'normal').toString()} {rfi.dueDate ? `• Due ${fmtDate(rfi.dueDate)}` : ''}
                                    </Text>
                                </View>
                            ))
                        )}
                        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('RFIList')}>
                            <Text style={styles.linkBtnText}>Open full RFI list</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: Math.max(insets.bottom + 60, 100) }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centerMsg: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    centerMsgTxt: { fontSize: 15, fontWeight: '700', color: '#64748B', textAlign: 'center' },
    linkBack: { fontWeight: '900', color: '#2563EB', fontSize: 14 },
    header: { paddingHorizontal: 20, backgroundColor: '#FFFFFF', paddingBottom: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'left' },
    projectHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    projectName: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, flex: 1 },
    statusBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 10, fontWeight: '900', color: '#1D4ED8', letterSpacing: 0.5 },
    breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, opacity: 0.8 },
    breadcrumbText: { fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1 },

    scrollContent: { padding: 16 },
    tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tabChip: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tabChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    tabChipText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    tabChipTextActive: { color: '#1D4ED8' },
    activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 16 },
    activitySectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    emptyActivityBox: {
        height: 180,
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyActivityText: { fontSize: 10, fontWeight: '900', color: '#CBD5E1', letterSpacing: 1 },
    updateCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    updateCardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
    updateTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0F172A' },
    updateDatePill: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    updateBody: { fontSize: 13, color: '#475569', lineHeight: 20, fontWeight: '600' },
    updateThumb: { width: 72, height: 72, borderRadius: 12, marginRight: 8, backgroundColor: '#F1F5F9' },
    tableCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 6,
    },
    tableHeadTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    tableHeadCenter: { textAlign: 'center' },
    tableDataRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    mainTaskDataRow: {
        backgroundColor: '#FCFDFF',
    },
    taskCol: { flex: 2.8 },
    priorityCol: { flex: 1.1 },
    progressCol: { flex: 0.9 },
    statusCol: { flex: 1.2 },
    taskCell: { fontSize: 13, fontWeight: '900', color: '#0F172A', paddingRight: 8 },
    subTaskCell: { fontSize: 12, fontWeight: '700', color: '#334155', paddingRight: 8 },
    mainTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    levelPill: {
        alignSelf: 'flex-start',
        marginTop: 3,
        fontSize: 8,
        fontWeight: '800',
        color: '#64748B',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
        textTransform: 'uppercase',
    },
    levelPillMain: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        color: '#1D4ED8',
    },
    cellCenter: { textAlign: 'center' },
    cellTxt: { fontSize: 12, color: '#475569', fontWeight: '600', textTransform: 'capitalize' },
    emptyNoteText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', fontWeight: '600' },
    linkBtn: {
        marginTop: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingVertical: 10,
        alignItems: 'center',
    },
    linkBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '900' },
});

export default ClientProgressScreen;
