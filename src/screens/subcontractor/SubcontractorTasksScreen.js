import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Animated, ActivityIndicator, 
    SafeAreaView, StatusBar, ScrollView, Modal, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

const SubcontractorTasksScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 380;
    const { tasks, addTask, updateTask, refreshData, user, projects, teamMembers } = useApp();
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    // Filter Bar State
    const [selStatus, setSelStatus] = useState('All Statuses');
    const [selType, setSelType] = useState('All Types');
    const [selRole, setSelRole] = useState('All Roles');
    const [selProject, setSelProject] = useState('All Projects');

    // Create Task Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '', description: '', priority: 'Medium', status: 'todo',
        projectId: '', jobId: '', assignedTo: '', assignedRole: 'Any Role',
        category: 'Task', 
        startDate: new Date().toISOString().split('T')[0], 
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });

    // Selection Popup State
    const [selModalVisible, setSelModalVisible] = useState(false);
    const [selTarget, setSelTarget] = useState(''); 
    const [selOptions, setSelOptions] = useState([]);
    const [selTitle, setSelTitle] = useState('');

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', refreshData);
        return unsubscribe;
    }, [navigation]);

    const stats = (tasks || []).reduce((acc, t) => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        if (due && due < new Date() && t.status !== 'completed') acc.overdue++;
        if (t.status === 'completed') acc.done++;
        else if (t.status === 'in_progress' || t.status === 'review') acc.active++;
        return acc;
    }, { overdue: 0, active: 0, done: 0 });

    const statusValueMap = {
        'All Statuses': '',
        'To Do': 'todo',
        'In Progress': 'in_progress',
        'Completed': 'completed'
    };

    const normalizeTaskType = (task) => {
        const raw = String(task?.category || '').toLowerCase();
        if (!raw) return 'task';
        if (raw.includes('safety')) return 'safety';
        if (raw.includes('material')) return 'material';
        return 'task';
    };

    const normalizeTaskRole = (task) => {
        const explicitRole = String(task?.assignedRoleType || '').toUpperCase();
        if (explicitRole) return explicitRole;
        const assigned = Array.isArray(task?.assignedTo) ? task.assignedTo[0] : task?.assignedTo;
        const assignedRole = String(assigned?.role || '').toUpperCase();
        if (assignedRole) return assignedRole;
        const assignedId = assigned?._id || assigned?.id || assigned;
        const member = (teamMembers || []).find((m) => String(m._id || m.id) === String(assignedId || ''));
        return String(member?.role || '').toUpperCase();
    };

    const filteredTasks = (tasks || []).filter(t => {
        const matchesSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || 
                             (t.projectId?.name || '').toLowerCase().includes(search.toLowerCase());
        const selectedStatus = statusValueMap[selStatus] || '';
        const matchesStatus = !selectedStatus || String(t.status || '').toLowerCase() === selectedStatus;
        const matchesProject = selProject === 'All Projects' || (t.projectId?._id === selProject || t.projectId === selProject);
        const selectedType = selType === 'All Types' ? '' : selType.toLowerCase();
        const matchesType = !selectedType || normalizeTaskType(t) === selectedType;
        const selectedRole = selRole === 'All Roles' ? '' : selRole.toUpperCase();
        const matchesRole = !selectedRole || normalizeTaskRole(t) === selectedRole;
        return matchesSearch && matchesStatus && matchesProject && matchesType && matchesRole;
    });

    const openSelector = (target) => {
        setSelTarget(target);
        let options = [];
        let title = '';

        switch (target) {
            case 'filter_status':
                title = 'Select Status';
                options = [{id: 'All Statuses', label: 'All Statuses'}, {id: 'todo', label: 'To Do'}, {id: 'in_progress', label: 'In Progress'}, {id: 'completed', label: 'Completed'}];
                break;
            case 'filter_project':
                title = 'Select Project';
                options = [{id: 'All Projects', label: 'All Projects'}, ...(projects || []).map(p => ({ id: p._id || p.id, label: p.name }))];
                break;
            case 'filter_type':
                title = 'Select Type';
                options = [{id: 'All Types', label: 'All Types'}, {id: 'Task', label: 'Task'}, {id: 'Safety', label: 'Safety'}, {id: 'Material', label: 'Material'}];
                break;
            case 'filter_role':
                title = 'Select Role';
                options = [{id: 'All Roles', label: 'All Roles'}, {id: 'Foreman', label: 'Foreman'}, {id: 'Worker', label: 'Worker'}, {id: 'Subcontractor', label: 'Subcontractor'}];
                break;
            case 'create_project':
                title = 'Select Project';
                options = (projects || []).map(p => ({ id: p._id || p.id, label: p.name }));
                break;
            case 'create_job':
                title = 'Select Job';
                options = [{id: '', label: 'None/General'}, {id: 'Site Prep', label: 'Site Prep'}, {id: 'Foundation', label: 'Foundation'}, {id: 'Framing', label: 'Framing'}];
                break;
            case 'create_role':
                title = 'Assign Role';
                options = [{id: 'Any Role', label: 'Any Role'}, {id: 'Foreman', label: 'Foreman'}, {id: 'Worker', label: 'Worker'}, {id: 'Subcontractor', label: 'Subcontractor'}];
                break;
            case 'create_user':
                title = 'Assign To';
                options = [{id: '', label: 'Unassigned'}, ...(teamMembers || []).map(m => ({ id: m._id || m.id, label: m.fullName }))];
                break;
            case 'create_category':
                title = 'Category';
                options = [{id: 'Task', label: 'Task'}, {id: 'Safety', label: 'Safety Check'}, {id: 'Material', label: 'Material Request'}];
                break;
            case 'create_priority':
                title = 'Priority';
                options = [{id: 'Low', label: 'Low'}, {id: 'Medium', label: 'Medium'}, {id: 'High', label: 'High'}];
                break;
            case 'create_status':
                title = 'Status';
                options = [{id: 'todo', label: 'To Do'}, {id: 'in_progress', label: 'In Progress'}, {id: 'completed', label: 'Completed'}];
                break;
        }

        setSelOptions(options);
        setSelTitle(title);
        setSelModalVisible(true);
    };

    const handleSelect = (item) => {
        if (selTarget.startsWith('filter_')) {
            if (selTarget === 'filter_status') setSelStatus(item.label);
            if (selTarget === 'filter_project') setSelProject(item.id === 'All Projects' ? 'All Projects' : item.id);
            if (selTarget === 'filter_type') setSelType(item.label);
            if (selTarget === 'filter_role') setSelRole(item.label);
        } else {
            const update = { ...newTask };
            if (selTarget === 'create_project') update.projectId = item.id;
            if (selTarget === 'create_job') update.jobId = item.id;
            if (selTarget === 'create_role') update.assignedRole = item.id;
            if (selTarget === 'create_user') update.assignedTo = item.id;
            if (selTarget === 'create_category') update.category = item.id;
            if (selTarget === 'create_priority') update.priority = item.id;
            if (selTarget === 'create_status') update.status = item.id;
            setNewTask(update);
        }
        setSelModalVisible(false);
    };

    const toggleTaskStatus = async (task) => {
        let nxt = 'in_progress';
        if (task.status === 'todo') nxt = 'in_progress';
        else if (task.status === 'in_progress') nxt = 'review';
        else if (task.status === 'review') nxt = 'completed';
        else nxt = 'todo';
        setLoading(true);
        await updateTask(task._id || task.id, { status: nxt });
        refreshData();
        setLoading(false);
    };

    const handleCreateTask = async () => {
        if (!newTask.title.trim() || !newTask.projectId) {
            Alert.alert('Required', 'Please enter title and project.');
            return;
        }
        try {
            setIsSubmitting(true);
            const success = await addTask({ ...newTask, assignedTo: newTask.assignedTo ? [newTask.assignedTo] : [user?._id] });
            if (success) {
                setIsCreateModalVisible(false);
                setNewTask({ title: '', description: '', priority: 'Medium', status: 'todo', projectId: '', assignedTo: '', assignedRole: 'Any Role', category: 'Task', startDate: '', dueDate: '' });
                refreshData();
                Alert.alert('Success', 'Task Created');
            }
        } finally { setIsSubmitting(false); }
    };

    const renderTaskCard = ({ item }) => {
        const progress = item.status === 'completed' ? 100 : (item.status === 'in_progress' ? 50 : 0);
        return (
            <View style={[styles.taskCard, SHADOWS.medium]}>
                <View style={[styles.urgencyStripe, { backgroundColor: item.priority === 'High' ? '#EF4444' : '#10B981' }]} />
                <View style={styles.cardHeader}>
                    <Text style={styles.projectIdText}>{item.projectId?.name || 'GENERIC SITE'}</Text>
                    <TouchableOpacity onPress={() => toggleTaskStatus(item)}>
                        <MaterialCommunityIcons name={item.status === 'completed' ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={22} color={item.status === 'completed' ? "#10B981" : "#CBD5E1"} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <View style={styles.pBarBg}><View style={[styles.pBarFill, { width: `${progress}%` }]} /></View>
                <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No Deadline'}</Text>
                    <View style={styles.avatar}><Text style={{fontSize: 9}}>{(item.assignedTo?.[0]?.fullName || 'U').charAt(0)}</Text></View>
                </View>
            </View>
        );
    };

    const FilterBtnRow = ({ label, onPress, flex=1 }) => (
        <TouchableOpacity style={[styles.filterBtnSmall, { flex }]} onPress={onPress}>
            <Text style={styles.filterBtnSmallTxt} numberOfLines={1}>{label}</Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color="#64748B" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <WorkerHeader title="Tasks" navigation={navigation} />
            
            <View style={[styles.topSection, { paddingHorizontal: isCompact ? 14 : 20, paddingVertical: isCompact ? 14 : 20 }]}>
                <View style={styles.headerTopRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { fontSize: isCompact ? 18 : 20 }]}>Task Command Center</Text>
                        <Text style={styles.headerSubtitle}>MODULE TRACKING</Text>
                    </View>
                    <TouchableOpacity style={[styles.plusBtn, { paddingHorizontal: isCompact ? 10 : 12 }]} onPress={() => setIsCreateModalVisible(true)}>
                        <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
                        <Text style={[styles.plusBtnTxt, { fontSize: isCompact ? 10 : 11 }]}>Add Task</Text>
                    </TouchableOpacity>
                </View>

                {/* SEARCH & FILTER TOGGLE */}
                <View style={styles.searchRow}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                        <TextInput style={styles.searchInput} placeholder="Search tasks..." value={search} onChangeText={setSearch} />
                    </View>
                    <TouchableOpacity 
                        style={[styles.filterToggle, isFilterVisible && styles.filterToggleActive]} 
                        onPress={() => setIsFilterVisible(!isFilterVisible)}
                    >
                        <MaterialCommunityIcons name="tune-variant" size={20} color={isFilterVisible ? "#fff" : "#2563EB"} />
                    </TouchableOpacity>
                </View>

                {/* COLLAPSIBLE FILTERS GRID */}
                {isFilterVisible && (
                    <View style={styles.filtersGrid}>
                        <View style={styles.row}>
                            <FilterBtnRow label={selStatus} onPress={() => openSelector('filter_status')} />
                            <FilterBtnRow label={selType} onPress={() => openSelector('filter_type')} />
                        </View>
                        <View style={styles.row}>
                            <FilterBtnRow label={selRole} onPress={() => openSelector('filter_role')} />
                            <FilterBtnRow label={projects.find(p => p._id === selProject)?.name || 'All Projects'} onPress={() => openSelector('filter_project')} />
                        </View>
                    </View>
                )}
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 24), maxWidth: width >= 900 ? 980 : undefined, alignSelf: 'center', width: '100%' }}
            >


                {loading ? <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} /> : (
                    <View style={{ paddingHorizontal: isCompact ? 14 : 20 }}>
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map(item => <View key={item._id || item.id}>{renderTaskCard({ item })}</View>)
                        ) : (
                            <View style={styles.emptyState}><Text style={styles.emptyTitle}>No Tasks Found</Text></View>
                        )}
                    </View>
                )}
                <View style={{ height: Math.max(insets.bottom + 60, 80) }} />
            </ScrollView>

            {/* CREATE TASK MODAL (Software-Style) */}
            <Modal visible={isCreateModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>New Operation Task</Text>
                                <Text style={styles.modalSubHeader}>DIRECT BACKEND SYNC • ASIA PACIFIC</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <MaterialCommunityIcons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Title Section */}
                            <Text style={styles.inputLab}>TASK TITLE</Text>
                            <TextInput 
                                style={[styles.input, { marginBottom: 15 }]} 
                                placeholder="Enter title..." 
                                value={newTask.title} 
                                onChangeText={t => setNewTask({...newTask, title: t})} 
                            />

                            {/* Project & Job Row */}
                            <View style={styles.mRow}>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="briefcase-outline" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>PROJECT</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_project')}>
                                        <Text style={styles.mSelTxt} numberOfLines={1}>{projects.find(p => (p._id || p.id) === newTask.projectId)?.name || 'Select Project'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="target" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>JOB (OPTIONAL)</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_job')}>
                                        <Text style={styles.mSelTxt}>{newTask.jobId || 'Select Job'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Role & Assign Row */}
                            <View style={styles.mRow}>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="account-outline" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>ASSIGN ROLE</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_role')}>
                                        <Text style={styles.mSelTxt}>{newTask.assignedRole}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="account-multiple-outline" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>ASSIGN TO</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_user')}>
                                        <Text style={styles.mSelTxt} numberOfLines={1}>{teamMembers.find(m => (m._id || m.id) === newTask.assignedTo)?.fullName || 'Unassigned'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Category & Priority Row */}
                            <View style={styles.mRow}>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="layers-outline" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>CATEGORY</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_category')}>
                                        <Text style={styles.mSelTxt}>{newTask.category}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.mCol}>
                                    <View style={styles.labelRow}>
                                        <MaterialCommunityIcons name="flag-outline" size={14} color="#2563EB" />
                                        <Text style={styles.inputLab}>PRIORITY</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mSel} onPress={() => openSelector('create_priority')}>
                                        <Text style={styles.mSelTxt}>{newTask.priority}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Status Section (Full Width) */}
                            <Text style={styles.inputLab}>STATUS</Text>
                            <TouchableOpacity style={[styles.mSel, { width: '100%', marginBottom: 15 }]} onPress={() => openSelector('create_status')}>
                                <Text style={styles.mSelTxt}>{newTask.status === 'todo' ? 'To Do' : newTask.status === 'in_progress' ? 'In Progress' : 'Completed'}</Text>
                                <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                            </TouchableOpacity>

                            {/* Description */}
                            <Text style={styles.inputLab}>DESCRIPTION / NOTES</Text>
                            <TextInput 
                                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} 
                                multiline 
                                placeholder="Add instructions..." 
                                value={newTask.description} 
                                onChangeText={t => setNewTask({...newTask, description: t})} 
                            />

                            {/* Submit Button */}
                            <TouchableOpacity 
                                style={styles.mSubmitBtn} 
                                onPress={handleCreateTask} 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.mSubmitBtnTxt}>Create task</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* SELECTION POPUP */}
            <Modal visible={selModalVisible} transparent animationType="fade">
                <View style={styles.selOverlay}><View style={styles.selBox}>
                    <Text style={styles.selTitle}>{selTitle}</Text>
                    <ScrollView style={{ maxHeight: 300 }}>{selOptions.map((opt, i) => (<TouchableOpacity key={i} style={styles.selItem} onPress={() => handleSelect(opt)}><Text style={styles.selItemTxt}>{opt.label}</Text></TouchableOpacity>))}</ScrollView>
                    <TouchableOpacity onPress={() => setSelModalVisible(false)} style={styles.selCancel}><Text style={{ fontWeight: '900' }}>CANCEL</Text></TouchableOpacity>
                </View></View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    topSection: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    headerSubtitle: { fontSize: 8, fontWeight: '900', color: '#3B82F6' },
    plusBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 4 },
    plusBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
    searchRow: { flexDirection: 'row', gap: 10 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '600' },
    filterToggle: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    filterToggleActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    filtersGrid: { marginTop: 15, gap: 10 },
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    filterBtnSmall: { minHeight: 44, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    filterBtnSmallTxt: { fontSize: 11, fontWeight: '700', color: '#475569' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
    statItem: { width: '31.5%', minWidth: 100, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    statVal: { fontSize: 14, fontWeight: '900' },
    statLab: { fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
    taskCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
    urgencyStripe: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    projectIdText: { fontSize: 9, fontWeight: '800', color: '#64748B' },
    taskTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    pBarBg: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, marginBottom: 12 },
    pBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
    avatar: { width: 22, height: 22, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '92%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontSize: 18, fontWeight: '900' },
    inputLab: { fontSize: 8, fontWeight: '900', color: '#64748B', marginTop: 10, marginBottom: 4 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, height: 44, fontSize: 13, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12 },
    sel: { backgroundColor: '#F8FAFC', borderRadius: 10, height: 44, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', paddingHorizontal: 12 },
    selTxt: { fontSize: 12, fontWeight: '600' },
    submitBtn: { backgroundColor: '#2563EB', height: 50, borderRadius: 12, marginTop: 20, justifyContent: 'center', alignItems: 'center' },
    submitBtnTxt: { color: '#fff', fontWeight: '900' },
    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
    selTitle: { fontSize: 14, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
    selItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selItemTxt: { fontSize: 14, fontWeight: '600' },
    selCancel: { marginTop: 15, alignItems: 'center' },
    emptyState: { padding: 50, alignItems: 'center' },
    emptyTitle: { color: '#CBD5E1', fontWeight: '900' },
    
    // Premium Modal Enhancements
    modalCard: { width: '100%', height: '90%', backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, position: 'absolute', bottom: 0 },
    modalSubHeader: { fontSize: 8, fontWeight: '900', color: '#3B82F6', marginTop: 2, letterSpacing: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
    inputLab: { fontSize: 9, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 14, height: 50, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, color: '#0F172A' },
    mRow: { flexDirection: 'row', gap: 12 },
    mCol: { flex: 1 },
    mSel: { backgroundColor: '#F8FAFC', borderRadius: 14, height: 50, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
    mSelTxt: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    mSubmitBtn: { backgroundColor: '#2563EB', height: 62, borderRadius: 18, marginTop: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 4 },
    mSubmitBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '900' }
});

export default SubcontractorTasksScreen;
