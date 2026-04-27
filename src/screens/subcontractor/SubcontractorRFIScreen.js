import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, 
    ScrollView, Dimensions, StatusBar, SafeAreaView, RefreshControl, 
    Modal, TextInput, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';

const SubcontractorRFIScreen = ({ navigation }) => {
    const { user, projects } = useApp();
    const [rfis, setRfis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showProjectList, setShowProjectList] = useState(false);

    // Create RFI Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        projectId: '',
        subject: '',
        description: '',
        priority: 'medium',
        location: '',
        category: 'Other',
        assignedTo: '',
        dueDate: ''
    });

    const categories = ['Structural', 'Architectural', 'Mechanical', 'Electrical', 'Plumbing', 'Other'];

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/rfis');
            setRfis(res.data || []);
        } catch (e) {
            console.error('Fetch RFI error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleCreateRFI = async () => {
        if (!form.projectId || !form.subject || !form.description) {
            Alert.alert('Required', 'Please fill in Project, Subject, and Description');
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/rfis', form);
            setShowCreateModal(false);
            setForm({ 
                projectId: '', subject: '', description: '', priority: 'medium',
                location: '', category: 'Other', assignedTo: '', dueDate: ''
            });
            fetchData();
            Alert.alert('Success', 'RFI submitted successfully');
        } catch (e) {
            Alert.alert('Error', 'Failed to submit RFI');
        } finally {
            setSubmitting(false);
        }
    };

    const recentRFIs = useMemo(() => {
        return [...rfis].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    }, [rfis]);

    const highPriorityRFIs = useMemo(() => {
        return rfis.filter(r => r.status !== 'closed' && r.priority === 'high').slice(0, 3);
    }, [rfis]);

    const overdueRFIs = useMemo(() => {
        const now = new Date();
        return rfis.filter(r => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < now).slice(0, 3);
    }, [rfis]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#EF4444';
            case 'in_review': return '#F59E0B';
            case 'answered': return '#10B981';
            case 'closed': return '#64748B';
            default: return '#94A3B8';
        }
    };

    const RFICard = ({ item }) => (
        <TouchableOpacity style={[styles.rfiCard, SHADOWS.small]} onPress={() => navigation.navigate('RFIList', { filterRfi: item._id })}>
            <View style={styles.rfiHeader}>
                <Text style={styles.rfiNumber}>{item.rfiNumber || 'RFI-XXXX'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status?.toUpperCase()}</Text>
                </View>
            </View>
            <Text style={styles.rfiSubject} numberOfLines={1}>{item.subject}</Text>
            <View style={styles.rfiFooter}>
                <MaterialCommunityIcons name="office-building" size={12} color="#94A3B8" />
                <Text style={styles.rfiProject} numberOfLines={1}>{item.projectId?.name || 'General Assignment'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Dashboard" showBranding={true} />

            <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* RFI Dashboard Header */}
                <View style={styles.dashboardHeader}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.mainTitle}>RFI Dashboard</Text>
                        <Text style={styles.mainSubtitle}>Request for Information — Summary</Text>
                    </View>
                    <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreateModal(true)}>
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                        <Text style={styles.newBtnText}>New RFI</Text>
                    </TouchableOpacity>
                </View>

                {/* Section: Recent RFIs */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent RFIs</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('RFIList')}>
                        <Text style={styles.viewAllText}>View All ></Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.recentView}>
                    {recentRFIs.length > 0 ? (
                        recentRFIs.map(item => <RFICard key={item._id} item={item} />)
                    ) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyCardText}>No recent RFIs available.</Text>
                        </View>
                    )}
                </View>

                {/* Section: Alerts */}
                <View style={styles.alertSection}>
                    <View style={styles.alertCard}>
                        <View style={styles.alertHeaderRow}>
                            <MaterialCommunityIcons name="alert" size={16} color="#EF4444" />
                            <Text style={styles.alertHeaderTitle}>High Priority</Text>
                            <View style={styles.alertCount}>
                                <Text style={styles.alertCountTxt}>{highPriorityRFIs.length}</Text>
                            </View>
                        </View>
                        {highPriorityRFIs.length > 0 ? (
                            highPriorityRFIs.map(item => (
                                <View key={item._id} style={styles.alertItem}>
                                    <View>
                                        <Text style={styles.alertItemTitle}>{item.subject}</Text>
                                        <Text style={styles.alertItemMeta}>{item.projectId?.name}</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyAlertText}>🎉 No high priority RFIs</Text>
                        )}
                    </View>

                    <View style={[styles.alertCard, { marginTop: 15 }]}>
                        <View style={styles.alertHeaderRow}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#F59E0B" />
                            <Text style={styles.alertHeaderTitle}>Overdue</Text>
                            <View style={[styles.alertCount, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={[styles.alertCountTxt, { color: '#D97706' }]}>{overdueRFIs.length}</Text>
                            </View>
                        </View>
                        {overdueRFIs.length > 0 ? (
                            overdueRFIs.map(item => (
                                <View key={item._id} style={styles.alertItem}>
                                    <View>
                                        <Text style={styles.alertItemTitle}>{item.subject}</Text>
                                        <Text style={[styles.alertItemDate, { color: '#D97706' }]}>Overdue</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyAlertText}>✅ No overdue RFIs</Text>
                        )}
                    </View>
                </View>

                {/* Footer Big Link */}
                <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('RFIList')}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.footerLinkText}>View All RFIs</Text>
                        <Text style={styles.footerLinkSub}>Filter, search and manage all requests</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* HIGH-FIDELITY NEW RFI MODAL */}
            <Modal 
                visible={showCreateModal} 
                animationType="slide" 
                transparent={true}
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <View style={styles.modalCard}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={styles.iconCircle}>
                                        <MaterialCommunityIcons name="file-document-edit-outline" size={20} color="#2563EB" />
                                    </View>
                                    <View>
                                        <Text style={styles.modalTitle}>RFI Details</Text>
                                        <Text style={styles.modalSubtitle}>Create new request</Text>
                                    </View>
                                </View>
                                <TouchableOpacity 
                                    style={styles.closeBtn} 
                                    onPress={() => setShowCreateModal(false)}
                                >
                                    <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView 
                                showsVerticalScrollIndicator={false} 
                                contentContainerStyle={styles.formContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Project Field Dropdown Style */}
                                <Text style={styles.inputLabel}>Project *</Text>
                                <TouchableOpacity 
                                    style={[styles.dropdownField, form.projectId && styles.dropdownFieldActive]}
                                    onPress={() => setShowProjectList(!showProjectList)}
                                >
                                    <Text style={[styles.dropdownText, !form.projectId && { color: '#94A3B8' }]}>
                                        {form.projectId ? projects.find(p => p._id === form.projectId)?.name : 'Select Project...'}
                                    </Text>
                                    <MaterialCommunityIcons 
                                        name={showProjectList ? "chevron-up" : "chevron-down"} 
                                        size={20} 
                                        color="#64748B" 
                                    />
                                </TouchableOpacity>

                                {showProjectList && (
                                    <View style={styles.dropdownList}>
                                        {(projects || []).map(p => (
                                            <TouchableOpacity 
                                                key={p._id} 
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setForm({ ...form, projectId: p._id });
                                                    setShowProjectList(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownItemTxt}>{p.name}</Text>
                                                {form.projectId === p._id && (
                                                    <MaterialCommunityIcons name="check" size={16} color="#2563EB" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {/* Subject Field */}
                                <Text style={styles.inputLabel}>Subject *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Brief description of the request..."
                                    placeholderTextColor="#94A3B8"
                                    value={form.subject}
                                    onChangeText={t => setForm({ ...form, subject: t })}
                                />

                                {/* Description Field */}
                                <Text style={styles.inputLabel}>Description *</Text>
                                <TextInput
                                    style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Detailed information requested..."
                                    placeholderTextColor="#94A3B8"
                                    value={form.description}
                                    onChangeText={t => setForm({ ...form, description: t })}
                                />

                                {/* Bottom Fields Group (Location & Category) */}
                                <View style={styles.formRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Location (Optional)</Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="e.g. Level 3"
                                            placeholderTextColor="#94A3B8"
                                            value={form.location}
                                            onChangeText={t => setForm({ ...form, location: t })}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Category</Text>
                                        <View style={styles.modalInput}>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{form.category}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Priority Row */}
                                <Text style={styles.inputLabel}>Priority</Text>
                                <View style={styles.priorityToggle}>
                                    {['Low', 'Medium', 'High'].map(p => (
                                        <TouchableOpacity 
                                            key={p} 
                                            style={[styles.pBtn, form.priority === p.toLowerCase() && styles.pBtnActive]}
                                            onPress={() => setForm({...form, priority: p.toLowerCase()})}
                                        >
                                            <Text style={[styles.pBtnTxt, form.priority === p.toLowerCase() && styles.pBtnTxtActive]}>{p}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.formRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Assign To</Text>
                                        <View style={styles.modalInput}>
                                            <Text style={{ fontSize: 13, color: '#94A3B8' }}>Unassigned</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Due Date</Text>
                                        <View style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                                            <Text style={{ fontSize: 13, color: '#94A3B8' }}>dd-mm-yyyy</Text>
                                            <MaterialCommunityIcons name="calendar" size={16} color="#94A3B8" />
                                        </View>
                                    </View>
                                </View>

                                {/* Attachments Section */}
                                <View style={styles.attachmentBox}>
                                    <View style={styles.attachmentHeader}>
                                        <MaterialCommunityIcons name="upload" size={18} color="#2563EB" />
                                        <Text style={styles.attachmentTitle}>Attachments</Text>
                                    </View>
                                    <TouchableOpacity style={styles.uploadArea}>
                                        <MaterialCommunityIcons name="tray-arrow-up" size={32} color="#94A3B8" />
                                        <Text style={styles.uploadTitle}>Click to upload files</Text>
                                        <Text style={styles.uploadSub}>PDF, DWG, Images, etc.</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer Buttons */}
                                <View style={styles.formFooter}>
                                    <TouchableOpacity 
                                        style={styles.cancelBtn} 
                                        onPress={() => setShowCreateModal(false)}
                                    >
                                        <Text style={styles.cancelBtnTxt}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.submitBtnForm} 
                                        onPress={handleCreateRFI}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <MaterialCommunityIcons name="send" size={16} color="#fff" />
                                                <Text style={styles.submitBtnTxt}>Submit RFI</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    dashboardHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTextContainer: { flex: 1, marginRight: 12 },
    mainTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '800', marginTop: 4 },
    newBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    newBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    viewAllText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
    recentView: { paddingHorizontal: 20 },

    rfiCard: { backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    rfiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    rfiNumber: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900' },
    rfiSubject: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    rfiFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    rfiProject: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

    alertSection: { paddingHorizontal: 20, marginTop: 10 },
    alertCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    alertHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    alertHeaderTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginLeft: 8, flex: 1 },
    alertCount: { backgroundColor: '#FEE2E2', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    alertCountTxt: { fontSize: 11, fontWeight: '900', color: '#EF4444' },
    emptyAlertText: { fontSize: 12, color: '#94A3B8', fontWeight: '800', textAlign: 'center', paddingVertical: 6 },
    alertItem: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 6 },
    alertItemTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    alertItemMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

    footerLink: { margin: 20, backgroundColor: '#2563EB', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center' },
    footerLinkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    footerLinkSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center' },
    keyboardView: { flex: 1, justifyContent: 'center', padding: 16 },
    modalCard: { backgroundColor: '#fff', borderRadius: 32, padding: 20, maxHeight: '90%', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    iconCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { fontSize: 11, color: '#94A3B8', fontWeight: '800', marginTop: 1 },
    formContent: { paddingVertical: 10, paddingBottom: 30 },
    inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 13, fontWeight: '700', color: '#1E293B', justifyContent: 'center' },
    
    dropdownField: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 14, 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        paddingHorizontal: 16, 
        paddingVertical: 14, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
    },
    dropdownFieldActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    dropdownText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
    dropdownList: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4, overflow: 'hidden' },
    dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dropdownItemTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },

    formRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    priorityToggle: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginTop: 4 },
    pBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    pBtnActive: { backgroundColor: '#FFB800' },
    pBtnTxt: { fontSize: 11, fontWeight: '900', color: '#64748B' },
    pBtnTxtActive: { color: '#fff' },
    
    attachmentBox: { marginTop: 24, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    attachmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    attachmentTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    uploadArea: { borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, padding: 30, alignItems: 'center', backgroundColor: '#F8FAFC' },
    uploadTitle: { fontSize: 13, fontWeight: '900', color: '#475569', marginTop: 12 },
    uploadSub: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginTop: 2 },

    formFooter: { flexDirection: 'row', gap: 12, marginTop: 32, paddingHorizontal: 4 },
    cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    cancelBtnTxt: { fontSize: 13, fontWeight: '900', color: '#475569' },
    submitBtnForm: { flex: 2, height: 50, borderRadius: 12, backgroundColor: '#2563EB', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    submitBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },

    chipList: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
    chipActive: { backgroundColor: '#2563EB' },
    chipTxt: { fontSize: 12, fontWeight: '800', color: '#64748B' },
    chipTxtActive: { color: '#fff' },
    submitBtn: { height: 54, backgroundColor: '#2563EB', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
    emptyCard: { padding: 20, backgroundColor: '#F8FAFC', borderRadius: 18, alignItems: 'center' },
    emptyCardText: { fontSize: 12, color: '#94A3B8', fontWeight: '700' }
});

export default SubcontractorRFIScreen;
