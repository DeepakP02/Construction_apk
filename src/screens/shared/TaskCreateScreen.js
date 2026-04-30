import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIORITIES = ['Low', 'Medium', 'High'];

const TaskCreateScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 390;
    const { parentTaskId, projectId: projectIdFromRoute, isChild } = route.params || {};
    const { addTask, addChildTask, tasks, projects, teamMembers, fetchTeamMembers, selectedProject } = useApp();
    const [saving, setSaving] = useState(false);
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});
    const [datePickerField, setDatePickerField] = useState(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'TASK',
        status: 'todo',
        assignedRoleType: '',
        priority: 'Medium',
        startDate: '',
        dueDate: '',
        assignedTo: ''
    });
    const handleSafeBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Main');
    };

    useEffect(() => {
        fetchTeamMembers();
    }, []);

    const parentTask = useMemo(() => {
        if (!parentTaskId) return null;
        return (tasks || []).find(t => String(t._id || t.id) === String(parentTaskId)) || null;
    }, [tasks, parentTaskId]);
    const normalizedParentTaskId = parentTaskId ? String(parentTaskId) : '';
    const isChildMode = Boolean(isChild || normalizedParentTaskId);

    const resolvedProjectId = useMemo(() => {
        const extractId = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'object') return value._id || value.id || '';
            return '';
        };

        const routeProjectId = extractId(projectIdFromRoute);
        const parentProjectId = extractId(parentTask?.projectId);
        const selectedProjectId = extractId(selectedProject);
        const firstProjectId = extractId((projects || [])[0]);

        return routeProjectId || parentProjectId || selectedProjectId || firstProjectId || '';
    }, [projectIdFromRoute, parentTask, selectedProject, projects]);

    const resolvedProjectName = useMemo(() => {
        const pid = String(resolvedProjectId || '');
        if (!pid) return 'Unknown Project';
        const fromList = (projects || []).find(p => String(p._id || p.id) === pid);
        return fromList?.name || parentTask?.projectId?.name || selectedProject?.name || 'Project';
    }, [projects, resolvedProjectId, parentTask, selectedProject]);

    const filteredTeamByRole = useMemo(() => {
        if (!form.assignedRoleType) return teamMembers || [];
        return (teamMembers || []).filter(member => member.role === form.assignedRoleType);
    }, [teamMembers, form.assignedRoleType]);

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (value) => {
            onSelect(value);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const normalizeDateInput = (value) => {
        if (!value || typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!slashMatch) return trimmed;
        const dd = slashMatch[1].padStart(2, '0');
        const mm = slashMatch[2].padStart(2, '0');
        const yyyy = slashMatch[3];
        return `${yyyy}-${mm}-${dd}`;
    };

    const onSave = async () => {
        if (!form.title.trim()) {
            Alert.alert('Validation', 'Task title is required.');
            return;
        }
        if (!resolvedProjectId) {
            Alert.alert('Validation', 'Project not found for this task.');
            return;
        }
        if (isChildMode && !normalizedParentTaskId) {
            Alert.alert('Validation', 'Child task requires a parent task. Please use Add Child from the parent task.');
            return;
        }
        if (isChildMode && !parentTask) {
            Alert.alert('Validation', 'Parent task not found. Please reopen hierarchy and try again.');
            return;
        }

        setSaving(true);
        const payload = {
            title: form.title.trim(),
            description: form.description || '',
            category: form.category || 'TASK',
            status: form.status || 'todo',
            assignedRoleType: form.assignedRoleType || undefined,
            priority: form.priority || 'Medium',
            startDate: normalizeDateInput(form.startDate) || undefined,
            dueDate: normalizeDateInput(form.dueDate) || undefined,
            assignedTo: form.assignedTo || undefined,
            projectId: resolvedProjectId,
            parentTaskId: normalizedParentTaskId || undefined,
            isChild: isChildMode
        };

        const success = isChildMode
            ? await addChildTask(normalizedParentTaskId, payload)
            : await addTask(payload);
        setSaving(false);

        if (!success) {
            Alert.alert('Error', 'Unable to create task. Please try again.');
            return;
        }

        Alert.alert('Success', 'Task created successfully.');
        handleSafeBack();
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
            value: parsePickerDate(form[field]),
            mode: 'date',
            is24Hour: true,
            onChange: (event, selectedDate) => {
                if (event.type !== 'set' || !selectedDate) return;
                const dateStr = formatDateLocal(selectedDate);
                setForm(prev => ({ ...prev, [field]: dateStr }));
            }
        });
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
                <TouchableOpacity onPress={handleSafeBack}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isChildMode ? 'Create Child Task' : 'Create New Task'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>PROJECT</Text>
                    <Text style={styles.infoValue}>{resolvedProjectName}</Text>
                    {parentTask ? (
                        <>
                            <Text style={[styles.infoLabel, { marginTop: 8 }]}>PARENT TASK</Text>
                            <Text style={styles.infoValue}>{parentTask.title}</Text>
                        </>
                    ) : null}
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.label}>Task Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Install Safety Nets Level 3"
                        value={form.title}
                        onChangeText={(v) => setForm(prev => ({ ...prev, title: v }))}
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Task description..."
                        value={form.description}
                        multiline
                        onChangeText={(v) => setForm(prev => ({ ...prev, description: v }))}
                    />

                    <Text style={styles.label}>Category</Text>
                    <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDropdown('Category', [
                            { label: 'TASK', value: 'TASK' },
                            { label: 'TODO', value: 'TODO' }
                        ], (value) => setForm(prev => ({ ...prev, category: value })))}
                    >
                        <Text style={styles.dropdownValue}>{form.category}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>

                    <Text style={styles.label}>Status</Text>
                    <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDropdown('Status', [
                            { label: 'TODO', value: 'todo' },
                            { label: 'IN PROGRESS', value: 'in_progress' },
                            { label: 'REVIEW', value: 'review' },
                            { label: 'COMPLETED', value: 'completed' }
                        ], (value) => setForm(prev => ({ ...prev, status: value })))}
                    >
                        <Text style={styles.dropdownValue}>{String(form.status).replace('_', ' ').toUpperCase()}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>

                    <Text style={styles.label}>Priority</Text>
                    <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDropdown('Priority', PRIORITIES.map(p => ({ label: p, value: p })), (value) => setForm(prev => ({ ...prev, priority: value })))}
                    >
                        <Text style={styles.dropdownValue}>{form.priority}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>

                    <Text style={styles.label}>Assign Role</Text>
                    <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDropdown('Assign Role', [
                            { label: 'ANY ROLE', value: '' },
                            { label: 'WORKER', value: 'WORKER' },
                            { label: 'FOREMAN', value: 'FOREMAN' },
                            { label: 'PM', value: 'PM' },
                            { label: 'SUBCONTRACTOR', value: 'SUBCONTRACTOR' }
                        ], (value) => setForm(prev => ({ ...prev, assignedRoleType: value, assignedTo: '' })))}
                    >
                        <Text style={styles.dropdownValue}>{form.assignedRoleType || 'ANY ROLE'}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>

                    <View style={[styles.dateGrid, isCompact ? styles.dateGridStack : null]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Start Date</Text>
                            <TouchableOpacity style={styles.dropdownField} onPress={() => {
                                if (Platform.OS === 'android') openAndroidDatePicker('startDate');
                                else setDatePickerField('startDate');
                            }}>
                                <Text style={styles.dropdownValue}>{form.startDate || 'Select date'}</Text>
                                <MaterialCommunityIcons name="calendar" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Due Date</Text>
                            <TouchableOpacity style={styles.dropdownField} onPress={() => {
                                if (Platform.OS === 'android') openAndroidDatePicker('dueDate');
                                else setDatePickerField('dueDate');
                            }}>
                                <Text style={styles.dropdownValue}>{form.dueDate || 'Select date'}</Text>
                                <MaterialCommunityIcons name="calendar" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.label}>Assign To</Text>
                    <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDropdown(
                            'Assign To',
                            [
                                { label: 'UNASSIGNED', value: '' },
                                ...((filteredTeamByRole || []).slice(0, 30).map(member => ({
                                    label: member.fullName || member.name || 'Member',
                                    value: member._id || member.id
                                })))
                            ],
                            (value) => setForm(prev => ({ ...prev, assignedTo: value }))
                        )}
                    >
                        <Text style={styles.dropdownValue}>
                            {(filteredTeamByRole || []).find(m => String(m._id || m.id) === String(form.assignedTo || ''))?.fullName || 'Unassigned'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleSafeBack} disabled={saving}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
                    <Text style={styles.saveText}>{saving ? 'Creating...' : 'Create Task'}</Text>
                </TouchableOpacity>
            </View>

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
                        value={parsePickerDate(form[datePickerField])}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                            if (selectedDate) {
                                const dateStr = formatDateLocal(selectedDate);
                                setForm(prev => ({ ...prev, [datePickerField]: dateStr }));
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    content: { padding: 16, paddingBottom: 24 },
    formCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginTop: 10 },
    infoCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, marginBottom: 14 },
    infoLabel: { fontSize: 10, color: '#64748B', fontWeight: '800' },
    infoValue: { fontSize: 13, color: '#1E3A8A', fontWeight: '800', marginTop: 2 },
    label: { fontSize: 10, color: '#64748B', fontWeight: '900', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#3B82F633', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1E293B' },
    textArea: { minHeight: 90, textAlignVertical: 'top' },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityPill: { flex: 1, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    priorityPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    priorityText: { color: '#475569', fontWeight: '800', fontSize: 12 },
    priorityTextActive: { color: '#fff' },
    dateGrid: { flexDirection: 'row', gap: 10 },
    dateGridStack: { flexDirection: 'column', gap: 8 },
    dropdownField: {
        height: 42,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#3B82F633',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12
    },
    dropdownValue: { fontSize: 13, fontWeight: '800', color: '#1E293B', flex: 1, marginRight: 8 },
    footer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    cancelBtn: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    saveBtn: { flex: 1.5, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
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

export default TaskCreateScreen;
