import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, TextInput, Dimensions, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';

const { width } = Dimensions.get('window');

const JobsScreen = ({ navigation }) => {
    const { width: windowWidth } = useWindowDimensions();
    const isCompact = windowWidth < 390;
    const { jobs, projects, teamMembers, user, loading, addJob, refreshData } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter projects where current user is PM
    const myProjects = useMemo(() => {
        if (user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER') return projects;
        return (projects || []).filter(p => {
            const pmId = String(p.pmId?._id || p.pmId || p.projectManagerId || '');
            return pmId === String(user?._id || user?.id);
        });
    }, [projects, user]);

    const [form, setForm] = useState({
        name: '',
        projectId: '',
        assignedTo: '',
        assignedRole: 'ALL',
        status: 'Pending',
        description: ''
    });

    // Selector State
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (val) => {
            onSelect(val);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const handleCreateJob = async () => {
        if (!form.name || !form.projectId) {
            alert('Please fill in Job Name and Project');
            return;
        }

        setIsSubmitting(true);
        const payload = {
            name: form.name,
            projectId: form.projectId,
            assignedTo: form.assignedTo || null,
            status: form.status,
            description: form.description
        };

        const res = await addJob(payload);
        setIsSubmitting(false);

        if (res.success) {
            setModalVisible(false);
            setForm({ name: '', projectId: '', assignedTo: '', assignedRole: 'WORKER', status: 'Pending', description: '' });
            refreshData();
        } else {
            alert(res.message || 'Failed to create job');
        }
    };

    const renderJobItem = ({ item }) => {
        const projName = typeof item.projectId === 'object' ? item.projectId?.name : (projects.find(p => String(p._id || p.id) === String(item.projectId))?.name || item.project);
        
        return (
            <TouchableOpacity style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.jobName}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'In Progress' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                        <Text style={[styles.statusText, { color: item.status === 'In Progress' ? COLORS.success : COLORS.warning }]}>
                            {item.status?.toUpperCase() || 'PENDING'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.projectName}>{projName || 'No Project'}</Text>
                
                {item.assignedTo && (
                    <View style={styles.assignmentRow}>
                        <MaterialCommunityIcons name="account-hard-hat" size={14} color="#64748B" />
                        <Text style={styles.assignmentText}>
                            Assigned: {typeof item.assignedTo === 'object' ? item.assignedTo.fullName : (teamMembers.find(m => String(m._id || m.id) === String(item.assignedTo))?.fullName || 'Selected User')}
                        </Text>
                    </View>
                )}

                <View style={styles.cardFooter}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.timeText}>Last updated recently</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const filteredJobs = (jobs || []).filter(j => 
        j.name?.toLowerCase().includes(search.toLowerCase()) || 
        j.project?.toLowerCase().includes(search.toLowerCase())
    );

    const isPm = user?.role === 'PM' || user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER';

    return (
        <View style={styles.container}>
            <AppHeader title="Jobs Management" />
            
            <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search jobs..."
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                {isPm && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                        <Text style={styles.addBtnText}>New Job</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredJobs}
                    keyExtractor={(item, index) => item._id || item.id || `job-${index}`}
                    renderItem={renderJobItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No jobs found.</Text>
                        </View>
                    }
                />
            )}

            {/* CREATE JOB MODAL */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
                    >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create New Job</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.modalFormContent}
                        >
                            <CustomInput 
                                label="Job Name"
                                placeholder="e.g. Ground Level Excavation"
                                value={form.name}
                                onChangeText={t => setForm({ ...form, name: t })}
                            />

                            <Text style={styles.label}>Select Project</Text>
                            <TouchableOpacity 
                                style={styles.dropdown} 
                                onPress={() => openDropdown('Project', 
                                    myProjects.map(p => ({ label: p.name, value: String(p._id || p.id) })),
                                    (val) => setForm({ ...form, projectId: val })
                                )}
                            >
                                <Text style={styles.dropdownText}>
                                    {myProjects.find(p => String(p._id || p.id) === form.projectId)?.name || 'Choose Project...'}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color="#3B82F6" />
                            </TouchableOpacity>

                            <View style={[styles.assignRow, isCompact && styles.assignRowStack]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Category / Role</Text>
                                    <TouchableOpacity 
                                        style={styles.dropdown} 
                                        onPress={() => openDropdown('Role', 
                                            [
                                                { label: 'All Project Staff', value: 'ALL' },
                                                { label: 'Foreman', value: 'FOREMAN' },
                                                { label: 'Worker', value: 'WORKER' },
                                                { label: 'Subcontractor', value: 'SUBCONTRACTOR' }
                                            ],
                                            (val) => setForm({ ...form, assignedRole: val, assignedTo: '' })
                                        )}
                                    >
                                        <Text style={styles.dropdownText}>
                                            {form.assignedRole === 'ALL' ? 'All Project Staff' : form.assignedRole}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                    </TouchableOpacity>
                                </View>
                                
                                <View style={{ flex: 1.5 }}>
                                    <Text style={styles.label}>Assign User</Text>
                                    <TouchableOpacity 
                                        style={styles.dropdown} 
                                        onPress={() => openDropdown('Assign To', 
                                            (teamMembers || [])
                                                .filter(m => 
                                                    form.assignedRole === 'ALL' 
                                                    ? ['WORKER', 'FOREMAN', 'SUBCONTRACTOR'].includes(m.role)
                                                    : m.role === form.assignedRole
                                                )
                                                .map(m => ({ 
                                                    label: `${m.fullName || m.name} (${m.role})`, 
                                                    value: String(m._id || m.id) 
                                                })),
                                            (val) => {
                                                const selected = teamMembers.find(m => String(m._id || m.id) === val);
                                                if (selected) {
                                                    setForm({ ...form, assignedTo: val, assignedRole: selected.role });
                                                } else {
                                                    setForm({ ...form, assignedTo: val });
                                                }
                                            }
                                        )}
                                    >
                                        <Text style={styles.dropdownText} numberOfLines={1}>
                                            {(teamMembers || []).find(m => String(m._id || m.id) === form.assignedTo)?.fullName || 'Select User...'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={16} color="#3B82F6" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.label}>Description</Text>
                            <TextInput 
                                style={styles.textArea}
                                placeholder="Details about this job..."
                                multiline
                                numberOfLines={4}
                                value={form.description}
                                onChangeText={t => setForm({ ...form, description: t })}
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setModalVisible(false)}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <View style={{ flex: 1.25 }}>
                                    <CustomButton title="Create Job" onPress={handleCreateJob} loading={isSubmitting} />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* SELECTOR MODAL */}
            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    toolbar: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
    searchBox: { 
        flex: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        paddingHorizontal: 12, 
        height: 48,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1E293B', fontWeight: '600' },
    addBtn: { 
        backgroundColor: '#2563EB', 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        height: 48, 
        borderRadius: 12, 
        gap: 6,
        ...SHADOWS.small 
    },
    addBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    listContent: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...SHADOWS.small
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    jobName: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '900' },
    projectName: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 12 },
    assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 },
    assignmentText: { fontSize: 12, color: '#475569', fontWeight: '600' },
    cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
    timeText: { fontSize: 12, color: '#94A3B8', marginLeft: 4, fontWeight: '500' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 12, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
    modalKeyboardWrap: { width: '100%' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    modalFormContent: { paddingBottom: 26 },
    assignRow: { flexDirection: 'row', gap: 12, marginTop: 15 },
    assignRowStack: { flexDirection: 'column' },
    modalActions: { marginTop: 24, flexDirection: 'row', gap: 10, alignItems: 'center' },
    modalCancelBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    modalCancelText: { color: '#475569', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
    label: { fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    dropdown: { 
        height: 52, 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        borderWidth: 1.5, 
        borderColor: '#E2E8F0', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingHorizontal: 16
    },
    dropdownText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    textArea: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        minHeight: 100,
        textAlignVertical: 'top'
    },
    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '80%', backgroundColor: '#fff', borderRadius: 24, padding: 24, ...SHADOWS.medium },
    selTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
    selItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
    selClose: { marginTop: 20, paddingVertical: 12, alignItems: 'center' },
    selCloseText: { fontSize: 14, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }
});

export default JobsScreen;

