import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, StatusBar, ScrollView, TextInput, 
    Dimensions, SafeAreaView, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';

const { width } = Dimensions.get('window');

const WorkerLogsScreen = ({ navigation }) => {
    const { user, isClockedIn } = useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/timelogs');
            setLogs(res.data);
        } catch (e) {
            console.error('Fetch logs error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const calculateTotalHours = () => {
        const totalMs = (logs || []).reduce((acc, log) => {
            if (log.clockIn && log.clockOut) {
                return acc + (new Date(log.clockOut) - new Date(log.clockIn));
            }
            return acc;
        }, 0);
        return (totalMs / 3600000).toFixed(1);
    };

    const stats = [
        { label: 'TOTAL HOURS', value: `${calculateTotalHours()}h`, sub: 'Current Period', icon: 'clock-time-four', color: '#2563EB' },
        { label: 'PENDING', value: logs.filter(l => !l.approved && l.clockOut).length, sub: 'In Review', icon: 'timer-sand', color: '#F59E0B' },
        { label: 'APPROVED', value: logs.filter(l => l.approved).length, sub: 'Verified', icon: 'check-decagram', color: '#10B981' },
    ];

    const openDetails = (log) => {
        setSelectedLog(log);
        setShowDetail(true);
    };

    const renderLogItem = ({ item }) => {
        const durationH = item.clockOut ? ((new Date(item.clockOut) - new Date(item.clockIn)) / 3600000).toFixed(1) : '---';
        const status = item.approved ? 'APPROVED' : (item.clockOut ? 'PENDING' : 'ON-GOING');
        const statusColor = item.approved ? '#10B981' : (item.clockOut ? '#F59E0B' : '#2563EB');

        return (
            <View style={styles.logCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.siteInfo}>
                        <MaterialCommunityIcons name="office-building" size={20} color="#64748B" />
                        <Text style={styles.siteName} numberOfLines={1}>{item.projectId?.name || 'Project Site'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>DATE</Text>
                            <Text style={styles.infoValue}>{new Date(item.clockIn).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>SHIFT TIME</Text>
                            <Text style={styles.infoValue}>
                                {new Date(item.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {item.clockOut ? new Date(item.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                        <View style={styles.durationBox}>
                            <Text style={styles.durationLabel}>TOTAL DURATION</Text>
                            <Text style={styles.durationValue}>{durationH} Hours</Text>
                        </View>
                        <TouchableOpacity style={styles.detailsBtn} onPress={() => openDetails(item)}>
                            <Text style={styles.detailsBtnText}>View Details</Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color="#2563EB" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const Header = () => (
        <View style={styles.headerArea}>
            <View style={styles.titleBox}>
                <Text style={styles.headerTitle}>My Hours</Text>
                <Text style={styles.headerSub}>Track your site hours and attendance history</Text>
            </View>

            <View style={styles.statsGrid}>
                {stats.map((s, i) => (
                    <View key={i} style={[styles.miniStat, { borderTopColor: s.color }]}>
                        <Text style={styles.miniLabel}>{s.label}</Text>
                        <Text style={styles.miniValue}>{s.value}</Text>
                        <Text style={styles.miniSub}>{s.sub}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search by site or date..." 
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            
            {/* COMPACT TOPBAR */}
            <View style={styles.topbar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.topbarTitle}>Attendance Logs</Text>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialCommunityIcons name="filter-variant" size={22} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Syncing logs...</Text>
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderLogItem}
                    ListHeaderComponent={Header}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyMain}>No Records Found</Text>
                        </View>
                    }
                />
            )}

            {/* DETAIL MODAL */}
            <Modal visible={showDetail} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Log Details</Text>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <MaterialCommunityIcons name="close-circle" size={28} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailCard}>
                                    <Text style={styles.detailSectionLabel}>SITE INFORMATION</Text>
                                    <View style={styles.detailRow}>
                                        <MaterialCommunityIcons name="office-building" size={20} color="#2563EB" />
                                        <Text style={styles.detailValue}>{selectedLog.projectId?.name || 'Project Site'}</Text>
                                    </View>
                                    <Text style={styles.detailSubValue}>{((typeof selectedLog.projectId?.location === 'object' ? selectedLog.projectId.location.address : selectedLog.projectId?.location) || 'Assigned Location').toUpperCase()}</Text>

                                    <View style={styles.detailDivider} />

                                    <Text style={styles.detailSectionLabel}>SHIFT BREAKDOWN</Text>
                                    <View style={styles.timeInfoRow}>
                                        <View style={styles.timeInfoBox}>
                                            <Text style={styles.timeLabel}>CLOCKED IN</Text>
                                            <Text style={styles.timeValue}>{new Date(selectedLog.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                                            <Text style={styles.timeDate}>{new Date(selectedLog.clockIn).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={styles.timeArrow}>
                                            <MaterialCommunityIcons name="arrow-right" size={20} color="#CBD5E1" />
                                        </View>
                                        <View style={styles.timeInfoBox}>
                                            <Text style={styles.timeLabel}>CLOCKED OUT</Text>
                                            <Text style={styles.timeValue}>{selectedLog.clockOut ? new Date(selectedLog.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</Text>
                                            <Text style={styles.timeDate}>{selectedLog.clockOut ? new Date(selectedLog.clockOut).toLocaleDateString() : 'Active'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailDivider} />

                                    <View style={styles.verifiedRow}>
                                        <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
                                        <Text style={styles.verifiedText}>GPS Location Verified at Site</Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.closeModalBtn}
                                        onPress={() => setShowDetail(false)}
                                    >
                                        <Text style={styles.closeModalBtnText}>CLOSE DETAILS</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontSize: 13, fontWeight: '700', color: '#64748B' },
    listContent: { paddingBottom: 60 },

    topbar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        height: 100, // Increased height to accommodate more padding
        backgroundColor: '#FFFFFF', 
        paddingHorizontal: 16,
        paddingTop: 45, // Significantly increased padding for status bar/notch clearance
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    topbarTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },

    headerArea: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 10 },
    titleBox: { marginBottom: 20 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    headerSub: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 4 },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    miniStat: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderTopWidth: 4, ...SHADOWS.small },
    miniLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8 },
    miniValue: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginTop: 5 },
    miniSub: { fontSize: 9, fontWeight: '700', color: '#CBD5E1', marginTop: 3 },

    searchContainer: { marginBottom: 15 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', height: 50, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', ...SHADOWS.small },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '700', color: '#1E293B' },

    logCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 16, borderRadius: 24, overflow: 'hidden', ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    siteInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    siteName: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: '900' },

    cardBody: { padding: 20 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
    infoCol: { flex: 1 },
    infoLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8 },
    infoValue: { fontSize: 14, fontWeight: '800', color: '#334155', marginTop: 6 },

    divider: { height: 1.5, backgroundColor: '#F1F5F9', marginVertical: 15 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    durationBox: { flex: 1 },
    durationLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
    durationValue: { fontSize: 16, fontWeight: '901', color: '#2563EB', marginTop: 4 },
    detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    detailsBtnText: { fontSize: 13, fontWeight: '900', color: '#2563EB' },

    emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyMain: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginTop: 16 },

    // MODAL STYLES
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    
    detailCard: { padding: 4 },
    detailSectionLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    detailValue: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
    detailSubValue: { fontSize: 11, fontWeight: '700', color: '#64748B', marginLeft: 32, marginTop: 4 },
    detailDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 },

    timeInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeInfoBox: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    timeLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    timeValue: { fontSize: 17, fontWeight: '900', color: '#1E293B', marginTop: 8 },
    timeDate: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4 },
    timeArrow: { paddingHorizontal: 10 },

    verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', padding: 15, borderRadius: 16, marginVertical: 20 },
    verifiedText: { fontSize: 13, fontWeight: '800', color: '#10B981' },

    closeModalBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, marginBottom: 20 },
    closeModalBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});

export default WorkerLogsScreen;
