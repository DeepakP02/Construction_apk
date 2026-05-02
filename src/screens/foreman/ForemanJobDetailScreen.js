import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Animated,
    StatusBar,
    RefreshControl,
    ScrollView,
    Modal,
    ActivityIndicator,
    Alert,
    Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { SHADOWS, contentBottomForTabBar } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../utils/api';

const TABS = ['TASKS', 'HISTORY', 'NOTES'];

const TASK_STATUS_FILTER = ['ALL', 'PENDING', 'IN PROGRESS', 'DONE'];

function canonicalJobStatus(raw) {
    const x = String(raw || 'planning')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
    if (x === 'on_hold' || x === 'onhold' || x === 'hold') return 'on-hold';
    if (['planning', 'todo', 'pending'].includes(x)) return 'planning';
    if (x === 'in_progress' || x === 'inprogress') return 'active';
    if (x === 'done') return 'completed';
    if (['active', 'completed'].includes(x)) return x === 'active' ? 'active' : 'completed';
    return 'planning';
}

function jobStatusLabel(raw) {
    const c = canonicalJobStatus(raw);
    if (c === 'completed') return 'DONE';
    if (c === 'on-hold') return 'ON HOLD';
    if (c === 'active') return 'LIVE';
    return 'PLANNING';
}

function normalizeJobTaskStatus(s) {
    return String(s || 'pending').toLowerCase();
}

function jobTaskMatchesStatusFilter(item, filterKey) {
    const st = normalizeJobTaskStatus(item.status);
    if (filterKey === 'ALL') return true;
    if (filterKey === 'PENDING') return st === 'pending';
    if (filterKey === 'IN PROGRESS') return st === 'in_progress';
    if (filterKey === 'DONE') return st === 'completed';
    return true;
}

function walkSubRows(parentKey, depth, all, expanded, out) {
    const children = all.filter((s) => {
        if (!s?.isSubTask) return false;
        if (depth === 0) return String(s.taskId) === parentKey && !s.parentSubTaskId;
        return String(s.parentSubTaskId || '') === parentKey;
    });
    children.sort((a, b) => (a.position || 0) - (b.position || 0));
    children.forEach((ch) => {
        const id = String(ch._id || ch.id);
        out.push({ item: ch, depth: depth + 1, kind: 'subtask' });
        if (expanded.has(id)) walkSubRows(id, depth + 1, all, expanded, out);
    });
}

function buildVisibleTaskRows(roots, all, expanded) {
    const out = [];
    roots.forEach((r) => {
        const rid = String(r._id || r.id);
        out.push({ item: r, depth: 0, kind: 'jobtask' });
        if (expanded.has(rid)) walkSubRows(rid, 0, all, expanded, out);
    });
    return out;
}

