import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
    Modal,
    Alert,
    Dimensions,
    TextInput,
    SafeAreaView,
    StatusBar,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, SPACING, SIZES } from '../../constants/theme';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const DailyLogsScreen = ({ navigation }) => {
    const { user, projects, refreshData, selectedProject: globalSelectedProject } = useApp();
    const { width, height } = useWindowDimensions();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilterProject, setSelectedFilterProject] = useState(null);
    
    // Form States
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [weather, setWeather] = useState({ status: 'Sunny', temperature: '70' });
    const [manpowerCount, setManpowerCount] = useState('1');
    const [manpowerHrs, setManpowerHrs] = useState('8');
    const [workPerformed, setWorkPerformed] = useState('');
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/dailylogs');
            setLogs(res.data || []);
        } catch (e) {
            console.error('Fetch logs error:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Sync filter with global selection
    useEffect(() => {
        if (globalSelectedProject) {
            setSelectedFilterProject(globalSelectedProject);
            setSelectedProject(globalSelectedProject);
        } else {
            setSelectedFilterProject(null);
            setSelectedProject(null);
        }
    }, [globalSelectedProject]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLogs();
        refreshData();
    }, []);

    const handleSubmit = async () => {
        if (!selectedProject || !workPerformed) {
            Alert.alert('Required Fields', 'Please select a project and describe the work performed.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                projectId: selectedProject._id || selectedProject.id,
                date: new Date(date),
                weather: { 
                    status: weather.status, 
                    temperature: parseInt(weather.temperature) || 0 
                },
                manpower: [{
                    role: 'General',
                    count: parseInt(manpowerCount) || 0,
                    hours: parseFloat(manpowerHrs) || 0
                }],
                workPerformed
            };
            await api.post('/dailylogs', payload);
            setModalVisible(false);
            resetForm();
            fetchLogs();
            Alert.alert('Success', 'Daily site log successfully submitted.');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to submit log');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedProject(null);
        setWorkPerformed('');
        setManpowerCount('1');
        setManpowerHrs('8');
        setWeather({ status: 'Sunny', temperature: '70' });
        setDate(new Date().toISOString().split('T')[0]);
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = (log.workPerformed?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             log.projectId?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesProject = !selectedFilterProject || log.projectId?._id === selectedFilterProject._id;
        return matchesSearch && matchesProject;
    });

    const renderLogItem = ({ item }) => {
        const totalManpower = item.manpower?.reduce((acc, m) => acc + (m.count || 0), 0) || 0;
        const logDate = new Date(item.date);

        return (
            <TouchableOpacity 
                style={[styles.tableRow, { paddingVertical: verticalScale(14) }]} 
                activeOpacity={0.7}
                onPress={() => {/* Navigate to detail if needed */}}
            >
                {/* Column: Date & Reporter */}
                <View style={[styles.column, { width: scale(70) }]}>
                    <Text style={[styles.cellMainText, { fontSize: moderateScale(13) }]}>{logDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</Text>
                    <Text style={[styles.cellSubText, { fontSize: moderateScale(11) }]} numberOfLines={1}>{item.reportedBy?.fullName?.split(' ')[0] || 'Jay'}</Text>
                </View>

                {/* Column: Project & Work Snippet */}
                <View style={[styles.column, { flex: 1, paddingHorizontal: scale(4) }]}>
                    <Text style={[styles.cellProjectText, { fontSize: moderateScale(13) }]} numberOfLines={1}>{item.projectId?.name || 'Unassigned'}</Text>
                    <Text style={[styles.cellWorkText, { fontSize: moderateScale(11) }]} numberOfLines={1}>{item.workPerformed}</Text>
                </View>

                {/* Column: Stats */}
                <View style={[styles.column, { width: scale(65), alignItems: 'flex-end' }]}>
                    <View style={[styles.statusChip, { paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: moderateScale(6) }]}>
                        <Text style={[styles.statusChipText, { fontSize: moderateScale(10) }]}>{totalManpower} Men</Text>
                    </View>
                    <View style={styles.weatherMiniTag}>
                        <MaterialCommunityIcons name="thermometer" size={moderateScale(10)} color="#EA580C" />
                        <Text style={[styles.weatherMiniText, { fontSize: moderateScale(10) }]}>{item.weather?.temperature || '0'}°</Text>
                    </View>
                </View>

                {/* Arrow */}
                <View style={{ width: scale(16), alignItems: 'flex-end', marginLeft: scale(4) }}>
                    <MaterialCommunityIcons name="chevron-right" size={moderateScale(16)} color="#CBD5E1" />
                </View>
            </TouchableOpacity>
        );
    };

    const TableHeader = () => (
        <View style={[styles.tableHeader, { paddingVertical: verticalScale(10) }]}>
            <Text style={[styles.headerLabel, { width: scale(70), fontSize: moderateScale(10) }]}>DATE/BY</Text>
            <Text style={[styles.headerLabel, { flex: 1, paddingHorizontal: scale(4), fontSize: moderateScale(10) }]}>PROJECT & ACTIVITY</Text>
            <Text style={[styles.headerLabel, { width: scale(65), textAlign: 'right', fontSize: moderateScale(10) }]}>STATS</Text>
            <View style={{ width: scale(16), marginLeft: scale(4) }} />
        </View>
    );

    if (user?.role !== 'PM' && user?.role !== 'FOREMAN') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <WorkerHeader showBranding={true} />
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="file-document-outline" size={moderateScale(80)} color="#E2E8F0" />
                    <Text style={[styles.emptyTitle, { fontSize: moderateScale(24) }]}>Daily Site Logs</Text>
                    <Text style={[styles.emptySubtitle, { fontSize: moderateScale(14) }]}>Content is being updated by the Project Manager.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader showBranding={true} />
            
            <View style={[styles.content, { paddingHorizontal: isTablet ? '8%' : scale(16) }]}>
                <View style={[styles.topHeader, { marginTop: verticalScale(16), marginBottom: verticalScale(20) }]}>
                    <View>
                        <Text style={[styles.title, { fontSize: moderateScale(24) }]}>Daily Site Logs</Text>
                        <Text style={[styles.subtitle, { fontSize: moderateScale(13) }]}>Consolidated site operations record</Text>
                    </View>
                    <TouchableOpacity style={[styles.actionBtn, { paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderRadius: moderateScale(12) }]} onPress={() => setModalVisible(true)}>
                        <MaterialCommunityIcons name="plus" size={moderateScale(18)} color="#fff" />
                        <Text style={[styles.actionBtnText, { fontSize: moderateScale(12) }]}>New Log</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.filterArea, { marginBottom: verticalScale(16) }]}>
                    <View style={[styles.searchContainer, { height: verticalScale(44), borderRadius: moderateScale(12), paddingHorizontal: scale(12) }]}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput 
                            style={[styles.searchInput, { fontSize: moderateScale(14) }]}
                            placeholder="Search by keywords..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <View style={styles.toolsRow}>
                        <TouchableOpacity 
                            style={[styles.toolBtn, { height: verticalScale(40), borderRadius: moderateScale(12) }]}
                            onPress={() => setFilterModalVisible(true)}
                        >
                            <MaterialCommunityIcons name="filter-variant" size={moderateScale(16)} color="#64748B" style={{marginRight: scale(6)}} />
                            <Text style={[styles.toolBtnText, { fontSize: moderateScale(12) }]} numberOfLines={1}>{selectedFilterProject?.name || 'All Projects'}</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={[styles.toolBtn, { height: verticalScale(40), borderRadius: moderateScale(12) }]}>
                            <MaterialCommunityIcons name="calendar-range" size={moderateScale(16)} color="#64748B" />
                            <Text style={[styles.toolBtnText, { marginLeft: scale(6), fontSize: moderateScale(12) }]}>Range</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TableHeader />

                {loading && !refreshing ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2563EB" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredLogs}
                        renderItem={renderLogItem}
                        keyExtractor={item => item._id}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="file-document-outline" size={moderateScale(64)} color="#CBD5E1" />
                                <Text style={[styles.emptyText, { fontSize: moderateScale(16) }]}>No site logs found</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* NEW LOG MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), maxWidth: scale(600), alignSelf: 'center', width: '100%' }]}>
                            <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                                <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Daily Site Record</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                    <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Project</Text>
                                    <TouchableOpacity 
                                        style={[styles.selectBtn, { height: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14) }]} 
                                        onPress={() => setProjectModalVisible(true)}
                                    >
                                        <Text style={[styles.selectBtnText, !selectedProject && { color: '#94A3B8' }, { fontSize: moderateScale(14) }]}>
                                            {selectedProject?.name || 'Select Project...'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(20)} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1.2 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Date</Text>
                                        <View style={[styles.fieldValue, { height: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14) }]}>
                                            <MaterialCommunityIcons name="calendar" size={moderateScale(18)} color="#64748B" />
                                            <Text style={[styles.fieldValueText, { fontSize: moderateScale(14) }]}>{date}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 0.8 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Temp (°F)</Text>
                                        <TextInput 
                                            style={[styles.textInput, { height: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]}
                                            value={weather.temperature}
                                            onChangeText={v => setWeather({ ...weather, temperature: v })}
                                            keyboardType="numeric"
                                            placeholder="70"
                                        />
                                    </View>
                                </View>

                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Total Crew</Text>
                                        <TextInput 
                                            style={[styles.textInput, { height: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]}
                                            value={manpowerCount}
                                            onChangeText={setManpowerCount}
                                            keyboardType="numeric"
                                            placeholder="Count"
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Hours/Person</Text>
                                        <TextInput 
                                            style={[styles.textInput, { height: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]}
                                            value={manpowerHrs}
                                            onChangeText={setManpowerHrs}
                                            keyboardType="numeric"
                                            placeholder="Hrs"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { fontSize: moderateScale(11) }]}>Work Done & Notes</Text>
                                    <TextInput 
                                        style={[styles.textArea, { borderRadius: moderateScale(14), padding: scale(14), fontSize: moderateScale(14) }]}
                                        value={workPerformed}
                                        onChangeText={setWorkPerformed}
                                        multiline
                                        numberOfLines={5}
                                        placeholder="Detailed log of activities..."
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>

                                <TouchableOpacity 
                                    style={[styles.submitBtn, submitting && { opacity: 0.7 }, { height: verticalScale(52), borderRadius: moderateScale(14) }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={[styles.submitBtnText, { fontSize: moderateScale(16) }]}>Submit Record</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* PROJECT SELECTION MODAL */}
            <Modal visible={projectModalVisible || filterModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.selectorCard, { borderTopLeftRadius: moderateScale(24), borderTopRightRadius: moderateScale(24), maxWidth: scale(500), alignSelf: 'center', width: '100%' }]}>
                        <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>{filterModalVisible ? 'Filter' : 'Select Project'}</Text>
                            <TouchableOpacity onPress={() => { setProjectModalVisible(false); setFilterModalVisible(false); }}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={filterModalVisible ? [{ _id: null, name: 'All Projects' }, ...projects] : projects}
                            keyExtractor={(item, index) => (item._id || item.id || index.toString())}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={[styles.selectorItem, { paddingVertical: verticalScale(14) }]}
                                    onPress={() => {
                                        if (filterModalVisible) {
                                            setSelectedFilterProject(item._id ? item : null);
                                            setFilterModalVisible(false);
                                        } else {
                                            setSelectedProject(item);
                                            setProjectModalVisible(false);
                                        }
                                    }}
                                >
                                    <Text style={[styles.selectorText, { fontSize: moderateScale(15) }]}>{item.name}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { flex: 1 },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    subtitle: { color: '#64748B', fontWeight: '600', marginTop: 2 },
    actionBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtnText: { color: '#fff', fontWeight: '900' },
    filterArea: { gap: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 8, fontWeight: '600', color: '#1E293B' },
    toolsRow: { flexDirection: 'row', gap: 8 },
    toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10 },
    toolBtnText: { fontWeight: '800', color: '#64748B' },
    tableHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingHorizontal: 4 },
    headerLabel: { fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },
    listContainer: { paddingBottom: 100 },
    tableRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    column: { justifyContent: 'center' },
    cellMainText: { fontWeight: '800', color: '#1E293B' },
    cellSubText: { fontWeight: '600', color: '#94A3B8', marginTop: 2 },
    cellProjectText: { fontWeight: '800', color: '#0F172A' },
    cellWorkText: { fontWeight: '500', color: '#64748B', marginTop: 2 },
    statusChip: { backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
    statusChipText: { fontWeight: '900', color: '#0369A1' },
    weatherMiniTag: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
    weatherMiniText: { fontWeight: '800', color: '#EA580C' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyText: { textAlign: 'center', fontWeight: '700', color: '#94A3B8', marginTop: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', padding: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    closeBtn: { padding: 4 },
    modalBody: { marginBottom: 20 },
    inputGroup: { marginBottom: 16 },
    label: { fontWeight: '900', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    selectBtn: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectBtnText: { fontWeight: '700', color: '#0F172A' },
    row: { flexDirection: 'row', gap: 10 },
    fieldValue: { backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldValueText: { fontWeight: '800', color: '#64748B' },
    textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    textArea: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#334155', textAlignVertical: 'top' },
    submitBtn: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: '#fff', fontWeight: '900' },
    selectorCard: { backgroundColor: '#fff', padding: 24, paddingBottom: 100 },
    selectorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selectorText: { fontWeight: '700', color: '#1E2937' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontWeight: '900', color: '#1E293B', marginTop: 16 },
    emptySubtitle: { fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginTop: 8 },
});

export default DailyLogsScreen;
