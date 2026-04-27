import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions, StatusBar, SafeAreaView, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';

const { width } = Dimensions.get('window');

const RFIScreen = ({ navigation }) => {
    const { user, projects } = useApp();
    const [rfis, setRfis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Create RFI Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        projectId: '',
        subject: '',
        description: '',
        priority: 'medium'
    });

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
            setForm({ projectId: '', subject: '', description: '', priority: 'medium' });
            fetchData();
            Alert.alert('Success', 'RFI submitted successfully');
        } catch (e) {
            Alert.alert('Error', 'Failed to submit RFI');
        } finally {
            setSubmitting(false);
        }
    };

    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: rfis.length,
            open: rfis.filter(r => r.status === 'open').length,
            inReview: rfis.filter(r => r.status === 'in_review').length,
            answered: rfis.filter(r => r.status === 'answered').length,
            closed: rfis.filter(r => r.status === 'closed').length,
            overdue: rfis.filter(r => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < now).length,
            highPriority: rfis.filter(r => r.status !== 'closed' && r.priority === 'high').length
        };
    }, [rfis]);

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

    const getStatusLabel = (status) => {
        switch (status) {
            case 'open': return 'Open';
            case 'in_review': return 'In Review';
            case 'answered': return 'Answered';
            case 'closed': return 'Closed';
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#EF4444';
            case 'in_review': return '#F59E0B';
            case 'answered': return '#10B981';
            case 'closed': return '#64748B';
            default: return '#94A3B8';
        }
    };

    const StatBox = ({ label, value, color, bg }) => (
        <View style={[styles.statBox, { backgroundColor: bg || '#F8FAFC' }]}>
            <Text style={[styles.statValue, { color: color || '#0F172A' }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    const RFICard = ({ item }) => (
        <TouchableOpacity style={[styles.rfiCard, SHADOWS.small]} onPress={() => navigation.navigate('RFIDetail', { rfiId: item._id })}>
            <View style={styles.rfiHeader}>
                <Text style={styles.rfiNumber}>{item.rfiNumber || 'RFI-XXXX'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
                </View>
            </View>
            <Text style={styles.rfiSubject} numberOfLines={1}>{item.subject}</Text>
            <View style={styles.rfiFooter}>
                <MaterialCommunityIcons name="office-building" size={12} color="#94A3B8" />
                <Text style={styles.rfiProject} numberOfLines={1}>{item.projectId?.name || 'General'}</Text>
            </View>
        </TouchableOpacity>
    );

    if (user?.role !== 'PM') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <WorkerHeader title="RFI Dashboard" showBranding={true} />
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="file-question-outline" size={80} color="#E2E8F0" />
                    <Text style={styles.emptyTitle}>RFI Center</Text>
                    <Text style={styles.emptySubtitle}>Content is being updated by the Project Manager.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="RFI Dashboard" showBranding={true} />
            
            <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* DASHBOARD HEADER */}
                <View style={styles.dashboardHeader}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.mainTitle}>RFI Console</Text>
                        <Text style={styles.mainSubtitle}>Monitoring information requests across jobs</Text>
                    </View>
                    <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreateModal(true)}>
                        <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
                        <Text style={styles.newBtnText}>NEW RFI</Text>
                    </TouchableOpacity>
                </View>

                {/* OVERDUE / ALERTS SECTION */}
                <View style={styles.alertSection}>
                    <View style={styles.alertCard}>
                        <View style={styles.alertHeaderRow}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#EF4444" />
                            <Text style={styles.alertHeaderTitle}>Critical & Overdue</Text>
                            {overdueRFIs.length > 0 && (
                                <View style={styles.alertBadge}>
                                    <Text style={styles.alertBadgeText}>{overdueRFIs.length}</Text>
                                </View>
                            )}
                        </View>

                        {overdueRFIs.length === 0 ? (
                            <Text style={styles.emptyAlertText}>No overdue RFIs at this time.</Text>
                        ) : (
                            overdueRFIs.map((item, index) => (
                                <TouchableOpacity 
                                    key={`overdue-${item._id || index}`} 
                                    style={styles.alertItem}
                                    onPress={() => navigation.navigate('RFIDetail', { rfiId: item._id })}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.alertItemTitle} numberOfLines={1}>{item.subject}</Text>
                                        <Text style={styles.alertItemMeta}>{item.projectId?.name || 'General'}</Text>
                                    </View>
                                    <Text style={styles.alertItemDate}>
                                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Overdue'}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>

                {/* RECENT RFIs */}
                <View style={{ marginTop: 32 }}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('RFIList')}>
                            <Text style={styles.viewAllText}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.recentView}>
                        {recentRFIs.length === 0 ? (
                            <View style={[styles.rfiCard, { alignItems: 'center', padding: 30 }]}>
                                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>No RFIs found.</Text>
                            </View>
                        ) : (
                            recentRFIs.map((item, idx) => <RFICard key={`recent-${item._id || idx}`} item={item} />)
                        )}
                    </View>
                </View>

                {/* FOOTER LINK */}
                <TouchableOpacity 
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('RFIList')}
                >
                    <Text style={styles.footerLinkText}>OPEN FULL RFI CENTER</Text>
                    <Text style={styles.footerLinkSub}>Manage, Filter and Search all Project RFIs</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* CREATE RFI MODAL */}
            <Modal visible={showCreateModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
                    >
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>New RFI</Text>
                                <Text style={styles.modalSubtitle}>Submit a Request for Information</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            keyboardShouldPersistTaps="always"
                            keyboardDismissMode="none"
                        >
                            <Text style={styles.inputLabel}>Select Project *</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
                                {(projects || []).map((p, idx) => (
                                    <TouchableOpacity
                                        key={p._id ? `proj-chip-${p._id}` : `proj-chip-idx-${idx}`}
                                        style={[styles.chip, form.projectId === p._id && styles.chipActive]}
                                        onPress={() => setForm({ ...form, projectId: p._id })}
                                    >
                                        <Text style={[styles.chipTxt, form.projectId === p._id && styles.chipTxtActive]}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Subject *</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Brief title of the request..."
                                placeholderTextColor="#94A3B8"
                                value={form.subject}
                                onChangeText={t => setForm({ ...form, subject: t })}
                            />

                            <Text style={styles.inputLabel}>Description *</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Detailed description of the information needed..."
                                placeholderTextColor="#94A3B8"
                                value={form.description}
                                onChangeText={t => setForm({ ...form, description: t })}
                            />

                            <Text style={styles.inputLabel}>Priority</Text>
                            <View style={styles.priorityRow}>
                                {[['low', '#10B981'], ['medium', '#F59E0B'], ['high', '#EF4444']].map(([p, color]) => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.priorityBtn, form.priority === p && { backgroundColor: color, borderColor: color }]}
                                        onPress={() => setForm({ ...form, priority: p })}
                                    >
                                        <Text style={[styles.priorityBtnTxt, form.priority === p && { color: '#fff' }]}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                                onPress={handleCreateRFI}
                                disabled={submitting}
                            >
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.submitBtnTxt}>SUBMIT RFI</Text>
                                }
                            </TouchableOpacity>
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
    dashboardHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTextContainer: { flex: 1, marginRight: 12 },
    mainTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '800', marginTop: 4 },
    newBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    newBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    statsGrid: { paddingHorizontal: 20, marginBottom: 24 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statBox: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    statValue: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    statLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', marginTop: 4, textTransform: 'uppercase' },

    sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    viewAllText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
    recentView: { paddingHorizontal: 20 },

    rfiCard: { backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    rfiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    rfiNumber: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    rfiSubject: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    rfiFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    rfiProject: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

    alertSection: { paddingHorizontal: 20, marginTop: 16 },
    alertCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    alertHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    alertHeaderTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginLeft: 8, flex: 1 },
    alertBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    alertBadgeText: { fontSize: 11, fontWeight: '900', color: '#EF4444' },
    emptyAlertText: { fontSize: 13, color: '#94A3B8', fontWeight: '800', textAlign: 'center', paddingVertical: 10 },
    alertItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 14, marginBottom: 8 },
    alertItemTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    alertItemMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '700' },
    alertItemDate: { fontSize: 11, color: '#EF4444', marginTop: 2, fontWeight: '800' },

    footerLink: { margin: 20, backgroundColor: '#0F172A', padding: 20, borderRadius: 24, alignItems: 'center' },
    footerLinkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    footerLinkSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', marginTop: 4 },

    // Create Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end' },
    modalKeyboardWrap: { width: '100%' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '700', marginTop: 4 },
    inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '700', color: '#1E293B' },
    chipList: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    chipTxt: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    chipTxtActive: { color: '#fff' },
    priorityRow: { flexDirection: 'row', gap: 10 },
    priorityBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    priorityBtnTxt: { fontSize: 13, fontWeight: '900', color: '#64748B' },
    submitBtn: { height: 58, backgroundColor: '#2563EB', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
    submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: '#64748B', textAlign: 'center', marginTop: 8 },
});


export default RFIScreen;
