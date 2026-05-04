import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SHADOWS } from '../../constants/theme';

const COLLAPSE_KEY = 'taskHierarchyCollapsedV1';
const PRIORITIES = ['Low', 'Medium', 'High'];

const getAssignableRoleOptions = (currentRole) => {
    if (['FOREMAN', 'SUBCONTRACTOR'].includes(currentRole)) {
        return [{ label: 'WORKER', value: 'WORKER' }];
    }
    if (['PM', 'COMPANY_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(currentRole)) {
        return [
            { label: 'WORKER', value: 'WORKER' },
            { label: 'FOREMAN', value: 'FOREMAN' },
            { label: 'PM', value: 'PM' },
            { label: 'SUBCONTRACTOR', value: 'SUBCONTRACTOR' }
        ];
    }
    return [{ label: 'WORKER', value: 'WORKER' }];
};

const STATUS_PALETTE = {
    todo: { color: '#64748B', bg: '#F1F5F9', label: 'TODO' },
    pending: { color: '#64748B', bg: '#F1F5F9', label: 'TODO' },
    in_progress: { color: '#3B82F6', bg: '#EFF6FF', label: 'LIVE' },
    review: { color: '#F59E0B', bg: '#FFFBEB', label: 'REVIEW' },
    completed: { color: '#10B981', bg: '#ECFDF5', label: 'DONE' }
};

function getStatusDisplay(status) {
    const st = String(status || 'todo').toLowerCase().replace(/[\s-]+/g, '_');
    if (STATUS_PALETTE[st]) return STATUS_PALETTE[st];
    if (st.includes('progress')) return STATUS_PALETTE.in_progress;
    return STATUS_PALETTE.todo;
}

function assigneeLabel(task) {
    const a = Array.isArray(task?.assignedTo) ? task.assignedTo[0] : task?.assignedTo;
    return a?.fullName || a?.name || 'Unassigned';
}

function dueShort(task) {
    if (!task?.dueDate) return 'No Date';
    try {
        return new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
        return 'No Date';
    }
}

function cmpTaskNodeOrder(a, b) {
    const pa = a.position;
    const pb = b.position;
    if (pa != null && pb != null && pa !== pb) return pa - pb;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

const TaskHierarchyDetailScreen = ({ route, navigation }) => {
    const { taskId } = route.params || {};
    const { tasks, updateTask, deleteTask, refreshData, teamMembers, fetchTeamMembers, user } = useApp();
    const insets = useSafeAreaInsets();
    const { width: winW, height: winH } = useWindowDimensions();
    const isCompact = winW < 380;

    const navigateRoot = useCallback(
        (name, params) => {
            let nav = navigation;
            for (let i = 0; i < 10; i++) {
                const parent = nav.getParent?.();
                if (!parent) break;
                nav = parent;
            }
            nav.navigate?.(name, params);
        },
        [navigation]
    );
    const [collapsed, setCollapsed] = useState(new Set());
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'Medium', status: 'todo' });
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});
    const [datePickerField, setDatePickerField] = useState(null);
    const [subTasks, setSubTasks] = useState([]);
    const loadSubTasks = useCallback(async () => {
        if (!taskId) return;
        try {
            const res = await api.get(`/tasks/${taskId}/subtasks`);
            setSubTasks(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setSubTasks([]);
        }
    }, [taskId]);
    const formatDateInput = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    };
    const handleSafeBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Main');
    };

    useEffect(() => {
        const restore = async () => {
            try {
                const raw = await AsyncStorage.getItem(COLLAPSE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setCollapsed(new Set(parsed.map(String)));
            } catch (e) {}
        };
        restore();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
            fetchTeamMembers?.();
            loadSubTasks();
        });
        return unsubscribe;
    }, [navigation, refreshData, fetchTeamMembers, loadSubTasks]);

    useEffect(() => {
        loadSubTasks();
    }, [loadSubTasks]);

    useEffect(() => {
        AsyncStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(collapsed))).catch(() => {});
    }, [collapsed]);

    const selectedTask = useMemo(() => (tasks || []).find(t => String(t._id || t.id) === String(taskId)), [tasks, taskId]);

    const tree = useMemo(() => {
        const map = new Map();
        (tasks || []).forEach((t) => map.set(String(t._id || t.id), { ...t, children: [] }));
        (tasks || []).forEach((t) => {
            const node = map.get(String(t._id || t.id));
            const parentId = t.parentTaskId ? String(t.parentTaskId?._id || t.parentTaskId) : null;
            if (parentId && map.has(parentId)) map.get(parentId).children.push(node);
        });
        const root = map.get(String(taskId)) || null;
        const sortRec = (node) => {
            if (!node?.children?.length) return;
            node.children.sort(cmpTaskNodeOrder);
            node.children.forEach(sortRec);
        };
        if (root) sortRec(root);
        return root;
    }, [tasks, taskId]);

    const ancestorChain = useMemo(() => {
        const list = tasks || [];
        const byId = new Map(list.map(t => [String(t._id || t.id), t]));
        const chain = [];
        let cursor = selectedTask;
        const seen = new Set();
        while (cursor?.parentTaskId) {
            const parentId = String(cursor.parentTaskId?._id || cursor.parentTaskId);
            if (!parentId || seen.has(parentId) || !byId.has(parentId)) break;
            seen.add(parentId);
            const parent = byId.get(parentId);
            chain.unshift(parent);
            cursor = parent;
        }
        return chain;
    }, [tasks, selectedTask]);

    const rows = useMemo(() => {
        const output = [];
        const walk = (nodes, depth = 0) => {
            (nodes || []).forEach((node) => {
                const id = String(node._id || node.id);
                const isCollapsed = collapsed.has(id);
                output.push({ ...node, __depth: depth, __isCollapsed: isCollapsed });
                if (node.children?.length && !isCollapsed) walk(node.children, depth + 1);
            });
        };
        walk(tree?.children || [], 0);
        return output;
    }, [tree, collapsed]);

    const subTaskRows = useMemo(() => {
        const list = Array.isArray(subTasks) ? subTasks : [];
        if (list.length === 0) return [];
        const byParent = new Map();
        list.forEach((st) => {
            const parentId = st.parentSubTaskId ? String(st.parentSubTaskId?._id || st.parentSubTaskId) : '';
            if (!byParent.has(parentId)) byParent.set(parentId, []);
            byParent.get(parentId).push(st);
        });

        const flat = [];
        const walk = (parentId = '', depth = 0) => {
            const nodes = byParent.get(parentId) || [];
            nodes.forEach((node) => {
                const id = String(node._id || node.id);
                const collapsedNode = collapsed.has(`sub-${id}`);
                const hasChildren = (byParent.get(id) || []).length > 0;
                flat.push({ ...node, __depth: depth, __isCollapsed: collapsedNode, __isSubTaskNode: true, __hasChildren: hasChildren });
                if (!collapsedNode) walk(id, depth + 1);
            });
        };
        walk('', 0);
        return flat;
    }, [subTasks, collapsed]);

    const filteredTeamByRole = useMemo(() => {
        if (!editForm?.assignedRoleType) return teamMembers || [];
        return (teamMembers || []).filter(m => m.role === editForm.assignedRoleType);
    }, [teamMembers, editForm?.assignedRoleType]);

    const toggleCollapse = (id) => {
        const sid = String(id);
        const next = new Set(collapsed);
        if (next.has(sid)) next.delete(sid);
        else next.add(sid);
        setCollapsed(next);
    };

    const isCompletedStatus = (status) => {
        const normalized = String(status || '').toLowerCase();
        return normalized === 'completed' || normalized === 'done';
    };

    const toggleTaskCompletion = async (task) => {
        const id = task?._id || task?.id;
        if (!id) return;
        const nextStatus = isCompletedStatus(task?.status) ? 'todo' : 'completed';
        const payload = { status: nextStatus };

        if (task?.__isSubTaskNode) {
            try {
                await api.patch(`/tasks/${taskId}/subtasks/${id}`, payload);
                await loadSubTasks();
            } catch (e) {
                Alert.alert('Error', 'Unable to update subtask status.');
            }
            return;
        }

        await updateTask(id, payload);
        await loadSubTasks();
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (value) => {
            onSelect(value);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const openEdit = (task) => {
        const assigned = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;
        setEditTarget(task);
        setEditForm({
            title: task.title || '',
            description: task.description || task.remarks || '',
            priority: ['Low', 'Medium', 'High'].includes(task.priority) ? task.priority : 'Medium',
            status: task.status || 'todo',
            category: task.category || 'TASK',
            assignedRoleType: task.assignedRoleType || '',
            assignedTo: assigned?._id || assigned || '',
            startDate: formatDateInput(task.startDate),
            dueDate: formatDateInput(task.dueDate)
        });
    };

    const saveEdit = async () => {
        if (!editTarget?._id && !editTarget?.id) return;
        const targetId = editTarget._id || editTarget.id;
        if (editTarget.__isSubTaskNode) {
            const payload = {
                title: editForm.title || '',
                remarks: editForm.description || '',
                status: editForm.status || 'todo',
                priority: editForm.priority || 'Medium',
                startDate: editForm.startDate || undefined,
                dueDate: editForm.dueDate || undefined,
                assignedTo: editForm.assignedTo || undefined
            };
            try {
                await api.patch(`/tasks/${taskId}/subtasks/${targetId}`, payload);
            } catch (e) {
                Alert.alert('Error', 'Unable to update subtask.');
                return;
            }
            await loadSubTasks();
        } else {
            const payload = {
                ...editForm,
                category: editForm.category || 'TASK',
                startDate: editForm.startDate || undefined,
                dueDate: editForm.dueDate || undefined,
                assignedTo: editForm.assignedTo || undefined,
                assignedRoleType: editForm.assignedRoleType || undefined
            };
            await updateTask(targetId, payload);
        }
        setEditTarget(null);
    };

    const parsePickerDate = (value) => {
        if (!value || typeof value !== 'string') return new Date();
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            const y = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const d = Number(m[3]);
            return new Date(y, mo, d);
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return new Date();
        return parsed;
    };

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const openAndroidDatePicker = (field) => {
        DateTimePickerAndroid.open({
            value: parsePickerDate(editForm[field]),
            mode: 'date',
            is24Hour: true,
            onChange: (event, selectedDate) => {
                if (event.type !== 'set' || !selectedDate) return;
                const dateStr = formatDateLocal(selectedDate);
                setEditForm(prev => ({ ...prev, [field]: dateStr }));
            }
        });
    };

    const handleDelete = (task) => {
        if (task?.__isSubTaskNode) {
            Alert.alert('Delete SubTask', `Delete "${task.title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/tasks/${taskId}/subtasks/${task._id || task.id}`);
                            await loadSubTasks();
                        } catch (e) {
                            Alert.alert('Error', 'Unable to delete subtask.');
                        }
                    }
                }
            ]);
            return;
        }
        const id = task._id || task.id;
        const hasChildren = (tasks || []).some(t => String(t.parentTaskId ? (t.parentTaskId?._id || t.parentTaskId) : '') === String(id));

        if (!hasChildren) {
            Alert.alert('Delete Task', `Delete "${task.title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) }
            ]);
            return;
        }

        Alert.alert('Delete Parent Task', 'This task has children.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Move Children Up', onPress: () => deleteTask(id, { action: 'moveUpward' }) },
            { text: 'Delete All', style: 'destructive', onPress: () => deleteTask(id, { action: 'cascade' }) }
        ]);
    };

    const renderChildRow = (item, { isApiSubtask }) => {
        const depth = item.__depth || 0;
        const id = item._id || item.id;
        const sc = getStatusDisplay(item.status);
        const levelLabel = isApiSubtask ? 'JOB SUBTASK' : depth === 0 ? 'SUBTASK' : `LEVEL ${depth + 1}`;
        const projectLine = item.projectId?.name || item.project || selectedTask?.projectId?.name || selectedTask?.project || 'Main Project';
        const marginLeft = Math.min(depth * 14, 56);
        const hasTreeChildren = isApiSubtask ? item.__hasChildren : !!(item.children?.length);
        const collapsedFlag = isApiSubtask ? item.__isCollapsed : item.__isCollapsed;
        const onToggleCollapse = () => toggleCollapse(isApiSubtask ? `sub-${id}` : id);

        return (
            <View key={isApiSubtask ? `sub-${id}` : id} style={[styles.taskItemWrapper, { marginLeft }]}>
                {depth > 0 ? (
                    <View style={styles.treeConnector}>
                        <View style={[styles.connectorVertical, { bottom: 22 }]} />
                        <View style={styles.connectorHorizontal} />
                    </View>
                ) : null}
                <View
                    style={[
                        styles.hierCard,
                        SHADOWS.small,
                        depth > 0 && styles.hierCardNested,
                        isApiSubtask && styles.hierCardApi
                    ]}
                >
                    <View style={styles.hierTopRow}>
                        <View style={styles.hierNameCol}>
                            <View style={[styles.indicatorLine, { backgroundColor: sc.color }]} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.badgeRowHier}>
                                    <View style={[styles.typeBadgeHier, { backgroundColor: depth === 0 ? '#F0FDF4' : '#FFF7ED' }]}>
                                        <Text style={[styles.typeBadgeTextHier, { color: depth === 0 ? '#22C55E' : '#F97316' }]}>{levelLabel}</Text>
                                    </View>
                                </View>
                                <View style={styles.hierTitleRow}>
                                    {hasTreeChildren ? (
                                        <TouchableOpacity style={{ padding: 2 }} onPress={onToggleCollapse}>
                                            <MaterialCommunityIcons
                                                name={collapsedFlag ? 'chevron-right' : 'chevron-down'}
                                                size={18}
                                                color="#64748B"
                                            />
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity onPress={() => toggleTaskCompletion(item)} style={styles.checkboxBtn}>
                                        <MaterialCommunityIcons
                                            name={isCompletedStatus(item?.status) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                            size={20}
                                            color={isCompletedStatus(item?.status) ? '#16A34A' : '#64748B'}
                                        />
                                    </TouchableOpacity>
                                    <Text
                                        style={[styles.hierTitleText, isCompletedStatus(item?.status) ? styles.completedText : null, isCompact && { fontSize: 12 }]}
                                        numberOfLines={2}
                                    >
                                        {item.title || item.remarks || 'Untitled'}
                                    </Text>
                                </View>
                                <Text style={styles.hierProjectLine} numberOfLines={1}>
                                    {projectLine}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.hierMetricCol}>
                            <View style={[styles.miniStatusBadge, { backgroundColor: sc.bg, borderColor: `${sc.color}33` }]}>
                                <Text style={[styles.miniStatusText, { color: sc.color }]}>{sc.label}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.hierBottomRow}>
                        <View style={[styles.assigneeColHier, { flex: 1.4 }]}>
                            <MaterialCommunityIcons name="account-circle-outline" size={12} color="#94A3B8" />
                            <Text style={styles.assigneeTextHier} numberOfLines={1}>
                                {assigneeLabel(item)}
                            </Text>
                        </View>
                        <View style={[styles.dateColHier, { flex: 1 }]}>
                            <MaterialCommunityIcons name="calendar-clock" size={12} color="#94A3B8" />
                            <Text style={styles.dateTextHier} numberOfLines={1}>
                                {dueShort(item)}
                            </Text>
                        </View>
                        <View style={styles.actionsColHier}>
                            <TouchableOpacity
                                onPress={() =>
                                    isApiSubtask
                                        ? navigateRoot('TaskCreate', {
                                              isChild: true,
                                              isSubTaskParent: true,
                                              parentTaskId: id,
                                              parentSubTaskId: id,
                                              rootTaskId: selectedTask._id || selectedTask.id,
                                              parentTitle: item.title,
                                              projectId: selectedTask?.projectId?._id || selectedTask?.projectId
                                          })
                                        : navigateRoot('TaskCreate', {
                                              isChild: true,
                                              parentTaskId: id,
                                              projectId: item?.projectId?._id || item?.projectId || selectedTask?.projectId?._id || selectedTask?.projectId
                                          })
                                }
                            >
                                <MaterialCommunityIcons name="plus-box-outline" size={isCompact ? 16 : 18} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openEdit(item)}>
                                <MaterialCommunityIcons name="pencil" size={isCompact ? 16 : 18} color="#10B981" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item)}>
                                <MaterialCommunityIcons name="delete-outline" size={isCompact ? 16 : 18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (!selectedTask || !tree) {
        return <View style={styles.centered}><Text style={styles.emptyText}>Task not found.</Text></View>;
    }

    const rootProjectName = selectedTask.projectId?.name || selectedTask.project || 'Main Project';
    const rootMeta = (selectedTask.description || selectedTask.remarks || '').trim() || 'No description';
    const rootSc = getStatusDisplay(selectedTask.status);
    const rootProgress = Math.min(100, Math.max(0, Number(selectedTask.progress) || 0));
    const directChildCount = (tree?.children || []).length;

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
                <TouchableOpacity onPress={handleSafeBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.headerTitle}>Task Hierarchy</Text>
                    <Text style={styles.headerSubtitle}>TASK TRACKING & ASSIGNMENT</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {ancestorChain.length > 0 && (
                    <View style={styles.breadcrumbCard}>
                        <Text style={styles.breadcrumbLabel}>Hierarchy Path</Text>
                        <Text style={styles.breadcrumbText}>
                            {ancestorChain.map(t => t.title).concat([selectedTask.title]).join('  >  ')}
                        </Text>
                    </View>
                )}

                <View style={[styles.mainCard, SHADOWS.small]}>
                    <View style={styles.mainRow}>
                        <TouchableOpacity onPress={() => toggleTaskCompletion(selectedTask)} style={styles.checkboxBtn}>
                            <MaterialCommunityIcons
                                name={isCompletedStatus(selectedTask?.status) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={22}
                                color={isCompletedStatus(selectedTask?.status) ? '#16A34A' : '#64748B'}
                            />
                        </TouchableOpacity>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.badgeRowHier}>
                                <View style={[styles.typeBadgeHier, { backgroundColor: '#EFF6FF' }]}>
                                    <Text style={[styles.typeBadgeTextHier, { color: '#3B82F6' }]}>MAIN TASK</Text>
                                </View>
                            </View>
                            <Text style={[styles.mainTitle, isCompletedStatus(selectedTask?.status) ? styles.completedText : null]} numberOfLines={2}>
                                {selectedTask.title}
                            </Text>
                            <Text style={styles.mainProjectLine} numberOfLines={1}>
                                {rootProjectName}
                            </Text>
                        </View>
                        <View style={[styles.miniStatusBadge, { backgroundColor: rootSc.bg, borderColor: `${rootSc.color}33` }]}>
                            <Text style={[styles.miniStatusText, { color: rootSc.color }]}>{rootSc.label}</Text>
                        </View>
                    </View>
                    <Text style={styles.metaText}>{rootMeta}</Text>
                    {directChildCount > 0 ? (
                        <View style={{ marginTop: 8 }}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${rootProgress}%` }]} />
                            </View>
                            <Text style={styles.progressLabel}>{Math.round(rootProgress)}% · {directChildCount} subtask{directChildCount !== 1 ? 's' : ''}</Text>
                        </View>
                    ) : null}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => navigateRoot('TaskCreate', {
                                isChild: true,
                                parentTaskId: selectedTask._id || selectedTask.id,
                                projectId: selectedTask?.projectId?._id || selectedTask?.projectId
                            })}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                            <Text style={styles.primaryBtnText}>Add SubTask</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(selectedTask)}>
                            <MaterialCommunityIcons name="pencil-outline" size={18} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(selectedTask)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {rows.length > 0 ? (
                    <View style={{ marginBottom: 6 }}>
                        <Text style={styles.sectionLabel}>Task children</Text>
                        {rows.map((item) => renderChildRow(item, { isApiSubtask: false }))}
                    </View>
                ) : null}

                {subTaskRows.length > 0 ? (
                    <View style={{ marginBottom: 6 }}>
                        <Text style={styles.sectionLabel}>Linked job subtasks</Text>
                        {subTaskRows.map((item) => renderChildRow(item, { isApiSubtask: true }))}
                    </View>
                ) : null}

                {(rows.length === 0 && subTaskRows.length === 0) ? <Text style={styles.emptyText}>No child tasks yet.</Text> : null}
            </ScrollView>

            <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
                >
                    <View style={styles.modalOverlayInner}>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalTitle}>Edit Task</Text>
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                style={{ maxHeight: Math.min(winH * 0.48, 340) }}
                                contentContainerStyle={styles.modalScrollContent}
                            >
                                <TextInput style={styles.input} placeholder="Title" value={editForm.title} onChangeText={(v) => setEditForm(prev => ({ ...prev, title: v }))} />
                                <TextInput style={[styles.input, { height: 90 }]} multiline placeholder="Description" value={editForm.description} onChangeText={(v) => setEditForm(prev => ({ ...prev, description: v }))} />
                                <Text style={styles.fieldLabel}>Category</Text>
                                <TouchableOpacity
                                    style={styles.dropdownField}
                                    onPress={() => openDropdown('Category', [
                                        { label: 'TASK', value: 'TASK' },
                                        { label: 'TODO', value: 'TODO' }
                                    ], (value) => setEditForm(prev => ({ ...prev, category: value })))}
                                >
                                    <Text style={styles.dropdownValue}>{editForm.category || 'TASK'}</Text>
                                    <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                </TouchableOpacity>

                                <Text style={styles.fieldLabel}>Status</Text>
                                <TouchableOpacity
                                    style={styles.dropdownField}
                                    onPress={() => openDropdown('Status', [
                                        { label: 'TODO', value: 'todo' },
                                        { label: 'IN PROGRESS', value: 'in_progress' },
                                        { label: 'REVIEW', value: 'review' },
                                        { label: 'COMPLETED', value: 'completed' }
                                    ], (value) => setEditForm(prev => ({ ...prev, status: value })))}
                                >
                                    <Text style={styles.dropdownValue}>{String(editForm.status || 'todo').replace('_', ' ').toUpperCase()}</Text>
                                    <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                </TouchableOpacity>

                                <Text style={styles.fieldLabel}>Priority</Text>
                                <TouchableOpacity
                                    style={styles.dropdownField}
                                    onPress={() => openDropdown('Priority', PRIORITIES.map(p => ({ label: p, value: p })), (value) => setEditForm(prev => ({ ...prev, priority: value })))}
                                >
                                    <Text style={styles.dropdownValue}>{editForm.priority || 'Medium'}</Text>
                                    <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                </TouchableOpacity>

                                <Text style={styles.fieldLabel}>Assign Role</Text>
                                <TouchableOpacity
                                    style={styles.dropdownField}
                                    onPress={() =>
                                        openDropdown(
                                            'Assign Role',
                                            [{ label: 'ANY ROLE', value: '' }, ...getAssignableRoleOptions(user?.role)],
                                            (value) => setEditForm(prev => ({ ...prev, assignedRoleType: value, assignedTo: '' }))
                                        )
                                    }
                                >
                                    <Text style={styles.dropdownValue}>{editForm.assignedRoleType || 'ANY ROLE'}</Text>
                                    <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                </TouchableOpacity>

                                <Text style={styles.fieldLabel}>Assign To</Text>
                                <TouchableOpacity
                                    style={styles.dropdownField}
                                    onPress={() => openDropdown(
                                        'Assign To',
                                        [
                                            { label: 'UNASSIGNED', value: '' },
                                            ...((filteredTeamByRole || []).slice(0, 30).map((m) => ({
                                                label: m.fullName || m.name || 'Member',
                                                value: m._id || m.id
                                            })))
                                        ],
                                        (value) => setEditForm(prev => ({ ...prev, assignedTo: value }))
                                    )}
                                >
                                    <Text style={styles.dropdownValue}>
                                        {(filteredTeamByRole || []).find(m => String(m._id || m.id) === String(editForm.assignedTo || ''))?.fullName || 'Unassigned'}
                                    </Text>
                                    <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                </TouchableOpacity>
                                <View style={styles.dateGrid}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.fieldLabel}>START DATE</Text>
                                        <TouchableOpacity style={styles.dropdownField} onPress={() => {
                                            if (Platform.OS === 'android') openAndroidDatePicker('startDate');
                                            else setDatePickerField('startDate');
                                        }}>
                                            <Text style={styles.dropdownValue}>{editForm.startDate || 'Select date'}</Text>
                                            <MaterialCommunityIcons name="calendar" size={16} color="#3B82F6" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.fieldLabel}>DUE DATE</Text>
                                        <TouchableOpacity style={styles.dropdownField} onPress={() => {
                                            if (Platform.OS === 'android') openAndroidDatePicker('dueDate');
                                            else setDatePickerField('dueDate');
                                        }}>
                                            <Text style={styles.dropdownValue}>{editForm.dueDate || 'Select date'}</Text>
                                            <MaterialCommunityIcons name="calendar" size={16} color="#3B82F6" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                            <View style={styles.modalBtns}>
                                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setEditTarget(null)}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveEdit}>
                                    <Text style={styles.saveText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={`${String(opt.value)}-${i}`} style={styles.selItem} onPress={() => selOnSelect(opt.value)}>
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

            {Platform.OS === 'ios' && datePickerField ? (
                <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                    <DateTimePicker
                        value={parsePickerDate(editForm[datePickerField])}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                            if (selectedDate) {
                                const dateStr = formatDateLocal(selectedDate);
                                setEditForm(prev => ({ ...prev, [datePickerField]: dateStr }));
                            }
                        }}
                    />
                    <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setDatePickerField(null)}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    headerSubtitle: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginTop: 2 },
    content: { padding: 16, paddingBottom: 40 },
    sectionLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
    breadcrumbCard: { backgroundColor: '#EEF2FF', borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE', padding: 10, marginBottom: 10 },
    breadcrumbLabel: { fontSize: 10, color: '#6366F1', fontWeight: '900', textTransform: 'uppercase' },
    breadcrumbText: { marginTop: 4, color: '#1E3A8A', fontSize: 12, fontWeight: '700' },
    mainCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
    mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    mainTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 4 },
    mainProjectLine: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4 },
    metaText: { color: '#64748B', marginTop: 8, fontSize: 12, lineHeight: 18 },
    progressTrack: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
    progressLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
    primaryBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    iconBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8 },
    taskItemWrapper: { position: 'relative', marginBottom: 10 },
    treeConnector: { position: 'absolute', left: -12, top: 0, bottom: 0, width: 14, zIndex: 1 },
    connectorVertical: { position: 'absolute', left: 7, top: -6, bottom: 20, width: 1.5, backgroundColor: '#CBD5E1' },
    connectorHorizontal: { position: 'absolute', left: 7, top: 20, width: 10, height: 1.5, backgroundColor: '#CBD5E1' },
    hierCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    hierCardNested: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
    hierCardApi: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    hierTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    hierNameCol: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
    indicatorLine: { width: 3, minHeight: 22, borderRadius: 2 },
    badgeRowHier: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
    typeBadgeHier: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeBadgeTextHier: { fontSize: 7, fontWeight: '900' },
    hierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    hierTitleText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
    hierProjectLine: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4 },
    hierMetricCol: { alignItems: 'flex-end', marginLeft: 6 },
    miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    miniStatusText: { fontSize: 8, fontWeight: '900' },
    hierBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8
    },
    assigneeColHier: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    assigneeTextHier: { fontSize: 10, fontWeight: '800', color: '#64748B', flex: 1 },
    dateColHier: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateTextHier: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    actionsColHier: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkboxBtn: { paddingHorizontal: 2, paddingVertical: 2 },
    completedText: { textDecorationLine: 'line-through', color: '#64748B' },
    emptyText: { textAlign: 'center', color: '#64748B', marginTop: 20, fontWeight: '700' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    modalOverlayInner: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    modalBody: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '92%' },
    modalScrollContent: { paddingBottom: 8 },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: '#fff' },
    chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
    chipBtn: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    chipBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    chipText: { fontSize: 10, fontWeight: '800', color: '#334155' },
    chipTextActive: { color: '#fff' },
    fieldLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', marginBottom: 6 },
    dateGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    dropdownField: {
        height: 42,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#3B82F633',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginBottom: 10
    },
    dropdownValue: { fontSize: 13, fontWeight: '800', color: '#1E293B', flex: 1, marginRight: 8 },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#F1F5F9' },
    saveBtn: { backgroundColor: '#2563EB' },
    cancelText: { color: '#475569', fontWeight: '800' },
    saveText: { color: '#fff', fontWeight: '800' },
    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '84%', backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    selTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' },
    selItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { color: '#334155', fontSize: 13, fontWeight: '700' },
    selClose: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
    selCloseText: { color: '#64748B', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    pickerDoneBtn: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    pickerDoneText: { color: '#2563EB', fontWeight: '800', fontSize: 14 }
});

export default TaskHierarchyDetailScreen;
