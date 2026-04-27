import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, SafeAreaView, Modal,
    StatusBar, Platform, ScrollView, Alert, Dimensions, RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import WorkerHeader from '../../components/WorkerHeader';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

const CrewClockScreen = ({ navigation }) => {
    const { projects, user, refreshData } = useApp();
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);

    // Calculate Stats for the UI
    const stats = {
        total: workers.length,
        onSite: workers.filter(w => w.isClockedIn).length,
        scheduled: workers.length // Fallback to total if schedule data is missing
    };

    const selectAll = () => {
        if (selectedWorkers.length === filteredWorkers.length && filteredWorkers.length > 0) {
            setSelectedWorkers([]);
        } else {
            setSelectedWorkers(filteredWorkers.map(w => w._id || w.id));
        }
    };

    const handleBulkClockIn = () => handleBulkAction('in');
    const handleBulkClockOut = () => handleBulkAction('out');

    // Modal state
    const [projectModalVisible, setProjectModalVisible] = useState(false);

    // Live Ticker for metrics
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Fetch crew data ───────────────────────────────────────────────────
    const fetchCrewData = useCallback(async () => {
        try {
            if (workers.length === 0) setLoading(true);
            
            const [usersRes, logsRes] = await Promise.all([
                api.get('/auth/users', { params: { role: 'WORKER' } }),
                api.get('/timelogs', { params: { clockOut: 'null' } }),
            ]);

            const workerList = usersRes.data || [];
            const enriched = workerList.map(worker => {
                const wId = worker._id || worker.id;
                const activeLog = (logsRes.data || []).find(
                    log => (log.userId?._id || log.userId) === wId && !log.clockOut
                );
                return {
                    ...worker,
                    isClockedIn: !!activeLog,
                    activeLogId: activeLog?._id || activeLog?.id || null,
                    clockInISO: activeLog?.clockIn || null,
                    siteName: activeLog?.projectId?.name || 'Assigned Site',
                };
            });

            setWorkers(enriched);
        } catch (err) {
            console.error('Crew fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [workers.length]);

    useEffect(() => {
        fetchCrewData();
        if (projects?.length > 0 && !selectedProject) setSelectedProject(projects[0]);
    }, [projects]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchCrewData();
    };

    const filteredWorkers = workers.filter(w => {
        const query = searchQuery.toLowerCase();
        return (w.fullName || w.name || '').toLowerCase().includes(query);
    });

    const toggleSelection = (id) => {
        setSelectedWorkers(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkAction = async (action) => {
        if (selectedWorkers.length === 0) return;
        const projId = selectedProject?._id || selectedProject?.id;
        if (action === 'in' && !projId) {
            Alert.alert('Selection Required', 'Please select a jobsite before clocking in.');
            return;
        }

        try {
            setIsProcessing(true);
            const endpoint = action === 'in' ? '/timelogs/clock-in' : '/timelogs/clock-out';
            await Promise.all(selectedWorkers.map(id => api.post(endpoint, {
                userId: id,
                ...(action === 'in' && { projectId: projId, latitude: 0, longitude: 0 })
            })));
            
            setSelectedWorkers([]);
            fetchCrewData();
        } catch (err) {
            Alert.alert('Operation Failed', 'Could not sync clock status with server.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderWorkerRow = ({ item }) => {
        const isSelected = selectedWorkers.includes(item._id);
        return (
            <TouchableOpacity 
                style={[styles.row, isSelected && styles.selectedRow]}
                onPress={() => toggleSelection(item._id)}
                activeOpacity={0.7}
            >
                {/* Checkbox Col */}
                <View style={styles.checkCol}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                    </View>
                </View>

                {/* Identity Col */}
                <View style={styles.identityCol}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{(item.fullName || 'W').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.workerMeta}>
                        <Text style={styles.workerName}>{item.fullName}</Text>
                        <Text style={styles.workerRole}>WORKER</Text>
                    </View>
                </View>

                {/* Jobsite Col */}
                <View style={styles.siteCol}>
                    <View style={styles.sitePill}>
                         <MaterialCommunityIcons name="office-building-marker" size={14} color="#94A3B8" />
                         <Text style={styles.siteTxt} numberOfLines={1}>{item.siteName}</Text>
                    </View>
                </View>

                {/* Status Col */}
                <View style={styles.statusCol}>
                    <View style={[styles.statusTag, { backgroundColor: item.isClockedIn ? '#ECFDF5' : '#F8FAFC' }]}>
                        <Text style={[styles.statusTagTxt, { color: item.isClockedIn ? '#10B981' : '#94A3B8' }]}>
                            {item.isClockedIn ? 'LIVE ON SITE' : 'OFF DUTY'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const ListHeader = () => (
        <View style={styles.dashboardHeader}>
            <View style={styles.statsContainer}>
                <View style={[styles.statBox, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                    <MaterialCommunityIcons name="account-group" size={22} color="#2563EB" />
                    <Text style={styles.statNumber}>{stats.total}</Text>
                    <Text style={styles.statSubtitle}>TOTAL FLEET</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
                    <MaterialCommunityIcons name="account-check" size={22} color="#10B981" />
                    <Text style={styles.statNumber}>{stats.onSite}</Text>
                    <Text style={styles.statSubtitle}>LIVE ON SITE</Text>
                </View>
            </View>

            <View style={styles.controlPanel}>
                <View style={styles.searchRow}>
                    <View style={styles.premiumSearchBar}>
                        <MaterialCommunityIcons name="magnify" size={22} color="#94A3B8" />
                        <TextInput 
                            style={styles.premiumInput}
                            placeholder="Search crew members..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity style={styles.bulkSelectBtn} onPress={selectAll}>
                        <MaterialCommunityIcons 
                            name={selectedWorkers.length === filteredWorkers.length && filteredWorkers.length > 0 ? "checkbox-marked" : "checkbox-blank-outline"} 
                            size={24} color="#2563EB" 
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.targetSiteCard} onPress={() => setProjectModalVisible(true)}>
                    <View style={styles.siteIconWrap}>
                        <MaterialCommunityIcons name="office-building" size={20} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.targetLabel}>TARGET JOBSITE</Text>
                        <Text style={styles.targetValue} numberOfLines={1}>{selectedProject?.name || 'Select Target Site'}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Crew Control" showBranding={true} />

            <FlatList
                data={filteredWorkers}
                keyExtractor={(item, index) => `worker-${item._id || item.id || index}-${index}`}
                renderItem={renderWorkerRow}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{ paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.noWorkers}>
                        <MaterialCommunityIcons name="account-off" size={60} color="#E2E8F0" />
                        <Text style={styles.noWorkersTxt}>No crew members found</Text>
                    </View>
                }
            />

            {/* Floating Action Bar */}
            {selectedWorkers.length > 0 && (
                <View style={[styles.floatingAction, SHADOWS.large]}>
                    <View style={styles.actionInfo}>
                        <Text style={styles.actionCount}>{selectedWorkers.length}</Text>
                        <Text style={styles.actionText}>Selected</Text>
                    </View>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]}
                            onPress={handleBulkClockIn}
                            disabled={isProcessing}
                        >
                            <MaterialCommunityIcons name="login" size={20} color="#fff" />
                            <Text style={styles.actionBtnTxt}>IN</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.primaryActionBtn, { backgroundColor: '#F43F5E' }]}
                            onPress={handleBulkClockOut}
                            disabled={isProcessing}
                        >
                            <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                            <Text style={styles.actionBtnTxt}>OUT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Job Select Modal */}
            <Modal visible={projectModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Target Jobsite</Text>
                        <FlatList
                            data={projects}
                            keyExtractor={(p, index) => `project-${p._id || index}-${index}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.modalItem}
                                    onPress={() => { setSelectedProject(item); setProjectModalVisible(false); }}
                                >
                                    <Text style={styles.modalItemTxt}>{item.name}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setProjectModalVisible(false)}>
                            <Text style={styles.closeTxt}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Header & Stats
    dashboardHeader: { padding: 20 },
    statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statBox: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 4 },
    statSubtitle: { fontSize: 8, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },

    // Control Panel
    controlPanel: { gap: 12 },
    searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    premiumSearchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', height: 52, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    premiumInput: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '700', color: '#1E293B' },
    bulkSelectBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    targetSiteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' },
    siteIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    targetLabel: { fontSize: 8, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    targetValue: { fontSize: 13, fontWeight: '800', color: '#1E293B' },

    // Worker Rows
    row: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    selectedRow: { backgroundColor: '#EFF6FF' },
    checkCol: { width: 40 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    identityCol: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
    workerMeta: { marginLeft: 12 },
    workerName: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    workerRole: { fontSize: 9, fontWeight: '900', color: '#2563EB', marginTop: 2 },
    siteCol: { flex: 0.8 },
    sitePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    siteTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    statusCol: { flex: 0.8, alignItems: 'flex-end' },
    statusTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    statusTagTxt: { fontSize: 9, fontWeight: '900' },

    // Floating UI
    floatingAction: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#0F172A', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionInfo: { alignItems: 'center', paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: '#334155' },
    actionCount: { color: '#fff', fontSize: 18, fontWeight: '900' },
    actionText: { color: '#94A3B8', fontSize: 8, fontWeight: '800' },
    actionButtons: { flex: 1, flexDirection: 'row', gap: 10, marginLeft: 15 },
    primaryActionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },

    noWorkers: { alignItems: 'center', padding: 100 },
    noWorkersTxt: { color: '#94A3B8', marginTop: 12, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 20 },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalItemTxt: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    closeBtn: { marginTop: 24, alignItems: 'center', padding: 14, backgroundColor: '#F1F5F9', borderRadius: 16 },
    closeTxt: { fontWeight: '900', color: '#0F172A' }
});

export default CrewClockScreen;
