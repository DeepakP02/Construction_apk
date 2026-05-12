import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, SafeAreaView, Modal,
    StatusBar, Platform, ScrollView, Alert, Pressable, Dimensions, useWindowDimensions, KeyboardAvoidingView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

// ─── Toast Component ─────────────────────────────────────────────────────────
const Toast = ({ visible, message, type }) => {
    const insets = useSafeAreaInsets();
    if (!visible) return null;
    const isSuccess = type === 'success';
    return (
        <View style={[toastStyles.wrap, isSuccess ? toastStyles.success : toastStyles.error, { top: Math.max(insets.top, verticalScale(20)) }]}>
            <MaterialCommunityIcons
                name={isSuccess ? 'check-circle' : 'alert-circle'}
                size={moderateScale(18)} color="#fff"
            />
            <Text style={[toastStyles.text, { fontSize: moderateScale(13) }]}>{message}</Text>
        </View>
    );
};

const toastStyles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        alignSelf: 'center', zIndex: 9999, flexDirection: 'row',
        alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12,
        borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
    },
    success: { backgroundColor: '#10B981' },
    error: { backgroundColor: '#EF4444' },
    text: { color: '#fff', fontWeight: '800' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
const PMCrewControlScreen = ({ navigation }) => {
    const { projects } = useApp();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const [workers, setWorkers]               = useState([]);
    const [loading, setLoading]               = useState(true);
    const [isProcessing, setIsProcessing]     = useState(false);
    const [searchQuery, setSearchQuery]       = useState('');
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);

    const [clockInDDOpen, setClockInDDOpen]   = useState(false);
    const [clockOutDDOpen, setClockOutDDOpen] = useState(false);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [manualModalVisible, setManualModalVisible]     = useState(false);
    const [manualWorker, setManualWorker]                 = useState(null);
    const [isManualClockOut, setIsManualClockOut]         = useState(false);
    const [manualData, setManualData]                     = useState({
        date: new Date().toISOString().split('T')[0],
        clockIn: '',
        clockOut: '',
        reason: '',
        projectId: '',
    });

    const [stats, setStats] = useState({ onSite: 0, offDuty: 0, total: 0 });
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    const [now, setNow] = useState(new Date());
    const tickRef = useRef(null);
    useEffect(() => {
        tickRef.current = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(tickRef.current);
    }, []);

    const getElapsed = (clockInISO) => {
        if (!clockInISO) return '--:--';
        const diff = Math.max(0, now.getTime() - new Date(clockInISO).getTime());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    useEffect(() => {
        if (projects?.length > 0 && !selectedProject) {
            setSelectedProject(projects[0]);
        }
    }, [projects]);

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
                    isManual: activeLog?.isManual || false,
                    activeLogId: activeLog?._id || activeLog?.id || null,
                    clockInISO: activeLog?.clockIn || null,
                    clockInFormatted: activeLog?.clockIn
                        ? new Date(activeLog.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--',
                    site: activeLog?.projectId?.name || 'Assigned Site',
                };
            });
            setWorkers(enriched);
            setStats({
                onSite: enriched.filter(w => w.isClockedIn).length,
                offDuty: enriched.filter(w => !w.isClockedIn).length,
                total: enriched.length,
            });
        } catch (err) {
            console.error('Crew fetch error:', err);
            showToast('Failed to load crew data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchCrewData);
        fetchCrewData();
        const bgRefresh = setInterval(fetchCrewData, 30000);
        return () => { unsub(); clearInterval(bgRefresh); };
    }, [navigation]);

    const toggleSelection = (id) => {
        setSelectedWorkers(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedWorkers.length === filteredWorkers.length) {
            setSelectedWorkers([]);
        } else {
            setSelectedWorkers(filteredWorkers.map(w => w._id || w.id).filter(Boolean));
        }
    };

    const handleBulkClockIn = async () => {
        const projId = selectedProject?._id || selectedProject?.id;
        if (!projId) { showToast('Please select a target site first', 'error'); return; }
        if (selectedWorkers.length === 0) return;
        try {
            setIsProcessing(true);
            let coords = { latitude: 0, longitude: 0, accuracy: 0 };
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
                }
            } catch (lex) {}
            await Promise.all(
                selectedWorkers.map(wid => {
                    const worker = workers.find(w => (w._id || w.id) === wid);
                    if (!worker?.isClockedIn) {
                        return api.post('/timelogs/clock-in', {
                            userId: wid, projectId: projId, latitude: coords.latitude,
                            longitude: coords.longitude, accuracy: coords.accuracy,
                            deviceInfo: `Mobile PM Dashboard: ${Platform.OS}`
                        });
                    }
                    return Promise.resolve();
                })
            );
            await fetchCrewData();
            setSelectedWorkers([]);
            showToast(`${selectedWorkers.length} crew clocked in successfully`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Clock in failed', 'error');
        } finally {
            setIsProcessing(false);
            setClockInDDOpen(false);
        }
    };

    const handleBulkClockOut = async () => {
        if (selectedWorkers.length === 0) return;
        try {
            setIsProcessing(true);
            let coords = { latitude: 0, longitude: 0, accuracy: 0 };
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
                }
            } catch (lex) { }
            await Promise.all(
                selectedWorkers.map(wid => {
                    const worker = workers.find(w => (w._id || w.id) === wid);
                    if (worker?.isClockedIn) {
                        return api.post('/timelogs/clock-out', {
                            userId: wid, latitude: coords.latitude, longitude: coords.longitude,
                            accuracy: coords.accuracy, deviceInfo: `Mobile PM Dashboard: ${Platform.OS}`
                        });
                    }
                    return Promise.resolve();
                })
            );
            await fetchCrewData();
            setSelectedWorkers([]);
            showToast(`${selectedWorkers.length} crew clocked out successfully`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Clock out failed', 'error');
        } finally {
            setIsProcessing(false);
            setClockOutDDOpen(false);
        }
    };

    const handleManualSubmit = async () => {
        if (!manualWorker || !manualData.clockIn || !manualData.date) {
            showToast('Fill in all required fields', 'error'); return;
        }
        const projId = manualData.projectId || (selectedProject?._id || selectedProject?.id);
        if (!projId) { showToast('Select a project first', 'error'); return; }
        try {
            setIsProcessing(true);
            const clockIn  = `${manualData.date}T${manualData.clockIn}`;
            const clockOut = manualData.clockOut ? `${manualData.date}T${manualData.clockOut}` : null;
            if (new Date(clockIn) > new Date()) { showToast('Cannot enter future clock-in time', 'error'); return; }
            if (clockOut && new Date(clockOut) < new Date(clockIn)) { showToast('Clock-out must be after clock-in', 'error'); return; }
            let coords = { latitude: 0, longitude: 0, accuracy: 0 };
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
                }
            } catch (lex) { }
            if (isManualClockOut) {
                await api.post('/timelogs/clock-out', {
                    userId: manualWorker._id || manualWorker.id, isManual: true,
                    clockOut: clockOut || new Date().toISOString(), reason: manualData.reason,
                    latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
                });
            } else {
                await api.post('/timelogs/clock-in', {
                    userId: manualWorker._id || manualWorker.id, projectId: projId, isManual: true, 
                    clockIn, clockOut, reason: manualData.reason, latitude: coords.latitude, 
                    longitude: coords.longitude, accuracy: coords.accuracy,
                });
            }
            await fetchCrewData();
            setManualModalVisible(false);
            setManualWorker(null);
            setIsManualClockOut(false);
            setManualData({ date: new Date().toISOString().split('T')[0], clockIn: '', clockOut: '', reason: '', projectId: '' });
            showToast('Manual entry recorded');
        } catch (err) {
            showToast(err.response?.data?.message || 'Manual entry failed', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredWorkers = workers.filter(w =>
        (w.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allSelected = filteredWorkers.length > 0 &&
        filteredWorkers.every(w => selectedWorkers.includes(w._id || w.id));

    const renderWorkerCard = ({ item }) => {
        const workerId = item._id || item.id;
        const selected = selectedWorkers.includes(workerId);
        const elapsed  = item.isClockedIn ? getElapsed(item.clockInISO) : null;

        return (
            <TouchableOpacity
                style={[styles.workerCard, selected && styles.workerCardSelected, { borderRadius: moderateScale(20) }]}
                onPress={() => toggleSelection(workerId)}
                activeOpacity={0.85}
            >
                <View style={[styles.cardRow, { paddingHorizontal: scale(14), paddingVertical: verticalScale(14) }]}>
                    <View style={[styles.checkbox, selected && styles.checkboxActive, { width: scale(22), height: scale(22), borderRadius: moderateScale(7) }]}>
                        {selected && <MaterialCommunityIcons name="check" size={moderateScale(13)} color="#fff" />}
                    </View>
                    <View style={[styles.avatarCircle, { width: scale(44), height: scale(44), borderRadius: scale(22) }]}>
                        <Text style={[styles.avatarLetter, { fontSize: moderateScale(18) }]}>
                            {(item.fullName || 'U')[0].toUpperCase()}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.workerName, { fontSize: moderateScale(15) }]} numberOfLines={1}>{item.fullName}</Text>
                        <View style={[styles.rolePill, { paddingHorizontal: scale(7), paddingVertical: verticalScale(2), borderRadius: moderateScale(5) }]}>
                            <Text style={[styles.rolePillText, { fontSize: moderateScale(8) }]}>WORKER</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, item.isClockedIn ? styles.statusLive : styles.statusOff, { paddingHorizontal: scale(10), paddingVertical: verticalScale(5) }]}>
                        {item.isClockedIn && <View style={[styles.pulseDot, { width: scale(6), height: scale(6) }]} />}
                        <Text style={[styles.statusBadgeText, { color: item.isClockedIn ? '#065F46' : '#64748B', fontSize: moderateScale(9) }]}>
                            {item.isClockedIn ? 'Live on Site' : 'OFF DUTY'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.siteRow, { paddingHorizontal: scale(14), paddingBottom: verticalScale(10) }]}>
                    <View style={[styles.siteIconBox, { width: scale(22), height: scale(22), borderRadius: moderateScale(6) }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(12)} color="#94A3B8" />
                    </View>
                    <Text style={[styles.siteText, { fontSize: moderateScale(12) }]} numberOfLines={1}>{item.site}</Text>
                    {item.isManual && (
                        <View style={[styles.manualPill, { paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(8) }]}>
                            <View style={[styles.manualDot, { width: scale(5), height: scale(5) }]} />
                            <Text style={[styles.manualPillText, { fontSize: moderateScale(8) }]}>Manual Trace</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.metricsRow, { paddingHorizontal: scale(14), paddingBottom: verticalScale(14) }]}>
                    <View style={styles.metricsLeft}>
                        <Text style={[styles.metricsLabel, { fontSize: moderateScale(9) }]}>ASSIGNED SITE</Text>
                        <Text style={[styles.metricsValue, { fontSize: moderateScale(12) }]} numberOfLines={1}>{item.site}</Text>
                    </View>
                    <View style={styles.metricsRight}>
                        <View style={[item.isClockedIn ? styles.loggedActiveChip : styles.offDutyChip, { paddingHorizontal: scale(12), paddingVertical: verticalScale(7), borderRadius: moderateScale(12) }]}>
                            <MaterialCommunityIcons name="clock-outline" size={moderateScale(13)} color={item.isClockedIn ? '#059669' : '#94A3B8'} />
                            <Text style={[item.isClockedIn ? styles.loggedActiveText : styles.offDutyText, { fontSize: moderateScale(11) }]}>
                                {item.isClockedIn ? 'LOGGED ACTIVE' : '--:--'}
                            </Text>
                        </View>
                        {item.isClockedIn && elapsed && (
                            <View style={styles.elapsedRow}>
                                <MaterialCommunityIcons name="timer-outline" size={moderateScale(11)} color="#10B981" />
                                <Text style={[styles.elapsedText, { fontSize: moderateScale(10) }]}>
                                    {elapsed} • In since {item.clockInFormatted}
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.shiftLogBtn}
                            onPress={() => navigation.navigate('WorkerLogs', { userId: item._id, workerName: item.fullName })}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={[styles.shiftLogText, { fontSize: moderateScale(10) }]}>Today's Shift Log</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <Toast {...toast} />

            <View style={[styles.header, { paddingTop: Math.max(insets.top, verticalScale(10)), paddingHorizontal: scale(16), paddingBottom: verticalScale(16) }]}>
                <TouchableOpacity style={[styles.backBtn, { width: scale(38), height: scale(38), borderRadius: moderateScale(12) }]} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={moderateScale(22)} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: scale(12) }}>
                    <Text style={[styles.pageTitle, { fontSize: moderateScale(20) }]}>Crew Control</Text>
                    <Text style={[styles.pageSubtitle, { fontSize: moderateScale(11) }]}>Manage on-site workforce attendance</Text>
                </View>
                {loading && workers.length > 0 && <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: scale(10) }} />}
                <TouchableOpacity onPress={fetchCrewData} disabled={loading}>
                    <MaterialCommunityIcons name="refresh" size={moderateScale(22)} color={loading ? '#CBD5E1' : '#2563EB'} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? '10%' : scale(16), paddingTop: verticalScale(36) }]} keyboardShouldPersistTaps="handled">
                <View style={[styles.livePill, { paddingHorizontal: scale(14), paddingVertical: verticalScale(8), borderRadius: moderateScale(20) }]}>
                    <View style={[styles.pulseDotGreen, { width: scale(8), height: scale(8) }]} />
                    <Text style={[styles.livePillText, { fontSize: moderateScale(11) }]}>Live: {stats.onSite} Workers Active</Text>
                </View>

                <View style={[styles.searchBox, { borderRadius: moderateScale(16), paddingHorizontal: scale(14), height: verticalScale(50) }]}>
                    <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                    <TextInput
                        style={[styles.searchInput, { fontSize: moderateScale(14) }]}
                        placeholder="Search crew members by name..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialCommunityIcons name="close-circle" size={moderateScale(18)} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity style={[styles.siteSelector, { borderRadius: moderateScale(16), paddingHorizontal: scale(14), height: verticalScale(58) }]} onPress={() => setProjectModalVisible(true)}>
                    <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(20)} color="#2563EB" />
                    <View style={{ flex: 1, marginLeft: scale(10) }}>
                        <Text style={[styles.siteSelectorLabel, { fontSize: moderateScale(8) }]}>TARGET SITE</Text>
                        <Text style={[styles.siteSelectorValue, { fontSize: moderateScale(14) }]} numberOfLines={1}>
                            {selectedProject ? selectedProject.name : 'Select Target Site...'}
                        </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={moderateScale(20)} color="#94A3B8" />
                </TouchableOpacity>

                <View style={[styles.actionBar, { marginBottom: verticalScale(16) }]}>
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: selectedWorkers.length > 0 ? '#2563EB' : '#E2E8F0', paddingVertical: verticalScale(12), borderRadius: moderateScale(14) }]}
                            onPress={() => { setClockOutDDOpen(false); setClockInDDOpen(prev => !prev); }}
                            disabled={selectedWorkers.length === 0 || isProcessing}
                        >
                            {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="play" size={moderateScale(14)} color={selectedWorkers.length > 0 ? '#fff' : '#94A3B8'} />}
                            <Text style={[styles.actionBtnText, { color: selectedWorkers.length > 0 ? '#fff' : '#94A3B8', fontSize: moderateScale(10) }]}>Clock In ({selectedWorkers.length})</Text>
                            <MaterialCommunityIcons name="chevron-down" size={moderateScale(14)} color={selectedWorkers.length > 0 ? '#fff' : '#94A3B8'} />
                        </TouchableOpacity>

                        {clockInDDOpen && (
                            <View style={[styles.dropdown, { borderRadius: moderateScale(14) }]}>
                                <TouchableOpacity style={[styles.dropdownItem, { paddingHorizontal: scale(16), paddingVertical: verticalScale(14) }]} onPress={handleBulkClockIn}>
                                    <MaterialCommunityIcons name="refresh" size={moderateScale(14)} color="#2563EB" />
                                    <Text style={[styles.dropdownItemText, { color: '#2563EB', fontSize: moderateScale(12) }]}>Auto Clock In</Text>
                                </TouchableOpacity>
                                <View style={styles.dropdownDivider} />
                                <TouchableOpacity style={[styles.dropdownItem, { paddingHorizontal: scale(16), paddingVertical: verticalScale(14) }]} onPress={() => { const w = workers.find(x => x._id === selectedWorkers[0]); if (w) { setManualWorker(w); setIsManualClockOut(false); setClockInDDOpen(false); setManualModalVisible(true); } }}>
                                    <MaterialCommunityIcons name="calendar-edit" size={moderateScale(14)} color="#F59E0B" />
                                    <Text style={[styles.dropdownItemText, { color: '#F59E0B', fontSize: moderateScale(12) }]}>Manual Entry</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={{ flex: 1 }}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: selectedWorkers.length > 0 ? '#EF4444' : '#E2E8F0', paddingVertical: verticalScale(12), borderRadius: moderateScale(14) }]}
                            onPress={() => { setClockInDDOpen(false); setClockOutDDOpen(prev => !prev); }}
                            disabled={selectedWorkers.length === 0 || isProcessing}
                        >
                            {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="stop" size={moderateScale(14)} color={selectedWorkers.length > 0 ? '#fff' : '#94A3B8'} />}
                            <Text style={[styles.actionBtnText, { color: selectedWorkers.length > 0 ? '#fff' : '#94A3B8', fontSize: moderateScale(10) }]}>Clock Out ({selectedWorkers.length})</Text>
                            <MaterialCommunityIcons name="chevron-down" size={moderateScale(14)} color={selectedWorkers.length > 0 ? '#fff' : '#94A3B8'} />
                        </TouchableOpacity>

                        {clockOutDDOpen && (
                            <View style={[styles.dropdown, { borderRadius: moderateScale(14) }]}>
                                <TouchableOpacity style={[styles.dropdownItem, { paddingHorizontal: scale(16), paddingVertical: verticalScale(14) }]} onPress={handleBulkClockOut}>
                                    <MaterialCommunityIcons name="refresh" size={moderateScale(14)} color="#EF4444" />
                                    <Text style={[styles.dropdownItemText, { color: '#EF4444', fontSize: moderateScale(12) }]}>Auto Clock Out</Text>
                                </TouchableOpacity>
                                <View style={styles.dropdownDivider} />
                                <TouchableOpacity style={[styles.dropdownItem, { paddingHorizontal: scale(16), paddingVertical: verticalScale(14) }]} onPress={() => { const w = workers.find(x => x._id === selectedWorkers[0]); if (w) { setManualWorker(w); setIsManualClockOut(true); setClockOutDDOpen(false); setManualModalVisible(true); } }}>
                                    <MaterialCommunityIcons name="calendar-edit" size={moderateScale(14)} color="#F59E0B" />
                                    <Text style={[styles.dropdownItemText, { color: '#F59E0B', fontSize: moderateScale(12) }]}>Manual Entry</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.tableHeader, { borderRadius: moderateScale(12), paddingHorizontal: scale(12), paddingVertical: verticalScale(10) }]}>
                    <TouchableOpacity style={[styles.headerCheckbox, allSelected && styles.headerCheckboxActive, { width: scale(22), height: scale(22), borderRadius: moderateScale(6) }]} onPress={selectAll}>
                        {allSelected && <MaterialCommunityIcons name="check" size={moderateScale(12)} color="#fff" />}
                    </TouchableOpacity>
                    <Text style={[styles.tableHeaderText, { flex: 1.8, fontSize: moderateScale(9) }]}>Worker Identity</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'center', fontSize: moderateScale(9) }]}>Current Status</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right', fontSize: moderateScale(9) }]}>Shift Metrics</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingView}>
                        <ActivityIndicator size="large" color="#2563EB" />
                        <Text style={[styles.loadingText, { fontSize: moderateScale(12) }]}>Synchronizing Crew Data...</Text>
                    </View>
                ) : filteredWorkers.length === 0 ? (
                    <View style={styles.emptyView}>
                        <MaterialCommunityIcons name="account-search-outline" size={moderateScale(52)} color="#CBD5E1" />
                        <Text style={[styles.emptyText, { fontSize: moderateScale(13) }]}>No workers found</Text>
                    </View>
                ) : (
                    filteredWorkers.map(item => (
                        <React.Fragment key={item._id || item.id || item.fullName}>
                            {renderWorkerCard({ item })}
                        </React.Fragment>
                    ))
                )}

                <View style={{ height: verticalScale(120) }} />
            </ScrollView>

            <Modal visible={projectModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, { borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                        <View style={styles.modalHandle} />
                        <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Select Target Jobsite</Text>
                            <TouchableOpacity onPress={() => setProjectModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={projects || []}
                            keyExtractor={p => p._id || p.id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => {
                                const isActive = selectedProject?._id === (item._id || item.id);
                                return (
                                    <TouchableOpacity style={[styles.projectItem, isActive && styles.projectItemActive, { padding: scale(16), borderRadius: moderateScale(16) }]} onPress={() => { setSelectedProject(item); setProjectModalVisible(false); }}>
                                        <View>
                                            <Text style={[styles.projectName, isActive && { color: '#fff' }, { fontSize: moderateScale(15) }]}>{item.name}</Text>
                                            <Text style={[styles.projectLoc, isActive && { color: 'rgba(255,255,255,0.7)' }, { fontSize: moderateScale(11) }]}>{(typeof item.location === 'object' ? item.location?.address : item.location) || 'Site Location'}</Text>
                                        </View>
                                        {isActive && <MaterialCommunityIcons name="check-circle" size={moderateScale(20)} color="#fff" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <Modal visible={manualModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={{ width: '100%', flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? moderateScale(88) : moderateScale(20)}
                    >
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                    >
                        <View style={[styles.modalSheet, { paddingBottom: 50, borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                            <View style={styles.modalHandle} />
                            <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                                <View>
                                    <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Manual Time Entry</Text>
                                    <Text style={[styles.modalSubtitle, { fontSize: moderateScale(12) }]}>Recording for {manualWorker?.fullName}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setManualModalVisible(false)}>
                                    <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>WORKER NAME</Text>
                                <View style={[styles.formInputReadonly, { borderRadius: moderateScale(12), height: verticalScale(48), paddingHorizontal: scale(14) }]}>
                                    <MaterialCommunityIcons name="account-outline" size={moderateScale(18)} color="#94A3B8" />
                                    <Text style={[styles.readonlyText, { fontSize: moderateScale(14) }]}>{manualWorker?.fullName || ''}</Text>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>TARGET PROJECT</Text>
                                <View style={[styles.formPickerWrap, { borderRadius: moderateScale(12), paddingHorizontal: scale(14), paddingVertical: verticalScale(10) }]}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(18)} color="#94A3B8" />
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                        {(projects || []).map(p => (
                                            <TouchableOpacity key={p._id || p.id || p.name} style={[styles.projectChip, (manualData.projectId || selectedProject?._id) === p._id && styles.projectChipActive, { paddingHorizontal: scale(12), paddingVertical: verticalScale(6) }]} onPress={() => setManualData({ ...manualData, projectId: p._id })}>
                                                <Text style={[styles.projectChipText, (manualData.projectId || selectedProject?._id) === p._id && { color: '#fff' }, { fontSize: moderateScale(12) }]}>{p.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>WORK DATE</Text>
                                <View style={[styles.formInput, { borderRadius: moderateScale(12), height: verticalScale(48), paddingHorizontal: scale(14) }]}>
                                    <MaterialCommunityIcons name="calendar-outline" size={moderateScale(18)} color="#94A3B8" />
                                    <TextInput style={[styles.formInputText, { fontSize: moderateScale(14) }]} value={manualData.date} onChangeText={val => setManualData({ ...manualData, date: val })} placeholder="YYYY-MM-DD" placeholderTextColor="#CBD5E1" />
                                </View>
                            </View>

                            <View style={[styles.formRow, { gap: scale(12) }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>CLOCK IN *</Text>
                                    <View style={[styles.formInput, { borderRadius: moderateScale(12), height: verticalScale(48), paddingHorizontal: scale(14) }]}>
                                        <MaterialCommunityIcons name="clock-in" size={moderateScale(18)} color="#10B981" />
                                        <TextInput style={[styles.formInputText, { fontSize: moderateScale(14) }]} value={manualData.clockIn} onChangeText={val => setManualData({ ...manualData, clockIn: val })} placeholder="HH:MM" placeholderTextColor="#CBD5E1" />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>CLOCK OUT</Text>
                                    <View style={[styles.formInput, { borderRadius: moderateScale(12), height: verticalScale(48), paddingHorizontal: scale(14) }]}>
                                        <MaterialCommunityIcons name="clock-out" size={moderateScale(18)} color="#EF4444" />
                                        <TextInput style={[styles.formInputText, { fontSize: moderateScale(14) }]} value={manualData.clockOut} onChangeText={val => setManualData({ ...manualData, clockOut: val })} placeholder="HH:MM" placeholderTextColor="#CBD5E1" />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.formLabel, { fontSize: moderateScale(9) }]}>REASON / NOTE</Text>
                                <TextInput style={[styles.formTextarea, { borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]} value={manualData.reason} onChangeText={val => setManualData({ ...manualData, reason: val })} placeholder="Explain why..." placeholderTextColor="#CBD5E1" multiline numberOfLines={3} textAlignVertical="top" />
                            </View>

                            <View style={[styles.manualBtnRow, { gap: scale(12) }]}>
                                <TouchableOpacity style={[styles.cancelBtn, { height: verticalScale(50), borderRadius: moderateScale(14) }]} onPress={() => setManualModalVisible(false)}><Text style={[styles.cancelBtnText, { fontSize: moderateScale(13) }]}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.submitBtn, isProcessing && { opacity: 0.6 }, { height: verticalScale(50), borderRadius: moderateScale(14) }]} onPress={handleManualSubmit} disabled={isProcessing}>
                                    {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="check-circle" size={moderateScale(16)} color="#fff" />}
                                    <Text style={[styles.submitBtnText, { fontSize: moderateScale(13) }]}>Submit Entry</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    pageTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    pageSubtitle: { fontWeight: '700', color: '#64748B', marginTop: 1 },
    scrollContent: { },
    livePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, gap: 8 },
    pulseDotGreen: { backgroundColor: '#10B981' },
    livePillText: { fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', gap: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
    searchInput: { flex: 1, fontWeight: '700', color: '#0F172A' },
    siteSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    siteSelectorLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
    siteSelectorValue: { fontWeight: '800', color: '#1E293B' },
    actionBar: { flexDirection: 'row', gap: 10, zIndex: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    actionBtnText: { fontWeight: '900', letterSpacing: 0.5 },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, backgroundColor: '#fff', marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dropdownItemText: { fontWeight: '800', letterSpacing: 0.3 },
    dropdownDivider: { height: 1, backgroundColor: '#F8FAFC' },
    tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', marginBottom: 10, gap: 10 },
    headerCheckbox: { borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    headerCheckboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    tableHeaderText: { fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    workerCard: { backgroundColor: '#fff', marginBottom: 12, borderWidth: 1.5, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
    workerCardSelected: { borderColor: '#BFDBFE', backgroundColor: '#F0F7FF' },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkbox: { borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    avatarCircle: { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
    avatarLetter: { fontWeight: '900', color: '#1D4ED8' },
    workerName: { fontWeight: '900', color: '#0F172A' },
    rolePill: { backgroundColor: '#EFF6FF', alignSelf: 'flex-start', marginTop: 3 },
    rolePillText: { fontWeight: '900', color: '#2563EB', letterSpacing: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 50, borderWidth: 1 },
    statusLive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    statusOff:  { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
    pulseDot: { backgroundColor: '#10B981' },
    statusBadgeText: { fontWeight: '900', letterSpacing: 0.5 },
    siteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    siteIconBox: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    siteText: { fontWeight: '700', color: '#64748B', flex: 1 },
    manualPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
    manualDot: { backgroundColor: '#F59E0B' },
    manualPillText: { fontWeight: '900', color: '#92400E', letterSpacing: 0.5 },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    metricsLeft: { flex: 1 },
    metricsLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase' },
    metricsValue: { fontWeight: '700', color: '#475569', marginTop: 2 },
    metricsRight: { alignItems: 'flex-end', gap: 5 },
    loggedActiveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
    loggedActiveText: { fontWeight: '900', color: '#059669' },
    offDutyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    offDutyText: { fontWeight: '900', color: '#94A3B8' },
    elapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    elapsedText: { fontWeight: '700', color: '#10B981' },
    shiftLogBtn: { flexDirection: 'row', alignItems: 'center' },
    shiftLogText: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5, textDecorationLine: 'underline', textDecorationColor: '#E2E8F0' },
    loadingView: { paddingVertical: 60, alignItems: 'center', gap: 12 },
    loadingText: { fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
    emptyView: { paddingVertical: 60, alignItems: 'center', gap: 10 },
    emptyText: { fontWeight: '800', color: '#CBD5E1' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%' },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { fontWeight: '700', color: '#64748B', marginTop: 2 },
    projectItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    projectItemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    projectName: { fontWeight: '800', color: '#1E293B' },
    projectLoc: { color: '#64748B', marginTop: 2 },
    formGroup: { marginBottom: 14 },
    formLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 6 },
    formInput: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    formInputText: { flex: 1, fontWeight: '700', color: '#1E293B' },
    formInputReadonly: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F1F5F9' },
    readonlyText: { fontWeight: '700', color: '#64748B' },
    formPickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    projectChip: { backgroundColor: '#E2E8F0', marginRight: 8 },
    projectChipActive: { backgroundColor: '#2563EB' },
    projectChipText: { fontWeight: '700', color: '#475569' },
    formRow: { flexDirection: 'row' },
    formTextarea: { backgroundColor: '#F8FAFC', paddingTop: 12, paddingBottom: 12, minHeight: 90, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#1E293B' },
    manualBtnRow: { flexDirection: 'row', marginTop: 8 },
    cancelBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
    cancelBtnText: { fontWeight: '900', color: '#64748B' },
    submitBtn: { flex: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#2563EB' },
    submitBtnText: { fontWeight: '900', color: '#fff' },
});

export default PMCrewControlScreen;
