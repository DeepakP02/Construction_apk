import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, ScrollView, RefreshControl, StatusBar, Modal, Platform, Alert, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { useApp } from '../../context/AppContext';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ROLE_LABELS = {
    PM: 'Project Manager',
    FOREMAN: 'Foreman',
    WORKER: 'Worker',
    SUBCONTRACTOR: 'Subcontractor',
};

const getAssignableRoleOptions = (currentRole) => {
    if (['FOREMAN', 'SUBCONTRACTOR'].includes(currentRole)) {
        return [{ label: 'Worker', value: 'WORKER' }];
    }
    if (['PM', 'COMPANY_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(currentRole)) {
        return [
            { label: 'Worker', value: 'WORKER' },
            { label: 'Foreman', value: 'FOREMAN' },
            { label: 'Project Manager', value: 'PM' },
            { label: 'Subcontractor', value: 'SUBCONTRACTOR' },
        ];
    }
    return [{ label: 'Worker', value: 'WORKER' }];
};

function cmpTaskOrder(a, b) {
    const pa = a.position;
    const pb = b.position;
    if (pa != null && pb != null && pa !== pb) return pa - pb;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function taskCollapseStorageKey(role) {
    if (role === 'SUBCONTRACTOR') return 'subcontractorTasksCollapsedV1';
    return 'foremanTasksCollapsedV1';
}

/**
 * Full task tree from allTasks; visibility = entire subtrees whose root is an ancestor of any anchor match
 * (same idea as web Task Command Center / PM Tasks when search hits a subtask).
 */
function buildForemanHierarchy(allTasks, anchorIdSet, collapsedNodes) {
    const collapsed = collapsedNodes instanceof Set ? collapsedNodes : new Set();
    const map = new Map();
    const roots = [];
    const orphans = [];

    (allTasks || []).forEach((t) => {
        const id = String(t._id || t.id);
        map.set(id, { ...t, children: [] });
    });

    (allTasks || []).forEach((t) => {
        const id = String(t._id || t.id);
        const node = map.get(id);
        const directParentId = t.parentTaskId ? String(t.parentTaskId?._id || t.parentTaskId) : null;

        if (directParentId && map.has(directParentId)) {
            const parentNode = map.get(directParentId);
            parentNode.children.push(node);
            if (!node.projectId && parentNode.projectId) {
                node.projectId = parentNode.projectId;
            }
        } else if (!directParentId) {
            roots.push(node);
        } else {
            orphans.push(node);
        }
    });

    const sortRecursive = (node) => {
        if (node.children?.length) {
            node.children.sort(cmpTaskOrder);
            node.children.forEach(sortRecursive);
        }
    };
    roots.sort(cmpTaskOrder);
    roots.forEach(sortRecursive);
    orphans.sort(cmpTaskOrder);
    orphans.forEach(sortRecursive);

    const rootIdOf = (taskId) => {
        let id = String(taskId);
        const seen = new Set();
        while (true) {
            const cur = map.get(id);
            if (!cur) return String(taskId);
            const pid = cur.parentTaskId ? String(cur.parentTaskId?._id || cur.parentTaskId) : null;
            if (!pid || !map.has(pid)) return id;
            if (seen.has(id)) return id;
            seen.add(id);
            id = pid;
        }
    };

    const rootIdsToShow = new Set();
    anchorIdSet.forEach((tid) => {
        rootIdsToShow.add(rootIdOf(tid));
    });

    const visibleIds = new Set();
    const collectSubtree = (node) => {
        const nid = String(node._id || node.id);
        visibleIds.add(nid);
        (node.children || []).forEach(collectSubtree);
    };

    roots.forEach((r) => {
        if (rootIdsToShow.has(String(r._id || r.id))) collectSubtree(r);
    });
    orphans.forEach((o) => {
        if (rootIdsToShow.has(String(o._id || o.id))) collectSubtree(o);
    });

    const flatList = [];
    const flatten = (nodes, level, parentCollapsed = false) => {
        const sortedNodes = [...nodes].sort(cmpTaskOrder);
        sortedNodes.forEach((n) => {
            const id = String(n._id || n.id);
            if (!visibleIds.has(id)) return;

            n.level = level;
            n.isCollapsed = collapsed.has(id);
            n.hasChildren = !!(n.children && n.children.length > 0);

            if (!parentCollapsed) {
                flatList.push(n);
            }

            if (n.children && n.children.length > 0) {
                flatten(n.children, level + 1, parentCollapsed || collapsed.has(id));
            }
        });
    };

    flatten(roots, 0, false);
    orphans.forEach((o) => {
        const oid = String(o._id || o.id);
        if (!visibleIds.has(oid)) return;
        if (flatList.some((x) => String(x._id || x.id) === oid)) return;
        flatten([o], 0, false);
    });

    return flatList;
}

const ForemanTasksScreen = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const isCompact = width < 380;
    const { tasks, addTask, deleteTask, refreshData, projects, teamMembers, fetchTeamMembers, jobs, user, selectedProject } = useApp();
    const collapseStorageKey = useMemo(() => taskCollapseStorageKey(user?.role), [user?.role]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('ALL TASKS');
    const [showModal, setShowModal] = useState(false);
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());

    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});
    const [datePickerMode, setDatePickerMode] = useState(null);

    const [form, setForm] = useState({
        title: '',
        project: '',
        projectId: '',
        parentTaskId: '',
        jobId: '',
        assignedRoleType: '',
        assignedTo: [],
        category: 'TASK',
        priority: 'Medium',
        status: 'todo',
        startDate: '',
        dueDate: '',
        description: '',
    });

    const formatDate = (date) => {
        if (!date) return '';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) {
            return '';
        }
    };

    const parsePickerDate = (value) => {
        if (!value || typeof value !== 'string') return new Date();
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const openDatePicker = (field) => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: parsePickerDate(form[field]),
                mode: 'date',
                is24Hour: true,
                onChange: (event, selectedDate) => {
                    if (event.type !== 'set' || !selectedDate) return;
                    setForm((prev) => ({ ...prev, [field]: formatDate(selectedDate) }));
                },
            });
            return;
        }
        setDatePickerMode(field);
    };

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subDefaultTabApplied = useRef(false);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
            fetchTeamMembers?.();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        const restore = async () => {
            try {
                const raw = await AsyncStorage.getItem(collapseStorageKey);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setCollapsedNodes(new Set(parsed.map((v) => String(v))));
            } catch (e) {}
        };
        restore();
    }, [collapseStorageKey]);

    useEffect(() => {
        AsyncStorage.setItem(collapseStorageKey, JSON.stringify(Array.from(collapsedNodes))).catch(() => {});
    }, [collapsedNodes, collapseStorageKey]);

    useEffect(() => {
        if (user?.role !== 'SUBCONTRACTOR' || subDefaultTabApplied.current) return;
        subDefaultTabApplied.current = true;
        setActiveTab('MY TASKS');
    }, [user?.role]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const matchingForemanTasks = useMemo(() => {
        const q = search.toLowerCase();
        const matchesSearch = (t) =>
            (t.title || '').toLowerCase().includes(q) || (t.projectId?.name || '').toLowerCase().includes(q);

        return (tasks || []).filter((t) => {
            if (!matchesSearch(t)) return false;
            if (selectedProject) {
                const selId = String(selectedProject._id || selectedProject.id);
                if (String(t.projectId?._id || t.projectId) !== selId) return false;
            }
            if (activeTab === 'MY TASKS') {
                const myId = user?._id || user?.id;
                const sameId = (a, b) => String(a ?? '') === String(b ?? '');
                const isAssignedToMe = Array.isArray(t.assignedTo)
                    ? t.assignedTo.some((a) => sameId(a?._id || a?.id || a, myId))
                    : sameId(t.assignedTo?._id || t.assignedTo?.id || t.assignedTo, myId);
                const assignedForeman = t.assignedForeman?._id || t.assignedForeman;
                const isLeadForeman = myId && sameId(assignedForeman, myId);
                const createdByMe = myId && sameId(t.createdBy?._id || t.createdBy, myId);
                if (user?.role === 'SUBCONTRACTOR') {
                    return isAssignedToMe || isLeadForeman || createdByMe;
                }
                return isAssignedToMe || isLeadForeman;
            }
            return true;
        });
    }, [tasks, search, activeTab, user, selectedProject]);

    const matchingForemanIds = useMemo(
        () => new Set(matchingForemanTasks.map((t) => String(t._id || t.id))),
        [matchingForemanTasks]
    );

    const hierarchicalTasks = useMemo(
        () => buildForemanHierarchy(tasks || [], matchingForemanIds, collapsedNodes),
        [tasks, matchingForemanIds, collapsedNodes]
    );

    /** Alias kept so any stale reference / Metro cache does not throw ReferenceError. */
    const taskRows = hierarchicalTasks;

    const promptDeleteTask = (task) => {
        const id = task?._id || task?.id;
        if (!id) return;
        const hasChildren =
            (task?.children && task.children.length > 0) ||
            (tasks || []).some((t) => String(t.parentTaskId ? t.parentTaskId?._id || t.parentTaskId : '') === String(id));

        if (!hasChildren) {
            Alert.alert('Delete task', `Delete "${task.title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) },
            ]);
            return;
        }
        Alert.alert('Delete parent task', 'This task has subtasks. Choose an option.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Move children up', onPress: () => deleteTask(id, { action: 'moveUpward' }) },
            { text: 'Delete all', style: 'destructive', onPress: () => deleteTask(id, { action: 'cascade' }) },
        ]);
    };

    const filteredTeam = useMemo(
        () =>
            form.assignedRoleType
                ? (teamMembers || []).filter((m) => m.role === form.assignedRoleType)
                : teamMembers || [],
        [teamMembers, form.assignedRoleType]
    );

    const jobsForProject = useMemo(() => {
        if (!form.projectId) return [];
        const pid = String(form.projectId);
        return (jobs || []).filter((j) => String(j.projectId?._id || j.projectId) === pid);
    }, [jobs, form.projectId]);

    const openCreateModal = () => {
        setDatePickerMode(null);
        const defProj = selectedProject || projects?.[0];
        setForm({
            title: '',
            project: defProj?.name || '',
            projectId: defProj?._id || defProj?.id || '',
            parentTaskId: '',
            jobId: '',
            assignedRoleType: '',
            assignedTo: [],
            category: 'TASK',
            priority: 'Medium',
            status: 'todo',
            startDate: '',
            dueDate: '',
            description: '',
        });
        setShowModal(true);
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (val) => {
            onSelect(val);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const closeCreateModal = () => {
        setShowModal(false);
        setDatePickerMode(null);
    };

    const handleCreateTask = async () => {
        if (!form.title) {
            Alert.alert('Error', 'Task title is required');
            return;
        }
        if (!form.projectId) {
            Alert.alert('Error', 'Project selection is required');
            return;
        }

        setLoading(true);
        try {
            const payload = { ...form };
            if (!payload.assignedRoleType) delete payload.assignedRoleType;
            if (!payload.startDate) delete payload.startDate;
            if (!payload.dueDate) delete payload.dueDate;
            if (!payload.parentTaskId) delete payload.parentTaskId;
            if (!payload.jobId) delete payload.jobId;
            if (Array.isArray(payload.assignedTo)) {
                payload.assignedTo = payload.assignedTo.length > 0 ? payload.assignedTo[0] : null;
            }
            if (!payload.assignedTo) delete payload.assignedTo;

            const success = await addTask(payload);
            if (success) {
                closeCreateModal();
                const defProj = selectedProject || projects?.[0];
                setForm({
                    title: '',
                    project: defProj?.name || '',
                    projectId: defProj?._id || defProj?.id || '',
                    parentTaskId: '',
                    jobId: '',
                    assignedRoleType: '',
                    assignedTo: [],
                    category: 'TASK',
                    priority: 'Medium',
                    status: 'todo',
                    startDate: '',
                    dueDate: '',
                    description: '',
                });
                refreshData();
            } else {
                Alert.alert('Error', 'Failed to create task.');
            }
        } catch (e) {
            Alert.alert('Error', 'Network error.');
        } finally {
            setLoading(false);
        }
    };

    const DropdownField = ({ label, value, onPress, flex = 1 }) => (
        <View style={{ flex }}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.compactDropdown} activeOpacity={0.7} onPress={onPress}>
                <Text style={styles.dropdownValue} numberOfLines={1}>
                    {value || 'Select...'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color="#3B82F6" />
            </TouchableOpacity>
        </View>
    );

    const openTaskActions = (task) => {
        Alert.alert(task?.title || 'Task', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Add subtask',
                onPress: () =>
                    navigation.navigate('TaskCreate', {
                        isChild: true,
                        parentTaskId: task._id || task.id,
                        projectId: task?.projectId?._id || task?.projectId,
                    }),
            },
            { text: 'Delete', style: 'destructive', onPress: () => promptDeleteTask(task) },
        ]);
    };

    const goHierarchy = (taskId) => navigation.navigate('TaskHierarchyDetail', { taskId: String(taskId) });

    const renderTaskCard = (item) => {
        const level = item.level || 0;
        const isDeepLevel = level >= 3;
        const dynamicMargin = level === 0 ? 0 : level === 1 ? scale(18) : level === 2 ? scale(32) : Math.min(scale(32 + (level - 2) * 8), scale(60));
        const statusColors = {
            todo: { color: '#64748B', bg: '#F1F5F9', label: 'TODO' },
            pending: { color: '#64748B', bg: '#F1F5F9', label: 'TODO' },
            in_progress: { color: '#3B82F6', bg: '#EFF6FF', label: 'LIVE' },
            review: { color: '#F59E0B', bg: '#FFFBEB', label: 'REVIEW' },
            completed: { color: '#10B981', bg: '#ECFDF5', label: 'DONE' },
        };
        const st = String(item.status || 'todo').toLowerCase().replace(/[\s-]+/g, '_');
        const sc =
            statusColors[st] ||
            (st.includes('progress') ? statusColors.in_progress : statusColors.todo);
        const titleText = item.title || item.remarks || 'Untitled';
        const taskIdForNav = item._id || item.id;
        const progressPct = Math.min(100, Math.max(0, Number(item.progress) || 0));

        return (
            <View style={[styles.taskItemWrapper, { marginLeft: dynamicMargin }]}>
                {level > 0 ? (
                    <View style={styles.treeConnector}>
                        <View style={[styles.connectorVertical, { bottom: 25 }]} />
                        <View style={styles.connectorHorizontal} />
                    </View>
                ) : null}
                <TouchableOpacity
                    style={[
                        styles.taskTableRow,
                        SHADOWS.small,
                        level > 0 && styles.subtaskCard,
                        level > 1 && styles.deepSubtaskCard,
                        isDeepLevel && { padding: 8 },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => goHierarchy(taskIdForNav)}
                    onLongPress={() => openTaskActions(item)}
                >
                    <View style={styles.tableTopRow}>
                        <View style={styles.tableNameCol}>
                            <View style={[styles.indicatorLine, { backgroundColor: sc.color }]} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.badgeRow}>
                                    <View
                                        style={[
                                            styles.typeBadge,
                                            {
                                                backgroundColor:
                                                    level === 0 ? '#EFF6FF' : level === 1 ? '#F0FDF4' : '#FFF7ED',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.typeBadgeText,
                                                {
                                                    color: level === 0 ? '#3B82F6' : level === 1 ? '#22C55E' : '#F97316',
                                                },
                                            ]}
                                        >
                                            {level === 0 ? 'MAIN TASK' : level === 1 ? 'SUBTASK' : `LEVEL ${level}`}
                                        </Text>
                                    </View>
                                    {level > 0 ? (
                                        <View style={styles.parentTag}>
                                            <Text style={styles.parentTagText} numberOfLines={1}>
                                                OF:{' '}
                                                {(
                                                    tasks.find(
                                                        (t) =>
                                                            String(t._id || t.id) ===
                                                            String(item.parentTaskId ? item.parentTaskId?._id || item.parentTaskId : '')
                                                    )?.title || 'Parent'
                                                ).toUpperCase()}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                    {item.hasChildren ? (
                                        <TouchableOpacity
                                            style={{ padding: 4 }}
                                            onPress={() => {
                                                const id = String(item._id || item.id);
                                                setCollapsedNodes((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(id)) next.delete(id);
                                                    else next.add(id);
                                                    return next;
                                                });
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name={item.isCollapsed ? 'chevron-right' : 'chevron-down'}
                                                size={18}
                                                color="#64748B"
                                            />
                                        </TouchableOpacity>
                                    ) : null}
                                    <Text
                                        style={[
                                            styles.taskTitlePm,
                                            {
                                                fontSize: isDeepLevel ? 12 : isCompact ? 13 : 15,
                                                fontWeight: level === 0 ? '900' : '600',
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {titleText}
                                    </Text>
                                </View>
                                <Text style={styles.projectContextPm} numberOfLines={1}>
                                    {item.projectId?.name || item.project || 'Main Project'}
                                </Text>
                                {level === 0 && item.hasChildren ? (
                                    <View style={{ marginTop: 6 }}>
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                                        </View>
                                        <Text style={styles.progressLabel}>{Math.round(progressPct)}%</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                        <View style={styles.tableMetricCol}>
                            <View style={[styles.miniStatusBadge, { backgroundColor: sc.bg, borderColor: sc.color + '20' }]}>
                                <Text style={[styles.miniStatusText, { color: sc.color }]}>{sc.label}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.tableBottomRow}>
                        <View style={[styles.assigneeColPm, { flex: 1.5 }]}>
                            <MaterialCommunityIcons name="account-circle-outline" size={12} color="#94A3B8" />
                            <Text style={styles.assigneeTextPm} numberOfLines={1} adjustsFontSizeToFit>
                                {Array.isArray(item.assignedTo) && item.assignedTo.length > 0
                                    ? item.assignedTo[0].fullName
                                    : item.assignedTo?.fullName || 'Unassigned'}
                            </Text>
                        </View>
                        <View style={[styles.dateColPm, { flex: 1 }]}>
                            <MaterialCommunityIcons name="calendar-clock" size={12} color="#94A3B8" />
                            <Text style={styles.tableDateTextPm} numberOfLines={1}>
                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No Date'}
                            </Text>
                        </View>
                        <View style={styles.actionsColPm}>
                            <TouchableOpacity onPress={() => goHierarchy(taskIdForNav)}>
                                <MaterialCommunityIcons name="pencil" size={isDeepLevel ? 12 : 14} color="#64748B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => promptDeleteTask(item)}>
                                <MaterialCommunityIcons name="trash-can-outline" size={isDeepLevel ? 12 : 14} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Tasks" showBranding={true} />

            <ScrollView
                stickyHeaderIndices={[1]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={[styles.headerTitleSection, { paddingHorizontal: scale(20), paddingTop: scale(12), paddingBottom: scale(8) }]}>
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.screenTitle, { fontSize: moderateScale(22) }]}>Task Command Center</Text>
                            <Text style={[styles.commandSubtitleForeman, { marginTop: verticalScale(4) }]}>
                                {user?.role === 'SUBCONTRACTOR' ? 'SUBCONTRACTOR TASK HIERARCHY' : 'TASK TRACKING & ASSIGNMENT'}
                            </Text>
                        </View>
                        <TouchableOpacity style={[styles.newTaskBtn, { paddingHorizontal: scale(16), paddingVertical: verticalScale(10), borderRadius: moderateScale(12) }]} onPress={openCreateModal} activeOpacity={0.8}>
                            <MaterialCommunityIcons name="plus" size={moderateScale(20)} color="#fff" />
                            <Text style={[styles.newTaskBtnText, { fontSize: moderateScale(12), marginLeft: scale(6) }]}>NEW TASK</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.stickyActionArea, { paddingHorizontal: isTablet ? '10%' : scale(20), paddingVertical: verticalScale(12) }]}>
                    <View style={[styles.searchBar, { height: verticalScale(44), borderRadius: moderateScale(12), paddingHorizontal: scale(12) }]}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput
                            style={[styles.searchInput, { fontSize: moderateScale(14), marginLeft: scale(8) }]}
                            placeholder="Search tasks..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    <View style={[styles.tabsContainer, { marginTop: verticalScale(12), padding: scale(4), borderRadius: moderateScale(12) }]}>
                        <TouchableOpacity style={[styles.tab, activeTab === 'MY TASKS' && styles.tabActive]} onPress={() => setActiveTab('MY TASKS')}>
                            <Text style={[styles.tabText, activeTab === 'MY TASKS' && styles.tabTextActive, { fontSize: moderateScale(11) }]}>MY TASKS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, activeTab === 'ALL TASKS' && styles.tabActive]} onPress={() => setActiveTab('ALL TASKS')}>
                            <Text style={[styles.tabText, activeTab === 'ALL TASKS' && styles.tabTextActive, { fontSize: moderateScale(11) }]}>ALL TASKS</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Animated.View style={[styles.listContainer, { opacity: fadeAnim, paddingHorizontal: isTablet ? '10%' : scale(20) }]}>
                    {taskRows.length > 0 ? (
                        taskRows.map((item, i) => (
                            <View key={`task-${item._id || item.id || i}-${i}`}>{renderTaskCard(item)}</View>
                        ))
                    ) : (
                        <View style={[styles.emptyView, { padding: scale(40) }]}>
                            <MaterialCommunityIcons name="calendar-search" size={moderateScale(60)} color="#E2E8F0" />
                            <Text style={[styles.emptyTitle, { fontSize: moderateScale(18), marginTop: verticalScale(16) }]}>Empty Queue</Text>
                            <Text style={[styles.emptySub, { fontSize: moderateScale(13), marginTop: verticalScale(4) }]}>No tasks found matching your criteria.</Text>
                        </View>
                    )}
                    <View style={{ height: verticalScale(100) }} />
                </Animated.View>
            </ScrollView>

            <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.sheetContent, isTablet ? { width: 600, maxWidth: '100%', alignSelf: 'center' } : null]}>
                        <View style={styles.sheetIndicator} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Create New Task</Text>
                            <TouchableOpacity onPress={closeCreateModal} style={styles.sheetCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <MaterialCommunityIcons name="close" size={moderateScale(22)} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: verticalScale(28), paddingHorizontal: scale(4) }}
                        >
                            <CustomInput
                                label="Task Title"
                                placeholder="e.g. Install Safety Nets Level 3"
                                value={form.title}
                                onChangeText={(t) => setForm({ ...form, title: t })}
                                icon="target"
                            />

                            <View style={styles.formGrid}>
                                <DropdownField
                                    label="Project"
                                    value={form.project}
                                    onPress={() =>
                                        openDropdown(
                                            'Project',
                                            (projects || []).map((p) => ({ label: p.name, value: p._id || p.id })),
                                            (val) => {
                                                const p = projects.find((proj) => (proj._id || proj.id) === val);
                                                if (p) {
                                                    setForm((f) => ({
                                                        ...f,
                                                        project: p.name,
                                                        projectId: val,
                                                        parentTaskId: '',
                                                        jobId: '',
                                                    }));
                                                }
                                            }
                                        )
                                    }
                                />
                                <DropdownField
                                    label="Job (optional)"
                                    value={
                                        form.jobId
                                            ? jobsForProject.find((j) => (j._id || j.id) === form.jobId)?.name ||
                                              jobsForProject.find((j) => (j._id || j.id) === form.jobId)?.title ||
                                              'Selected'
                                            : 'None'
                                    }
                                    onPress={() => {
                                        if (!form.projectId) {
                                            Alert.alert('Select project', 'Choose a project first.');
                                            return;
                                        }
                                        openDropdown(
                                            'Job (optional)',
                                            [
                                                { label: 'None', value: '' },
                                                ...jobsForProject.map((j) => ({
                                                    label: j.name || j.title || 'Job',
                                                    value: j._id || j.id,
                                                })),
                                            ],
                                            (val) => setForm((f) => ({ ...f, jobId: val }))
                                        );
                                    }}
                                />
                            </View>

                            <DropdownField
                                label="Parent task (optional)"
                                value={
                                    form.parentTaskId
                                        ? tasks.find((t) => String(t._id || t.id) === String(form.parentTaskId))?.title ||
                                          'Selected'
                                        : 'None (top level)'
                                }
                                onPress={() =>
                                    openDropdown(
                                        'Parent task',
                                        [
                                            { label: 'None (top level)', value: 'NONE' },
                                            ...(tasks || [])
                                                .filter(
                                                    (t) =>
                                                        String(t.projectId?._id || t.projectId) === String(form.projectId) &&
                                                        !t.isSubTask &&
                                                        !t.isJobTask
                                                )
                                                .map((t) => ({ label: t.title, value: t._id || t.id })),
                                        ],
                                        (val) => {
                                            if (val === 'NONE') setForm((f) => ({ ...f, parentTaskId: '' }));
                                            else setForm((f) => ({ ...f, parentTaskId: val }));
                                        }
                                    )
                                }
                            />

                            <View style={styles.formGrid}>
                                <DropdownField
                                    label="Assign role"
                                    value={form.assignedRoleType ? ROLE_LABELS[form.assignedRoleType] || form.assignedRoleType : 'Any role'}
                                    onPress={() =>
                                        openDropdown(
                                            'Assign role',
                                            [{ label: 'Any role', value: '' }, ...getAssignableRoleOptions(user?.role)],
                                            (val) => setForm((f) => ({ ...f, assignedRoleType: val, assignedTo: [] }))
                                        )
                                    }
                                />
                                <DropdownField
                                    label="Assign to"
                                    value={
                                        form.assignedTo.length > 0
                                            ? teamMembers.find((m) => (m._id || m.id) === form.assignedTo[0])?.fullName ||
                                              'Selected'
                                            : 'Unassigned'
                                    }
                                    onPress={() =>
                                        openDropdown(
                                            'Assign to',
                                            filteredTeam.map((m) => ({
                                                label: m.fullName || m.name || 'User',
                                                value: m._id || m.id,
                                            })),
                                            (val) => setForm((f) => ({ ...f, assignedTo: [val] }))
                                        )
                                    }
                                />
                            </View>

                            <View style={styles.formGrid}>
                                <DropdownField
                                    label="Category"
                                    value={form.category}
                                    onPress={() =>
                                        openDropdown(
                                            'Category',
                                            [
                                                { label: 'TASK', value: 'TASK' },
                                                { label: 'TODO', value: 'TODO' },
                                            ],
                                            (val) => setForm((f) => ({ ...f, category: val }))
                                        )
                                    }
                                />
                                <DropdownField
                                    label="Priority"
                                    value={form.priority}
                                    onPress={() =>
                                        openDropdown(
                                            'Priority',
                                            [
                                                { label: 'Low', value: 'Low' },
                                                { label: 'Medium', value: 'Medium' },
                                                { label: 'High', value: 'High' },
                                            ],
                                            (val) => setForm((f) => ({ ...f, priority: val }))
                                        )
                                    }
                                />
                            </View>

                            <DropdownField
                                label="Status"
                                value={(form.status || 'todo').replace('_', ' ').toUpperCase()}
                                onPress={() =>
                                    openDropdown(
                                        'Status',
                                        [
                                            { label: 'TO DO', value: 'todo' },
                                            { label: 'IN PROGRESS', value: 'in_progress' },
                                            { label: 'REVIEW', value: 'review' },
                                            { label: 'COMPLETED', value: 'completed' },
                                        ],
                                        (val) => setForm((f) => ({ ...f, status: val }))
                                    )
                                }
                            />

                            <View style={styles.formGrid}>
                                <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={() => openDatePicker('startDate')}>
                                    <CustomInput
                                        label="Start date"
                                        placeholder="YYYY-MM-DD"
                                        value={form.startDate}
                                        editable={false}
                                        icon="calendar-start"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={() => openDatePicker('dueDate')}>
                                    <CustomInput
                                        label="Due date"
                                        placeholder="YYYY-MM-DD"
                                        value={form.dueDate}
                                        editable={false}
                                        icon="calendar-check"
                                    />
                                </TouchableOpacity>
                            </View>

                            {Platform.OS === 'ios' && datePickerMode ? (
                                <DateTimePicker
                                    value={parsePickerDate(form[datePickerMode])}
                                    mode="date"
                                    display="spinner"
                                    onChange={(event, selectedDate) => {
                                        if (event.type === 'set' && selectedDate) {
                                            const mode = datePickerMode;
                                            setForm((prev) => ({ ...prev, [mode]: formatDate(selectedDate) }));
                                        }
                                    }}
                                />
                            ) : null}

                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={styles.descriptionInput}
                                placeholder="Task description or scope..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={form.description}
                                onChangeText={(t) => setForm({ ...form, description: t })}
                            />

                            <View style={styles.footerActions}>
                                <TouchableOpacity onPress={closeCreateModal} style={styles.footerCancel}>
                                    <Text style={styles.footerCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.footerSaveTpl}
                                    onPress={() =>
                                        Alert.alert('Save template', 'Templates are managed from the web app.')
                                    }
                                    activeOpacity={0.85}
                                >
                                    <MaterialCommunityIcons name="content-save-outline" size={moderateScale(18)} color="#2563EB" />
                                    <Text style={styles.footerSaveTplText}>Save template</Text>
                                </TouchableOpacity>
                                <View style={styles.footerCreateWrap}>
                                    <CustomButton title="Create task" onPress={handleCreateTask} loading={loading} />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={[styles.selBox, { maxWidth: isTablet ? 420 : '88%' }]}>
                        <Text style={styles.selTitle}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: verticalScale(300) }} keyboardShouldPersistTaps="handled">
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={i} style={styles.selItem} onPress={() => selOnSelect(opt.value)}>
                                    <Text style={styles.selLabel}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selClose} onPress={() => setSelVisible(false)}>
                            <Text style={styles.selCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {loading && !showModal ? (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator color="#2563EB" size="large" />
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerTitleSection: { },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    screenTitle: { fontWeight: '900', color: '#0F172A' },
    breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
    breadcrumbText: { fontWeight: '800', color: '#64748B' },
    newTaskBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center' },
    newTaskBtnText: { color: '#fff', fontWeight: '900' },
    stickyActionArea: { backgroundColor: '#F8FAFC' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, color: '#1E293B' },
    tabsContainer: { flexDirection: 'row', backgroundColor: '#EDF2F7' },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
    tabActive: { backgroundColor: '#fff', elevation: 2 },
    tabText: { fontWeight: '800', color: '#94A3B8' },
    tabTextActive: { color: '#1E293B' },
    listContainer: {},
    commandSubtitleForeman: { fontSize: moderateScale(9), fontWeight: '800', color: '#64748B', letterSpacing: 1 },

    taskItemWrapper: { position: 'relative', marginBottom: verticalScale(10) },
    treeConnector: {
        position: 'absolute',
        left: scale(-14),
        top: 0,
        bottom: 0,
        width: scale(18),
        zIndex: 1,
    },
    connectorVertical: {
        position: 'absolute',
        left: scale(9),
        top: verticalScale(-8),
        bottom: verticalScale(22),
        width: 1.5,
        backgroundColor: '#CBD5E1',
    },
    connectorHorizontal: {
        position: 'absolute',
        left: scale(9),
        top: verticalScale(22),
        width: scale(11),
        height: 1.5,
        backgroundColor: '#CBD5E1',
    },
    taskTableRow: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(16),
        padding: moderateScale(12),
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    subtaskCard: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', shadowOpacity: 0.05 },
    deepSubtaskCard: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
    tableTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(10) },
    tableNameCol: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: scale(8), minWidth: 0 },
    indicatorLine: { width: scale(3), minHeight: moderateScale(22), borderRadius: 2 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(6), marginBottom: 2 },
    typeBadge: { paddingHorizontal: scale(6), paddingVertical: verticalScale(2), borderRadius: 4 },
    typeBadgeText: { fontSize: moderateScale(7), fontWeight: '900' },
    parentTag: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(2),
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxWidth: scale(120),
    },
    parentTagText: { fontSize: moderateScale(7), fontWeight: '900', color: '#64748B' },
    taskTitlePm: { color: '#0F172A' },
    projectContextPm: { fontSize: moderateScale(10), fontWeight: '700', color: '#64748B', marginTop: verticalScale(2) },
    progressTrack: {
        height: verticalScale(4),
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
    progressLabel: { fontSize: moderateScale(9), fontWeight: '800', color: '#94A3B8', marginTop: verticalScale(3) },
    tableMetricCol: { alignItems: 'flex-end', gap: 4 },
    miniStatusBadge: { paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: 6, borderWidth: 1 },
    miniStatusText: { fontSize: moderateScale(8), fontWeight: '900' },
    tableBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: verticalScale(8),
    },
    assigneeColPm: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
    assigneeTextPm: { fontSize: moderateScale(10), fontWeight: '800', color: '#64748B', flex: 1 },
    dateColPm: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
    tableDateTextPm: { fontSize: moderateScale(10), fontWeight: '800', color: '#64748B' },
    actionsColPm: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
    emptyView: { alignItems: 'center' },
    emptyTitle: { fontWeight: '800', color: '#1E293B' },
    emptySub: { color: '#94A3B8', textAlign: 'center' },
    loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
    sheetContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: scale(18),
        paddingTop: verticalScale(10),
        maxHeight: '92%',
        width: '100%',
    },
    sheetIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: verticalScale(12) },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(8) },
    sheetTitle: { fontSize: moderateScale(20), fontWeight: '900', color: '#0F172A', flex: 1 },
    sheetCloseBtn: { padding: scale(6), borderRadius: 12, backgroundColor: '#F1F5F9' },

    label: { fontSize: moderateScale(9), fontWeight: '900', color: '#64748B', textTransform: 'uppercase', marginBottom: verticalScale(6), marginTop: verticalScale(8), letterSpacing: 1 },
    compactDropdown: {
        height: verticalScale(42),
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#3B82F633',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(12),
        marginBottom: verticalScale(6),
    },
    dropdownValue: { fontSize: moderateScale(13), fontWeight: '800', color: '#1E293B', flex: 1, marginRight: scale(6) },
    formGrid: { flexDirection: 'row', gap: scale(12), alignItems: 'flex-start' },
    descriptionInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: scale(12),
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#1E293B',
        textAlignVertical: 'top',
        minHeight: verticalScale(88),
        marginBottom: verticalScale(12),
    },

    footerActions: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: scale(8),
        marginTop: verticalScale(12),
        flexWrap: 'wrap',
    },
    footerCancel: { justifyContent: 'center', paddingVertical: verticalScale(12), paddingHorizontal: scale(4) },
    footerCancelText: { fontSize: moderateScale(12), fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
    footerSaveTpl: {
        flex: 1,
        minWidth: scale(100),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(4),
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(6),
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    footerSaveTplText: { fontSize: moderateScale(10), fontWeight: '800', color: '#2563EB' },
    footerCreateWrap: { flex: 1.25, minWidth: scale(120) },

    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: scale(20) },
    selBox: { width: '88%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: scale(20), elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
    selTitle: { fontSize: moderateScale(15), fontWeight: '900', color: '#0F172A', marginBottom: verticalScale(14), textAlign: 'center', textTransform: 'uppercase' },
    selItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: verticalScale(14), borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { fontSize: moderateScale(14), fontWeight: '700', color: '#334155', flex: 1 },
    selClose: { marginTop: verticalScale(14), paddingVertical: verticalScale(12), alignItems: 'center' },
    selCloseText: { fontSize: moderateScale(12), fontWeight: '900', color: '#64748B', textTransform: 'uppercase' },
});


export default ForemanTasksScreen;