function formatTitleCaseLoc(loc) {
    if (!loc || typeof loc !== 'string') return 'Site location';
    return loc
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

const ForemanJobDetailScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const { jobId: rawJobId } = route.params || {};
    const jobId = rawJobId != null ? String(rawJobId) : '';

    const { jobs, refreshData } = useApp();
    const [job, setJob] = useState({});
    const [jobTaskRows, setJobTaskRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('TASKS');
    const [search, setSearch] = useState('');
    const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
    const [filterModal, setFilterModal] = useState(false);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [historyPayload, setHistoryPayload] = useState(null);
    const [notes, setNotes] = useState([]);
    const [noteDraft, setNoteDraft] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [notesLoading, setNotesLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const jobFromList = useMemo(
        () => (jobs || []).find((j) => String(j._id || j.id) === jobId) || {},
        [jobs, jobId]
    );

    const effectiveJob = job?.name || job?.title ? job : jobFromList;

    const loadJobMeta = useCallback(async () => {
        if (!jobId) return;
        try {
            const res = await api.get(`/jobs/${jobId}`);
            if (res.data) setJob(res.data);
        } catch (e) {
            setJob(jobFromList);
        }
    }, [jobId, jobFromList]);

    const loadJobTasks = useCallback(async () => {
        if (!jobId) return;
        const res = await api.get(`/job-tasks/job/${jobId}`);
        const list = Array.isArray(res.data) ? res.data : [];
        setJobTaskRows(list);
    }, [jobId]);

    const loadHistory = useCallback(async () => {
        if (!jobId) return;
        setHistoryLoading(true);
        try {
            const res = await api.get(`/jobs/${jobId}/full-history`);
            setHistoryPayload(res.data || null);
        } catch (e) {
            setHistoryPayload(null);
        } finally {
            setHistoryLoading(false);
        }
    }, [jobId]);

    const loadNotes = useCallback(async () => {
        if (!jobId) return;
        setNotesLoading(true);
        try {
            const res = await api.get(`/jobs/${jobId}/notes`);
            setNotes(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setNotes([]);
        } finally {
            setNotesLoading(false);
        }
    }, [jobId]);

    const loadAll = useCallback(async () => {
        if (!jobId) return;
        setLoading(true);
        try {
            await Promise.all([loadJobMeta(), loadJobTasks(), loadNotes()]);
        } finally {
            setLoading(false);
        }
    }, [jobId, loadJobMeta, loadJobTasks, loadNotes]);

    useEffect(() => {
        loadAll();
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, [loadAll, fadeAnim]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', () => {
            loadAll();
            if (activeTab === 'HISTORY') loadHistory();
        });
        return unsub;
    }, [navigation, loadAll, loadHistory, activeTab]);

    useEffect(() => {
        if (activeTab === 'HISTORY' && !historyPayload && !historyLoading) loadHistory();
    }, [activeTab, historyPayload, historyLoading, loadHistory]);

    useEffect(() => {
        if (activeTab === 'NOTES' && jobId) loadNotes();
    }, [activeTab, jobId, loadNotes]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadJobTasks(), loadJobMeta(), refreshData(), activeTab === 'NOTES' ? loadNotes() : Promise.resolve(), activeTab === 'HISTORY' ? loadHistory() : Promise.resolve()]);
        setRefreshing(false);
    };

    const roots = useMemo(() => {
        const list = jobTaskRows || [];
        return list.filter((x) => !x.isSubTask).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }, [jobTaskRows]);

    const filteredRoots = useMemo(() => {
        return roots.filter((t) => {
            const q = search.toLowerCase().trim();
            const title = (t.title || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const matchQ = !q || title.includes(q) || desc.includes(q);
            return matchQ && jobTaskMatchesStatusFilter(t, taskStatusFilter);
        });
    }, [roots, search, taskStatusFilter]);

    const visibleRows = useMemo(
        () => buildVisibleTaskRows(filteredRoots, jobTaskRows || [], expandedIds),
        [filteredRoots, jobTaskRows, expandedIds]
    );

    const stats = useMemo(() => {
        const onlyRoots = roots;
        const completed = onlyRoots.filter((t) => normalizeJobTaskStatus(t.status) === 'completed').length;
        const total = onlyRoots.length;
        const p = Math.min(100, Math.max(0, Math.round(Number(effectiveJob.progress) || 0)));
        return { completedTasks: completed, totalTasks: total, progress: p };
    }, [roots, effectiveJob.progress]);

    const toggleExpand = (id) => {
        const sid = String(id);
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(sid)) next.delete(sid);
            else next.add(sid);
            return next;
        });
    };

    const patchJobTaskStatus = async (item, nextStatus) => {
        const id = item?._id || item?.id;
        if (!id) return;
        try {
            await api.patch(`/job-tasks/${id}`, { status: nextStatus });
            await loadJobTasks();
            await loadJobMeta();
            await refreshData();
        } catch (e) {
            Alert.alert('Update failed', e.response?.data?.message || e.message || 'Could not update task.');
        }
    };

    const patchSubTaskStatus = async (parentJobTaskId, sub, nextStatus) => {
        const sid = sub?._id || sub?.id;
        if (!sid || !parentJobTaskId) return;
        try {
            await api.patch(`/tasks/${parentJobTaskId}/subtasks/${sid}`, { status: nextStatus });
            await loadJobTasks();
            await loadJobMeta();
            await refreshData();
        } catch (e) {
            Alert.alert('Update failed', e.response?.data?.message || e.message || 'Could not update subtask.');
        }
    };

    const cycleJobTaskComplete = async (item) => {
        const st = normalizeJobTaskStatus(item.status);
        const next = st === 'completed' ? 'pending' : 'completed';
        await patchJobTaskStatus(item, next);
    };

    const cycleSubTaskComplete = async (sub) => {
        const st = String(sub.status || 'todo').toLowerCase();
        const next = st === 'completed' ? 'todo' : 'completed';
        const parentJobTaskId = String(sub.taskId?._id || sub.taskId || '');
        await patchSubTaskStatus(parentJobTaskId, sub, next);
    };

    const submitNote = async () => {
        const text = noteDraft.trim();
        if (!text || !jobId) return;
        setSavingNote(true);
        try {
            const res = await api.post(`/jobs/${jobId}/notes`, { content: text });
            const created = res.data;
            if (created) setNotes((prev) => [created, ...prev]);
            setNoteDraft('');
        } catch (e) {
            Alert.alert('Note failed', e.response?.data?.message || 'Could not save note.');
        } finally {
            setSavingNote(false);
        }
    };

    const deleteNote = (note) => {
        const nid = note?._id || note?.id;
        if (!nid) return;
        Alert.alert('Delete note', 'Remove this note?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`/jobs/${jobId}/notes/${nid}`);
                        setNotes((prev) => prev.filter((n) => String(n._id || n.id) !== String(nid)));
                    } catch (e) {
                        Alert.alert('Error', 'Could not delete note.');
                    }
                },
            },
        ]);
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/json'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;
            const file = result.assets[0];
            const uri = file.uri;
            const resText = await fetch(uri).then((r) => r.text());
            let rows = [];
            if (file.name?.toLowerCase().endsWith('.json')) {
                try {
                    const j = JSON.parse(resText);
                    rows = Array.isArray(j) ? j : j.tasks || [];
                } catch (e) {
                    Alert.alert('Invalid JSON', 'Could not parse file.');
                    return;
                }
            } else {
                const lines = resText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                rows = lines.slice(1).map((line) => {
                    const parts = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
                    return { title: parts[0], description: parts[1] || '', priority: (parts[2] || 'medium').toLowerCase() };
                });
                if (!rows.length && lines.length) {
                    rows = lines.map((line) => {
                        const parts = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
                        return { title: parts[0] || 'Imported task', description: parts[1] || '', priority: 'medium' };
                    });
                }
            }
            const tasksToCreate = rows
                .map((r) => (typeof r === 'string' ? { title: r, description: '', priority: 'medium' } : r))
                .filter((r) => r && (r.title || r.name))
                .map((r) => ({
                    title: r.title || r.name,
                    description: r.description || r.remarks || '',
                    priority: ['low', 'medium', 'high'].includes(String(r.priority || '').toLowerCase())
                        ? String(r.priority).toLowerCase()
                        : 'medium',
                }));
            if (!tasksToCreate.length) {
                Alert.alert('Nothing to import', 'No task rows found in file.');
                return;
            }
            Alert.alert('Import tasks', `Create ${tasksToCreate.length} job task(s) on this site?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Import',
                    onPress: async () => {
                        let ok = 0;
                        let fail = 0;
                        for (const t of tasksToCreate) {
                            try {
                                await api.post('/job-tasks', {
                                    jobId,
                                    title: t.title,
                                    description: t.description,
                                    priority: t.priority,
                                });
                                ok++;
                            } catch (e) {
                                fail++;
                            }
                        }
                        await loadJobTasks();
                        await loadJobMeta();
                        await refreshData();
                        Alert.alert('Import finished', `${ok} created${fail ? `, ${fail} failed` : ''}.`);
                    },
                },
            ]);
        } catch (e) {
            Alert.alert('Import error', e.message || 'Failed to read file.');
        }
    };

    const padH = isTablet ? '10%' : scale(20);

    const renderTaskRow = ({ item: row }) => {
        const { item, depth, kind } = row;
        const isSub = kind === 'subtask';
        const st = isSub ? String(item.status || 'todo').toLowerCase() : normalizeJobTaskStatus(item.status);
        const isDone = isSub ? st === 'completed' : st === 'completed';
        const priority = (item.priority || 'medium').toString().toLowerCase();
        const hasChildren = (jobTaskRows || []).some(
            (x) => x.isSubTask && (depth === 0 ? String(x.taskId) === String(item._id || item.id) && !x.parentSubTaskId : String(x.parentSubTaskId) === String(item._id || item.id))
        );
        const assignName = item.assignedTo?.fullName || item.assignedTo?.name || '';
        const assignShort = assignName ? assignName.split(' ')[0] : 'Unassigned';
        const marginLeft = depth * scale(14);

        const onToggleCheck = () => {
            if (isSub) cycleSubTaskComplete(item);
            else cycleJobTaskComplete(item);
        };

        const onRowPress = () => {
            if (hasChildren) toggleExpand(item._id || item.id);
        };

        return (
            <View style={[styles.taskRowWrap, { marginLeft }]}>
                <View style={[styles.taskRow, { paddingHorizontal: scale(12), paddingVertical: verticalScale(10) }]}>
                    <View style={styles.statusCol}>
                        <TouchableOpacity
                            onPress={onToggleCheck}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[styles.checkbox, isDone && styles.checkboxChecked, { width: scale(22), height: scale(22), borderRadius: moderateScale(6) }]}
                        >
                            {isDone ? <MaterialCommunityIcons name="check" size={moderateScale(14)} color="#fff" /> : null}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.detailsCol} onPress={onRowPress} activeOpacity={hasChildren ? 0.7 : 1}>
                        <View style={styles.titleLine}>
                            {hasChildren ? (
                                <TouchableOpacity onPress={() => toggleExpand(item._id || item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                    <MaterialCommunityIcons
                                        name={expandedIds.has(String(item._id || item.id)) ? 'chevron-down' : 'chevron-right'}
                                        size={moderateScale(18)}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: moderateScale(18) }} />
                            )}
                            <Text style={[styles.taskTitle, { fontSize: moderateScale(13) }]} numberOfLines={2}>
                                {item.title}
                            </Text>
                        </View>
                        {item.description ? (
                            <Text style={[styles.taskSub, { fontSize: moderateScale(10), marginLeft: scale(22) }]} numberOfLines={2}>
                                {item.description}
                            </Text>
                        ) : null}
                    </TouchableOpacity>

                    <View style={styles.assignedCol}>
                        <View style={[styles.userCircle, { width: scale(24), height: scale(24), borderRadius: scale(12) }]}>
                            <Text style={[styles.userInitial, { fontSize: moderateScale(10) }]}>{assignName ? assignName.charAt(0).toUpperCase() : 'U'}</Text>
                        </View>
                        <Text style={[styles.assignedName, { fontSize: moderateScale(11) }]} numberOfLines={1}>
                            {assignShort}
                        </Text>
                    </View>

                    <View style={styles.priorityCol}>
                        <View
                            style={[
                                styles.priorityTag,
                                {
                                    backgroundColor: priority === 'high' ? '#FEF2F2' : '#F1F5F9',
                                    paddingHorizontal: scale(8),
                                    paddingVertical: verticalScale(4),
                                    borderRadius: moderateScale(6),
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.priorityText,
                                    { color: priority === 'high' ? '#EF4444' : '#64748B', fontSize: moderateScale(8.5) },
                                ]}
                            >
                                {(item.priority || 'MEDIUM').toString().toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderHistory = () => {
        if (historyLoading) {
            return (
                <View style={styles.tabBodyCenter}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            );
        }
        if (!historyPayload) {
            return (
                <View style={styles.tabBodyCenter}>
                    <Text style={styles.muted}>No history loaded.</Text>
                </View>
            );
        }
        const acts = historyPayload.activity_logs || [];
        const logs = historyPayload.daily_logs || [];
        return (
            <View style={styles.tabScroll}>
                <Text style={styles.sectionHeading}>Activity</Text>
                {acts.length === 0 ? <Text style={styles.muted}>No activity entries.</Text> : null}
                {acts.map((a) => (
                    <View key={String(a._id || a.id)} style={[styles.historyCard, SHADOWS.small]}>
                        <Text style={styles.historyAction}>{a.actionType || 'EVENT'}</Text>
                        <Text style={styles.historyDesc}>{a.description}</Text>
                        <Text style={styles.historyMeta}>
                            {a.createdBy?.fullName || 'User'} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                        </Text>
                    </View>
                ))}
                <Text style={[styles.sectionHeading, { marginTop: verticalScale(20) }]}>Clock events</Text>
                {logs.length === 0 ? <Text style={styles.muted}>No time logs for this job.</Text> : null}
                {logs.slice(0, 40).map((log, idx) => (
                    <View key={log._id ? String(log._id) : `log-${idx}`} style={[styles.historyCard, SHADOWS.small]}>
                        <Text style={styles.historyDesc}>
                            {log.workerId?.fullName || 'Worker'} — {log.checkIn ? new Date(log.checkIn).toLocaleString() : ''}
                            {log.checkOut ? ` → ${new Date(log.checkOut).toLocaleTimeString()}` : ' (open)'}
                        </Text>
                        <Text style={styles.historyMeta}>{typeof log.totalHours === 'number' ? `${log.totalHours.toFixed(2)} hrs` : ''}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderNotes = () => (
        <View>
            <View style={[styles.noteComposer, { marginHorizontal: scale(16), marginTop: verticalScale(8) }]}>
                <TextInput
                    style={styles.noteInput}
                    placeholder="Add a site note (syncs with web)..."
                    placeholderTextColor="#94A3B8"
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    multiline
                />
                <TouchableOpacity style={styles.noteSaveBtn} onPress={submitNote} disabled={savingNote || !noteDraft.trim()}>
                    {savingNote ? <ActivityIndicator color="#fff" /> : <Text style={styles.noteSaveTxt}>POST NOTE</Text>}
                </TouchableOpacity>
            </View>
            {notesLoading ? (
                <View style={styles.tabBodyCenter}>
                    <ActivityIndicator color="#2563EB" />
                </View>
            ) : (
                <View style={{ paddingHorizontal: scale(16), paddingTop: verticalScale(8), paddingBottom: verticalScale(8) }}>
                    {notes.length === 0 ? (
                        <Text style={[styles.muted, { textAlign: 'center', marginTop: verticalScale(24) }]}>No notes yet.</Text>
                    ) : (
                        notes.map((n) => (
                            <View key={String(n._id || n.id)} style={[styles.noteCard, SHADOWS.small, { marginBottom: verticalScale(10) }]}>
                                <Text style={styles.noteBody}>{n.content}</Text>
                                <View style={styles.noteFooter}>
                                    <Text style={styles.historyMeta}>
                                        {n.createdBy?.fullName || 'User'} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                                    </Text>
                                    <TouchableOpacity onPress={() => deleteNote(n)}>
                                        <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}
        </View>
    );

    const ListHeader = () => (
        <View>
            <TouchableOpacity style={[styles.backBtn, { paddingHorizontal: padH, paddingVertical: verticalScale(12) }]} onPress={() => navigation.goBack()}>
                <MaterialCommunityIcons name="arrow-left" size={moderateScale(20)} color="#2563EB" />
                <Text style={styles.backTxt}>BACK TO MY JOBS</Text>
            </TouchableOpacity>

            <View style={[styles.jobHeading, { paddingHorizontal: padH, marginBottom: verticalScale(16) }]}>
                <View style={styles.titleRow}>
                    <Text style={[styles.jobName, { fontSize: moderateScale(22) }]} numberOfLines={2}>
                        {effectiveJob.name || effectiveJob.title || 'Job'}
                    </Text>
                    <View style={[styles.badge, { borderColor: '#E2E8F0' }]}>
                        <Text style={styles.badgeText}>{jobStatusLabel(effectiveJob.status)}</Text>
                    </View>
                </View>
                <View style={[styles.metaLine, { marginTop: verticalScale(8) }]}>
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(14)} color="#64748B" />
                        <Text style={styles.metaText}>{formatTitleCaseLoc(effectiveJob.location || '')}</Text>
                    </View>
                    <View style={styles.dot} />
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="chart-donut" size={moderateScale(14)} color="#2563EB" />
                        <Text style={[styles.metaText, { color: '#2563EB' }]}>{stats.progress}% progress</Text>
                    </View>
                    <View style={styles.dot} />
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="format-list-checks" size={moderateScale(14)} color="#059669" />
                        <Text style={[styles.metaText, { color: '#059669' }]}>
                            {stats.completedTasks}/{stats.totalTasks} done
                        </Text>
                    </View>
                </View>
            </View>

            <View style={[styles.tabContainer, { paddingHorizontal: padH }]}>
                {TABS.map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}>
                        <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab === 'TASKS' ? (
                <>
                    <View style={[styles.actionRow, { paddingHorizontal: padH, paddingVertical: verticalScale(10), gap: scale(10) }]}>
                        <View style={[styles.searchBox, { height: verticalScale(44), borderRadius: moderateScale(10), paddingHorizontal: scale(12) }]}>
                            <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                            <TextInput
                                style={styles.input}
                                placeholder="Search tasks..."
                                placeholderTextColor="#94A3B8"
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>
                        <TouchableOpacity style={[styles.filterBtn, { width: scale(44), height: scale(44), borderRadius: moderateScale(10) }]} onPress={() => setFilterModal(true)}>
                            <MaterialCommunityIcons name="tune-variant" size={moderateScale(20)} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.importBtn, { height: scale(44), paddingHorizontal: scale(14), borderRadius: moderateScale(10), gap: scale(6) }]} onPress={handleImport}>
                            <MaterialCommunityIcons name="database-import-outline" size={moderateScale(18)} color="#fff" />
                            <Text style={styles.importTxt}>IMPORT</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.tableHeader, { paddingVertical: verticalScale(10), paddingHorizontal: padH }]}>
                        <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
                        <Text style={[styles.th, styles.colDetails]}>TASK DETAILS</Text>
                        <Text style={[styles.th, styles.colAssigned]}>ASSIGNED</Text>
                        <Text style={[styles.th, styles.colPriority]}>PRIORITY</Text>
                    </View>
                </>
            ) : null}
        </View>
    );

    if (!jobId) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.muted}>Missing job.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <WorkerHeader title="Site Tasks" showBranding={true} />
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: verticalScale(40) }} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Tasks" showBranding={true} />

            {activeTab === 'TASKS' ? (
                <Animated.FlatList
                    style={{ flex: 1, opacity: fadeAnim }}
                    data={visibleRows}
                    keyExtractor={(row, index) => `${row.kind}-${row.item._id || row.item.id || index}`}
                    renderItem={renderTaskRow}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={{ paddingBottom: contentBottomForTabBar(insets.bottom) }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={moderateScale(50)} color="#CBD5E1" />
                            <Text style={styles.emptyTxt}>No job tasks match filters.</Text>
                        </View>
                    }
                />
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        contentContainerStyle={{ paddingBottom: contentBottomForTabBar(insets.bottom) }}
                    >
                        {ListHeader()}
                        {activeTab === 'HISTORY' ? renderHistory() : renderNotes()}
                    </ScrollView>
                </Animated.View>
            )}

            <Modal visible={filterModal} transparent animationType="fade" onRequestClose={() => setFilterModal(false)}>
                <View style={styles.filterOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterModal(false)} />
                    <View style={[styles.filterSheet, isTablet && { maxWidth: 400, alignSelf: 'center', width: '100%' }]}>
                        <Text style={styles.sheetHdr}>Task status</Text>
                        {TASK_STATUS_FILTER.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterOption, taskStatusFilter === f && styles.filterOptionOn]}
                                onPress={() => {
                                    setTaskStatusFilter(f);
                                    setFilterModal(false);
                                }}
                            >
                                <Text style={[styles.filterOptionTxt, taskStatusFilter === f && styles.filterOptionTxtOn]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
    backTxt: { fontWeight: '900', color: '#2563EB', fontSize: moderateScale(12) },
    jobHeading: {},
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10) },
    jobName: { fontWeight: '900', color: '#0F172A', flex: 1, minWidth: 0 },
    badge: { backgroundColor: '#F8FAFC', borderWidth: 1, paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(12), alignSelf: 'flex-start' },
    badgeText: { fontWeight: '900', color: '#64748B', fontSize: moderateScale(9) },
    metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8) },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
    metaText: { fontWeight: '700', color: '#64748B', fontSize: moderateScale(12), maxWidth: scale(200) },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: scale(20) },
    tab: { paddingVertical: verticalScale(12), borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#2563EB' },
    tabLabel: { fontWeight: '800', color: '#94A3B8', fontSize: moderateScale(13) },
    tabLabelActive: { color: '#2563EB' },
    actionRow: { flexDirection: 'row', alignItems: 'center' },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    input: { flex: 1, fontWeight: '600', color: '#1E293B', fontSize: moderateScale(14), marginLeft: scale(8), minWidth: 0 },
    filterBtn: { backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    importBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center' },
    importTxt: { color: '#fff', fontWeight: '900', fontSize: moderateScale(10) },
    tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    th: { fontWeight: '900', color: '#94A3B8', fontSize: moderateScale(9), letterSpacing: 0.5 },
    colStatus: { width: scale(52) },
    colDetails: { flex: 1, minWidth: 0, paddingRight: scale(6) },
    colAssigned: { width: scale(100), paddingRight: scale(4) },
    colPriority: { width: scale(72), textAlign: 'right' },
    taskRowWrap: {},
    taskRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    statusCol: { width: scale(52), alignItems: 'flex-start' },
    checkbox: { borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: '#059669', borderColor: '#059669' },
    detailsCol: { flex: 1, minWidth: 0, paddingRight: scale(6) },
    titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(4) },
    taskTitle: { fontWeight: '800', color: '#1E293B', flex: 1 },
    taskSub: { color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    assignedCol: { width: scale(100), flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    userCircle: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    userInitial: { fontWeight: '900', color: '#64748B' },
    assignedName: { fontWeight: '700', color: '#475569', flex: 1, minWidth: 0 },
    priorityCol: { width: scale(72), alignItems: 'flex-end' },
    priorityTag: { alignSelf: 'flex-end' },
    priorityText: { fontWeight: '900' },
    empty: { alignItems: 'center', padding: scale(40) },
    emptyTxt: { fontWeight: '700', color: '#94A3B8', marginTop: verticalScale(10), fontSize: moderateScale(14) },
    muted: { color: '#94A3B8', fontWeight: '600', fontSize: moderateScale(13) },
    tabBodyCenter: { padding: scale(40), alignItems: 'center' },
    tabScroll: { paddingHorizontal: scale(16) },
    sectionHeading: { fontSize: moderateScale(11), fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: verticalScale(10) },
    historyCard: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(12),
        padding: moderateScale(14),
        marginBottom: verticalScale(10),
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    historyAction: { fontSize: moderateScale(10), fontWeight: '900', color: '#2563EB', marginBottom: 4 },
    historyDesc: { fontSize: moderateScale(13), fontWeight: '600', color: '#1E293B' },
    historyMeta: { fontSize: moderateScale(10), color: '#94A3B8', marginTop: 6, fontWeight: '600' },
    noteComposer: { gap: verticalScale(10) },
    noteInput: {
        minHeight: verticalScale(88),
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: moderateScale(12),
        padding: scale(12),
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
        textAlignVertical: 'top',
    },
    noteSaveBtn: { backgroundColor: '#2563EB', borderRadius: moderateScale(12), paddingVertical: verticalScale(14), alignItems: 'center' },
    noteSaveTxt: { color: '#fff', fontWeight: '900', fontSize: moderateScale(12) },
    noteCard: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(14),
        padding: moderateScale(14),
        marginBottom: verticalScale(10),
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    noteBody: { fontSize: moderateScale(14), fontWeight: '600', color: '#334155' },
    noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: verticalScale(10) },
    filterOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
    filterSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: scale(20),
        paddingBottom: verticalScale(28),
        zIndex: 2,
        elevation: 12,
    },
    sheetHdr: { fontSize: moderateScale(16), fontWeight: '900', color: '#0F172A', marginBottom: verticalScale(12) },
    filterOption: { paddingVertical: verticalScale(14), borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    filterOptionOn: { backgroundColor: '#EFF6FF' },
    filterOptionTxt: { fontSize: moderateScale(15), fontWeight: '700', color: '#334155' },
    filterOptionTxtOn: { color: '#1D4ED8' },
});

export default ForemanJobDetailScreen;
