import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const COLLAPSE_KEY = 'taskHierarchyCollapsedV1';
const PRIORITIES = ['Low', 'Medium', 'High'];

const TaskHierarchyDetailScreen = ({ route, navigation }) => {
    const { taskId } = route.params || {};
    const { tasks, updateTask, deleteTask, refreshData, teamMembers, fetchTeamMembers } = useApp();
    const insets = useSafeAreaInsets();
    const [collapsed, setCollapsed] = useState(new Set());
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'Medium', status: 'todo' });
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});
    const [datePickerField, setDatePickerField] = useState(null);
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
        });
        return unsubscribe;
    }, [navigation, refreshData]);

    useEffect(() => {
        AsyncStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(collapsed))).catch(() => {});
    }, [collapsed]);

    const selectedTask = useMemo(() => (tasks || []).find(t => String(t._id || t.id) === String(taskId)), [tasks, taskId]);

    const tree = useMemo(() => {
        const map = new Map();
        (tasks || []).forEach(t => map.set(String(t._id || t.id), { ...t, children: [] }));
        map.forEach((node) => {
            const parentId = node.parentTaskId ? String(node.parentTaskId?._id || node.parentTaskId) : null;
            if (parentId && map.has(parentId)) map.get(parentId).children.push(node);
        });
        return map.get(String(taskId)) || null;
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
            description: task.description || '',
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
        const payload = {
            ...editForm,
            category: editForm.category || 'TASK',
            startDate: editForm.startDate || undefined,
            dueDate: editForm.dueDate || undefined,
            assignedTo: editForm.assignedTo || undefined,
            assignedRoleType: editForm.assignedRoleType || undefined
        };
        await updateTask(editTarget._id || editTarget.id, payload);
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

    if (!selectedTask || !tree) {
        return <View style={styles.centered}><Text style={styles.emptyText}>Task not found.</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
                <TouchableOpacity onPress={handleSafeBack}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Task Hierarchy</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {ancestorChain.length > 0 && (
                    <View style={styles.breadcrumbCard}>
                        <Text style={styles.breadcrumbLabel}>Hierarchy Path</Text>
                        <Text style={styles.breadcrumbText}>
                            {ancestorChain.map(t => t.title).concat([selectedTask.title]).join('  >  ')}
                        </Text>
                    </View>
                )}

                <View style={styles.mainCard}>
                    <Text style={styles.mainTitle}>{selectedTask.title}</Text>
                    <Text style={styles.metaText}>{selectedTask.description || 'No description'}</Text>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => navigation.navigate('TaskCreate', {
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

                {rows.map((item) => (
                    <View key={item._id || item.id} style={[styles.childRow, { marginLeft: Math.min((item.__depth || 0) * 16, 64) }]}>
                        <View style={styles.leftBar} />
                        {item.children?.length ? (
                            <TouchableOpacity onPress={() => toggleCollapse(item._id || item.id)} style={{ paddingHorizontal: 2 }}>
                                <MaterialCommunityIcons name={item.__isCollapsed ? 'chevron-right' : 'chevron-down'} size={18} color="#64748B" />
                            </TouchableOpacity>
                        ) : null}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.childTitle}>{item.title}</Text>
                            <Text style={styles.childMeta}>{(item.status || 'todo').toUpperCase()}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('TaskCreate', {
                                isChild: true,
                                parentTaskId: item._id || item.id,
                                projectId: item?.projectId?._id || item?.projectId || selectedTask?.projectId?._id || selectedTask?.projectId
                            })}
                        >
                            <MaterialCommunityIcons name="plus-box-outline" size={18} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEdit(item)}>
                            <MaterialCommunityIcons name="pencil" size={18} color="#10B981" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item)}>
                            <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ))}

                {rows.length === 0 ? <Text style={styles.emptyText}>No child tasks yet.</Text> : null}
            </ScrollView>

            <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBody}>
                        <Text style={styles.modalTitle}>Edit Task</Text>
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
                            onPress={() => openDropdown('Assign Role', [
                                { label: 'ANY ROLE', value: '' },
                                { label: 'WORKER', value: 'WORKER' },
                                { label: 'FOREMAN', value: 'FOREMAN' },
                                { label: 'PM', value: 'PM' },
                                { label: 'SUBCONTRACTOR', value: 'SUBCONTRACTOR' }
                            ], (value) => setEditForm(prev => ({ ...prev, assignedRoleType: value, assignedTo: '' })))}
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
    content: { padding: 16, paddingBottom: 40 },
    breadcrumbCard: { backgroundColor: '#EEF2FF', borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE', padding: 10, marginBottom: 10 },
    breadcrumbLabel: { fontSize: 10, color: '#6366F1', fontWeight: '900', textTransform: 'uppercase' },
    breadcrumbText: { marginTop: 4, color: '#1E3A8A', fontSize: 12, fontWeight: '700' },
    mainCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
    mainTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    metaText: { color: '#64748B', marginTop: 4, fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
    primaryBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    iconBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8 },
    childRow: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    leftBar: { width: 3, height: 24, borderRadius: 2, backgroundColor: '#94A3B8' },
    childTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    childMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#64748B', marginTop: 20, fontWeight: '700' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    modalBody: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
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
