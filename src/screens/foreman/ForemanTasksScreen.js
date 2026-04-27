import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, Dimensions, ScrollView, RefreshControl, StatusBar, Modal, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { Calendar } from 'react-native-calendars';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ForemanTasksScreen = ({ navigation }) => {
    const { tasks, addTask, refreshData, projects, teamMembers, jobs, user } = useApp();
    const { width } = useWindowDimensions();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('ALL TASKS');
    const [showModal, setShowModal] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateTarget, setDateTarget] = useState('startDate');

    // Form State
    const [form, setForm] = useState({
        title: '',
        projectId: '',
        jobId: '',
        assignedRoleType: 'FOREMAN',
        assignedTo: [],
        category: 'TASK',
        priority: 'Medium',
        status: 'todo',
        startDate: '',
        dueDate: '',
        description: ''
    });

    const onDateSelect = (day) => {
        setForm({ ...form, [dateTarget]: day.dateString });
        setShowDatePicker(false);
    };

    const openDatePicker = (target) => {
        setDateTarget(target);
        setShowDatePicker(true);
    };

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => { refreshData(); });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const filteredTasks = (tasks || []).filter(t => {
        const q = search.toLowerCase();
        const matchesSearch = (t.title || '').toLowerCase().includes(q) ||
                              (t.projectId?.name || '').toLowerCase().includes(q);

        if (activeTab === 'MY TASKS') {
            const myId = user?._id || user?.id;
            const isAssignedToMe = Array.isArray(t.assignedTo)
                ? t.assignedTo.some(a => (a?._id || a?.id || a) === myId)
                : (t.assignedTo?._id || t.assignedTo?.id || t.assignedTo) === myId;
            return matchesSearch && isAssignedToMe;
        }
        return matchesSearch;
    });

    const [selectConfig, setSelectConfig] = useState({ visible: false, title: '', options: [], field: '' });

    const openSelector = (title, field, options) => {
        setSelectConfig({ visible: true, title, field, options });
    };

    const handleSelectAction = (val) => {
        if (selectConfig.field === 'assignedTo') {
            setForm({ ...form, assignedTo: [val] });
        } else {
            setForm({ ...form, [selectConfig.field]: val });
        }
        setSelectConfig({ visible: false, title: '', options: [], field: '' });
    };

    const handleCreateTask = async () => {
        if (!form.title) { alert('Task Title is required'); return; }
        if (!form.projectId) { alert('Please select a Project'); return; }

        setLoading(true);
        try {
            const success = await addTask(form);
            if (success) {
                setShowModal(false);
                setForm({
                    title: '', projectId: '', jobId: '', assignedRoleType: 'FOREMAN',
                    assignedTo: [], category: 'TASK', priority: 'Medium', status: 'todo',
                    startDate: '', dueDate: '', description: ''
                });
                refreshData();
            } else { alert('Failed to create task.'); }
        } catch (e) { alert('Network Error.'); } finally { setLoading(false); }
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('todo')) return { bg: '#F1F5F9', text: '#64748B' };
        if (s.includes('progress')) return { bg: '#EFF6FF', text: '#2563EB' };
        if (s.includes('review')) return { bg: '#FEF3C7', text: '#D97706' };
        if (s.includes('completed') || s.includes('done')) return { bg: '#ECFDF5', text: '#10B981' };
        return { bg: '#F1F5F9', text: '#64748B' };
    };

    const renderTaskCard = ({ item }) => {
        const statusStyle = getStatusColor(item.status);
        const priority = (item.priority || 'Medium').toLowerCase();
        const pColor = priority === 'high' ? '#EF4444' : (priority === 'medium' ? '#F59E0B' : '#10B981');

        return (
            <TouchableOpacity
                style={[styles.taskCard, SHADOWS.small, { padding: moderateScale(16), borderRadius: moderateScale(20), marginBottom: verticalScale(16) }]}
                onPress={() => navigation.navigate('TaskDetail', { task: item })}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { fontSize: moderateScale(15) }]}>{item.title}</Text>
                        <Text style={[styles.projectSubtitle, { fontSize: moderateScale(11), marginTop: verticalScale(2) }]}>{item.projectId?.name || item.projectName || 'General Project'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(6) }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text, fontSize: moderateScale(9) }]}>{(item.status || 'TODO').replace('_', ' ').toUpperCase()}</Text>
                    </View>
                </View>

                <View style={[styles.cardDivider, { height: verticalScale(1), marginVertical: verticalScale(12) }]} />

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={[styles.infoLabel, { fontSize: moderateScale(8) }]}>ASSIGNED TO</Text>
                            <View style={[styles.assigneeWrap, { marginTop: verticalScale(4) }]}>
                                <View style={[styles.avatarMini, { width: scale(20), height: scale(20), borderRadius: scale(10), marginRight: scale(6) }]}>
                                    <Text style={[styles.avatarTxt, { fontSize: moderateScale(9) }]}>
                                        {(item.assignedTo?.[0]?.fullName || 'U')[0]}
                                    </Text>
                                </View>
                                <Text style={[styles.infoVal, { fontSize: moderateScale(12) }]} numberOfLines={1}>
                                    {item.assignedTo?.[0]?.fullName || 'Unassigned'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={[styles.infoLabel, { fontSize: moderateScale(8) }]}>PRIORITY</Text>
                            <View style={[styles.priorityBadge, { backgroundColor: pColor + '20', paddingHorizontal: scale(6), paddingVertical: verticalScale(2), borderRadius: moderateScale(4), marginTop: verticalScale(4) }]}>
                                <Text style={[styles.priorityText, { color: pColor, fontSize: moderateScale(9) }]}>{(item.priority || 'MEDIUM').toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Task" showBranding={true} />

            <ScrollView
                stickyHeaderIndices={[2]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={[styles.headerTitleSection, { padding: scale(20) }]}>
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.screenTitle, { fontSize: moderateScale(24) }]}>Task Center</Text>
                            <View style={[styles.breadcrumbRow, { marginTop: verticalScale(4) }]}>
                                <MaterialCommunityIcons name="layers-triple" size={moderateScale(12)} color="#2563EB" />
                                <Text style={[styles.breadcrumbText, { fontSize: moderateScale(10), marginLeft: scale(4) }]}>FOREMAN • OPS</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.newTaskBtn, { paddingHorizontal: scale(16), paddingVertical: verticalScale(10), borderRadius: moderateScale(12) }]} onPress={() => setShowModal(true)} activeOpacity={0.8}>
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
                    {(filteredTasks || []).length > 0 ? (
                        filteredTasks.map((task, i) => (
                            <View key={`task-${task._id || task.id || i}-${i}`}>
                                {renderTaskCard({ item: task })}
                            </View>
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

            {/* Create Task Modal - Premium Redesign */}
            <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { height: '92%', borderTopLeftRadius: SIZES.radiusLg * 2, borderTopRightRadius: SIZES.radiusLg * 2, width: isTablet ? 600 : '100%', maxWidth: '100%', alignSelf: 'center' }]}>
                        
                        {/* Pull Indicator */}
                        <View style={styles.pullIndicator} />

                        <View style={[styles.modalHeader, { paddingHorizontal: scale(24), paddingTop: verticalScale(16), paddingBottom: verticalScale(8) }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalHeaderTitle, { fontSize: moderateScale(24) }]}>New Task</Text>
                                <Text style={[styles.modalHeaderSub, { fontSize: moderateScale(13) }]}>Assign duties to your team</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setShowModal(false)} 
                                style={[styles.closeBtn, { width: scale(32), height: scale(32), borderRadius: 16 }]}
                            >
                                <MaterialCommunityIcons name="close" size={moderateScale(18)} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            style={[styles.modalForm, { paddingHorizontal: scale(24) }]} 
                            showsVerticalScrollIndicator={false} 
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: verticalScale(100) }}
                        >
                            {/* Section: Basic Information */}
                            <View style={styles.formSection}>
                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11) }]}>BASIC INFORMATION</Text>
                                
                                <View style={styles.inputWrapper}>
                                    <View style={styles.inputIcon}>
                                        <MaterialCommunityIcons name="format-title" size={18} color={COLORS.primaryAccent} />
                                    </View>
                                    <TextInput
                                        style={[styles.premiumInput, { fontSize: moderateScale(14) }]}
                                        placeholder="Task Title"
                                        value={form.title}
                                        onChangeText={(val) => setForm({ ...form, title: val })}
                                        placeholderTextColor={COLORS.textMuted}
                                    />
                                </View>

                                <View style={[styles.inputWrapper, { height: verticalScale(100), alignItems: 'flex-start', paddingTop: 12 }]}>
                                    <View style={styles.inputIcon}>
                                        <MaterialCommunityIcons name="text-subject" size={18} color={COLORS.primaryAccent} />
                                    </View>
                                    <TextInput
                                        style={[styles.premiumInput, { fontSize: moderateScale(14), textAlignVertical: 'top' }]}
                                        placeholder="Description (Optional)"
                                        multiline
                                        numberOfLines={4}
                                        value={form.description}
                                        onChangeText={(val) => setForm({ ...form, description: val })}
                                        placeholderTextColor={COLORS.textMuted}
                                    />
                                </View>
                            </View>

                            {/* Section: Project & Job */}
                            <View style={styles.formSection}>
                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11) }]}>PROJECT & JOB</Text>
                                <View style={styles.rowInputs}>
                                    <TouchableOpacity
                                        style={[styles.cardSelector, { flex: 1, marginRight: scale(8) }]}
                                        onPress={() => openSelector('Select Project', 'projectId', (projects || []).map(p => ({ label: p.name, value: p._id || p.id })))}
                                    >
                                        <MaterialCommunityIcons name="office-building" size={20} color={form.projectId ? COLORS.primaryAccent : COLORS.textMuted} />
                                        <Text style={[styles.cardSelectorTxt, !form.projectId && { color: COLORS.textMuted }, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                                            {projects?.find(p => (p?._id || p?.id) === form.projectId)?.name || 'Project'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.cardSelector, { flex: 1, marginLeft: scale(8) }]}
                                        onPress={() => openSelector('Select Job', 'jobId', (jobs || []).map(j => ({ label: j.name || j.title, value: j._id || j.id })))}
                                    >
                                        <MaterialCommunityIcons name="hammer-wrench" size={20} color={form.jobId ? COLORS.primaryAccent : COLORS.textMuted} />
                                        <Text style={[styles.cardSelectorTxt, !form.jobId && { color: COLORS.textMuted }, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                                            {jobs?.find(j => (j?._id || j?.id) === form.jobId)?.name || 'Job'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Section: Assignment & Priority */}
                            <View style={styles.formSection}>
                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11) }]}>PRIORITY LEVEL</Text>
                                <View style={styles.priorityContainer}>
                                    {['low', 'medium', 'high'].map((p) => {
                                        const isActive = form.priority.toLowerCase() === p;
                                        const pColor = p === 'high' ? COLORS.badgeRed : (p === 'medium' ? COLORS.badgeOrange : COLORS.badgeGreen);
                                        return (
                                            <TouchableOpacity 
                                                key={p}
                                                style={[
                                                    styles.priorityPill, 
                                                    isActive && { backgroundColor: pColor, borderColor: pColor }
                                                ]}
                                                onPress={() => setForm({ ...form, priority: p.charAt(0).toUpperCase() + p.slice(1) })}
                                            >
                                                <Text style={[styles.priorityPillTxt, isActive && { color: '#fff' }, { fontSize: moderateScale(12) }]}>
                                                    {p.toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11), marginTop: verticalScale(16) }]}>ASSIGN TO ROLE</Text>
                                <View style={styles.roleSelectionRow}>
                                    {[
                                        { label: 'WORKER', icon: 'account-hard-hat' },
                                        { label: 'FOREMAN', icon: 'account-tie' },
                                        { label: 'PM', icon: 'account-star' }
                                    ].map((role) => {
                                        const isActive = form.assignedRoleType === role.label;
                                        return (
                                            <TouchableOpacity 
                                                key={role.label}
                                                style={[styles.roleBox, isActive && styles.roleBoxActive]}
                                                onPress={() => setForm({ ...form, assignedRoleType: role.label })}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={role.icon} 
                                                    size={22} 
                                                    color={isActive ? COLORS.primaryAccent : COLORS.textSecondary} 
                                                />
                                                <Text style={[styles.roleBoxTxt, isActive && styles.roleBoxTxtActive, { fontSize: moderateScale(10) }]}>
                                                    {role.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11), marginTop: verticalScale(16) }]}>ASSIGN TO USER</Text>
                                <TouchableOpacity
                                    style={styles.cardSelector}
                                    onPress={() => openSelector('Select Team Member', 'assignedTo', (teamMembers || []).map(u => ({ 
                                        label: u.fullName || u.name || 'Unknown User', 
                                        value: u._id || u.id 
                                    })))}
                                >
                                    <MaterialCommunityIcons name="account-plus" size={20} color={form.assignedTo.length > 0 ? COLORS.primaryAccent : COLORS.textMuted} />
                                    <Text style={[styles.cardSelectorTxt, form.assignedTo.length === 0 && { color: COLORS.textMuted }, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                                        {teamMembers?.find(u => (u._id || u.id) === form.assignedTo[0])?.fullName || 'Select Member'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Section: Timeline */}
                            <View style={styles.formSection}>
                                <Text style={[styles.sectionLabel, { fontSize: moderateScale(11) }]}>TIMELINE</Text>
                                <View style={styles.rowInputs}>
                                    <TouchableOpacity style={styles.dateCard} onPress={() => openDatePicker('startDate')}>
                                        <View style={styles.dateIconWrap}>
                                            <MaterialCommunityIcons name="calendar-play" size={18} color={COLORS.primaryAccent} />
                                        </View>
                                        <View>
                                            <Text style={styles.dateLabelTxt}>Start Date</Text>
                                            <Text style={styles.dateValTxt}>{form.startDate || 'Set Date'}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.dateCard} onPress={() => openDatePicker('dueDate')}>
                                        <View style={[styles.dateIconWrap, { backgroundColor: COLORS.dangerLight }]}>
                                            <MaterialCommunityIcons name="calendar-check" size={18} color={COLORS.danger} />
                                        </View>
                                        <View>
                                            <Text style={styles.dateLabelTxt}>Due Date</Text>
                                            <Text style={styles.dateValTxt}>{form.dueDate || 'Set Date'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                        </ScrollView>

                        <View style={[styles.premiumFooter, { paddingHorizontal: scale(24), paddingBottom: verticalScale(30) }]}>
                            <TouchableOpacity 
                                style={[styles.createBtnPremium, SHADOWS.medium]} 
                                onPress={handleCreateTask}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.createBtnTxt}>CREATE TASK</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Selection Sub-Modal */}
            <Modal visible={selectConfig.visible} transparent animationType="fade">
                <TouchableOpacity style={styles.selectorOverlay} activeOpacity={1} onPress={() => setSelectConfig({ ...selectConfig, visible: false })}>
                    <View style={[styles.selectorContent, { borderRadius: moderateScale(20), padding: scale(20), maxWidth: 400, alignSelf: 'center', width: '80%' }]}>
                        <Text style={[styles.selectorTitle, { fontSize: moderateScale(16), marginBottom: verticalScale(12) }]}>{selectConfig.title}</Text>
                        <ScrollView style={{ maxHeight: verticalScale(300) }}>
                            {selectConfig.options.map((opt, i) => (
                                <TouchableOpacity key={i} style={[styles.selectorItem, { paddingVertical: verticalScale(14) }]} onPress={() => handleSelectAction(opt.value)}>
                                    <Text style={[styles.selectorItemText, { fontSize: moderateScale(14) }, (form[selectConfig.field] === opt.value) && { color: '#2563EB', fontWeight: '900' }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {loading && <View style={styles.loaderOverlay}><ActivityIndicator color="#2563EB" size="large" /></View>}

            {/* Calendar Modal Picker */}
            <Modal visible={showDatePicker} transparent animationType="fade">
                <View style={styles.selectorOverlay}>
                    <View style={[styles.selectorContent, { padding: scale(10), borderRadius: moderateScale(20) }]}>
                        <View style={[styles.selectorHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: scale(10) }]}>
                            <Text style={[styles.selectorTitle, { fontSize: moderateScale(16) }]}>Select Date</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(22)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Calendar
                            onDayPress={onDateSelect}
                            markedDates={{ [form[dateTarget]]: { selected: true, selectedColor: '#2563EB' } }}
                            theme={{ selectedDayBackgroundColor: '#2563EB', todayTextColor: '#2563EB', arrowColor: '#2563EB' }}
                        />
                    </View>
                </View>
            </Modal>
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
    listContainer: { },
    taskCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    taskTitle: { fontWeight: '800', color: '#0F172A' },
    projectSubtitle: { color: '#64748B' },
    statusBadge: { },
    statusText: { fontWeight: '900' },
    cardDivider: { backgroundColor: '#F1F5F9' },
    cardBody: { },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoCol: { flex: 1 },
    infoLabel: { fontWeight: '900', color: '#94A3B8' },
    infoVal: { fontWeight: '700', color: '#1E293B' },
    assigneeWrap: { flexDirection: 'row', alignItems: 'center' },
    avatarMini: { backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { fontWeight: '900', color: '#4338CA' },
    priorityBadge: { alignSelf: 'flex-start' },
    priorityText: { fontWeight: '900' },
    emptyView: { alignItems: 'center' },
    emptyTitle: { fontWeight: '800', color: '#1E293B' },
    emptySub: { color: '#94A3B8', textAlign: 'center' },
    loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    // Improved UI Enhancement Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
    pullIndicator: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginTop: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalHeaderTitle: { fontWeight: '900', color: COLORS.textPrimary },
    modalHeaderSub: { color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
    closeBtn: { backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
    modalForm: { flex: 1 },
    formSection: { marginBottom: 20 },
    sectionLabel: { color: COLORS.textSecondary, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
    
    inputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: COLORS.primaryLight, 
        borderRadius: 12, 
        paddingHorizontal: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 52
    },
    inputIcon: { marginRight: 12 },
    premiumInput: { flex: 1, color: COLORS.textPrimary, fontWeight: '600' },
    
    rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
    cardSelector: { 
        backgroundColor: '#fff', 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        borderRadius: 12, 
        paddingHorizontal: 10,
        paddingVertical: 12, 
        flexDirection: 'row', 
        alignItems: 'center',
        height: 48
    },
    cardSelectorTxt: { marginLeft: 6, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
    
    priorityContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    priorityPill: { 
        flex: 1, 
        marginHorizontal: 3, 
        height: 40, 
        borderRadius: 20, 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff'
    },
    priorityPillTxt: { fontWeight: '800', color: COLORS.textSecondary },
    
    roleSelectionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    roleBox: { 
        flex: 1, 
        marginHorizontal: 3, 
        paddingVertical: 12, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    roleBoxActive: { borderColor: COLORS.primaryAccent, backgroundColor: COLORS.primaryLight },
    roleBoxTxt: { fontWeight: '800', color: COLORS.textSecondary, marginTop: 4 },
    roleBoxTxtActive: { color: COLORS.primaryAccent },
    
    dateCard: { 
        flex: 1, 
        marginHorizontal: 3, 
        padding: 10, 
        borderRadius: 12, 
        backgroundColor: COLORS.primaryLight, 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    dateIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    dateLabelTxt: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary },
    dateValTxt: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
    
    premiumFooter: { paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    createBtnPremium: { 
        backgroundColor: COLORS.primaryAccent, 
        height: 56, 
        borderRadius: 16, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    createBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },

    selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    selectorContent: { backgroundColor: '#fff' },
    selectorTitle: { fontWeight: '800', color: '#1E293B', textAlign: 'center' },
    selectorItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selectorItemText: { color: '#334155', textAlign: 'center' }
});


export default ForemanTasksScreen;
