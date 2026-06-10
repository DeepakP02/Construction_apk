import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    TextInput,
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    useWindowDimensions,
    Image,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_LOG_PHOTOS = 5;

const resolveLogPhotoUri = (photo) => {
    if (photo == null) return '';
    const raw = typeof photo === 'string' ? photo : photo?.url || photo?.secure_url || photo?.path || '';
    if (!raw) return '';
    const resolved = getServerUrl(raw);
    return resolved || raw;
};

const DailyLogsScreen = ({ navigation }) => {
    const { user, projects, refreshData, selectedProject: globalSelectedProject } = useApp();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isCompact = width < 380;
    const modalSheetMaxWidth = Math.min(width - 16, 560);
    const modalSheetMaxHeight = Math.min(height * 0.9, 760);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilterProject, setSelectedFilterProject] = useState(null);
    
    const getLocalDateString = () => {
        const d = new Date();
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    };

    const canViewLogs = ['SUPER_ADMIN', 'COMPANY_OWNER', 'PM', 'FOREMAN', 'SUBCONTRACTOR', 'WORKER'].includes(user?.role);
    const canCreateLog = ['SUPER_ADMIN', 'COMPANY_OWNER', 'PM', 'FOREMAN', 'WORKER'].includes(user?.role);

    // Form States
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [date, setDate] = useState(getLocalDateString());
    const [manpowerCount, setManpowerCount] = useState('1');
    const [manpowerHrs, setManpowerHrs] = useState('8');
    const [workPerformed, setWorkPerformed] = useState('');
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [logPhotoUris, setLogPhotoUris] = useState([]);
    const [detailLog, setDetailLog] = useState(null);
    const [photoPreviewUri, setPhotoPreviewUri] = useState(null);

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

    useEffect(() => {
        const id = detailLog?._id;
        if (!id || !logs.length) return;
        const fresh = logs.find((l) => String(l._id) === String(id));
        if (fresh) setDetailLog(fresh);
    }, [logs, detailLog?._id]);

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

    const pickLogPhotos = async () => {
        if (logPhotoUris.length >= MAX_LOG_PHOTOS) {
            Alert.alert('Photo limit', `You can attach up to ${MAX_LOG_PHOTOS} photos per log.`);
            return;
        }
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow photo library access to attach site photos.');
                return;
            }
            const remaining = MAX_LOG_PHOTOS - logPhotoUris.length;
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.75,
                allowsMultipleSelection: true,
                selectionLimit: remaining,
            });
            if (result.canceled || !result.assets?.length) return;
            const newUris = result.assets.map((a) => a.uri).slice(0, remaining);
            setLogPhotoUris((prev) => [...prev, ...newUris].slice(0, MAX_LOG_PHOTOS));
        } catch (e) {
            Alert.alert('Error', 'Could not open photo library.');
        }
    };

    const removeLogPhoto = (index) => {
        setLogPhotoUris((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedProject || !workPerformed.trim()) {
            Alert.alert('Required Fields', 'Please select a project and describe the work performed.');
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('projectId', String(selectedProject._id || selectedProject.id));
            formData.append('date', date);
            formData.append('workPerformed', workPerformed.trim());
            formData.append(
                'manpower',
                JSON.stringify([
                    {
                        role: 'General',
                        count: parseInt(manpowerCount, 10) || 0,
                        hours: parseFloat(manpowerHrs) || 0,
                    },
                ])
            );

            // Fetch and append GPS location automatically
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ 
                        accuracy: Location.Accuracy.Balanced,
                        timeout: 3000 
                    });
                    if (loc && loc.coords) {
                        formData.append('location', JSON.stringify({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            address: 'Captured from Mobile GPS'
                        }));
                    }
                }
            } catch (locErr) {
                console.warn('Auto location capture for daily log failed:', locErr.message);
            }

            // Append photos with cross-platform URI structures
            logPhotoUris.forEach((uri, idx) => {
                const filename = uri.split('/').pop() || `photo_${idx}.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const fileType = match ? `image/${match[1]}` : `image/jpeg`;
                const cleanUri = uri;
                formData.append('photos', {
                    uri: cleanUri,
                    name: filename,
                    type: fileType,
                });
            });

            await uploadMultipart('/dailylogs', formData);
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
        setDate(getLocalDateString());
        setLogPhotoUris([]);
    };

    const filteredLogs = logs.filter((log) => {
        const matchesSearch =
            log.workPerformed?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.projectId?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const logPid = log.projectId?._id || log.projectId;
        const selPid = selectedFilterProject?._id || selectedFilterProject?.id;
        const matchesProject = !selectedFilterProject || String(logPid) === String(selPid);
        const isWorker = user?.role === 'WORKER';
        const matchesOwner = !isWorker || (log.reportedBy && String(log.reportedBy._id) === String(user._id));
        return matchesSearch && matchesProject && matchesOwner;
    });

    const closeDetailLog = () => {
        setDetailLog(null);
        setPhotoPreviewUri(null);
    };

    const detailPhotoUris = useMemo(() => {
        if (!detailLog?.photos?.length) return [];
        return detailLog.photos.map(resolveLogPhotoUri).filter(Boolean);
    }, [detailLog]);

    const detailProjectName = useMemo(() => {
        if (!detailLog) return 'Site log';
        if (detailLog.projectId?.name) return detailLog.projectId.name;
        const pid = detailLog.projectId?._id || detailLog.projectId;
        if (!pid || !projects?.length) return 'Site log';
        const p = projects.find((x) => String(x._id || x.id) === String(pid));
        return p?.name || 'Site log';
    }, [detailLog, projects]);

    const renderLogItem = ({ item }) => {
        const totalManpower = item.manpower?.reduce((acc, m) => acc + (m.count || 0), 0) || 0;
        const logDate = new Date(item.date);
        const photoCount = Array.isArray(item.photos) ? item.photos.length : 0;

        return (
            <TouchableOpacity 
                style={[styles.tableRow, { paddingVertical: verticalScale(14) }]} 
                activeOpacity={0.7}
                onPress={() => setDetailLog(item)}
            >
                {/* Column: Date & Reporter */}
                <View style={[styles.column, { width: scale(70) }]}>
                    <Text style={[styles.cellMainText, { fontSize: moderateScale(13) }]}>{logDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</Text>
                    <Text style={[styles.cellSubText, { fontSize: moderateScale(11) }]} numberOfLines={1}>{item.reportedBy?.fullName?.split(' ')[0] || '—'}</Text>
                </View>

                {/* Column: Project & Work Snippet */}
                <View style={[styles.column, { flex: 1, paddingHorizontal: scale(4) }]}>
                    <Text style={[styles.cellProjectText, { fontSize: moderateScale(13) }]} numberOfLines={1}>{item.projectId?.name || 'Unassigned'}</Text>
                    <Text style={[styles.cellWorkText, { fontSize: moderateScale(11) }]} numberOfLines={1}>{item.workPerformed}</Text>
                </View>

                {/* Column: Stats */}
                <View style={[styles.column, { width: scale(isCompact ? 56 : 65), alignItems: 'flex-end' }]}>
                    <View style={[styles.statusChip, { paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: moderateScale(6) }]}>
                        <Text style={[styles.statusChipText, { fontSize: moderateScale(10) }]}>{totalManpower} Men</Text>
                    </View>
                    {photoCount > 0 && (
                        <View style={[styles.photoCountRow, { marginTop: verticalScale(4) }]}>
                            <MaterialCommunityIcons name="image-multiple-outline" size={moderateScale(12)} color="#6366F1" />
                            <Text style={[styles.photoCountText, { fontSize: moderateScale(9) }]}>{photoCount}</Text>
                        </View>
                    )}
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
            <Text style={[styles.headerLabel, { width: scale(isCompact ? 56 : 65), textAlign: 'right', fontSize: moderateScale(10) }]}>STATS</Text>
            <View style={{ width: scale(16), marginLeft: scale(4) }} />
        </View>
    );

    if (!canViewLogs) {
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
                    {canCreateLog && (
                        <TouchableOpacity style={[styles.actionBtn, { paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderRadius: moderateScale(12) }]} onPress={() => setModalVisible(true)}>
                            <MaterialCommunityIcons name="plus" size={moderateScale(18)} color="#fff" />
                            <Text style={[styles.actionBtnText, { fontSize: moderateScale(12) }]}>New Log</Text>
                        </TouchableOpacity>
                    )}
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
                            style={[styles.toolBtn, { minHeight: verticalScale(44), borderRadius: moderateScale(12) }]}
                            onPress={() => setFilterModalVisible(true)}
                        >
                            <MaterialCommunityIcons name="filter-variant" size={moderateScale(16)} color="#64748B" style={{marginRight: scale(6)}} />
                            <Text style={[styles.toolBtnText, { fontSize: moderateScale(12) }]} numberOfLines={1}>{selectedFilterProject?.name || 'All Projects'}</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={[styles.toolBtn, { minHeight: verticalScale(44), borderRadius: moderateScale(12) }]}>
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

            {/* LOG DETAIL (tap row) */}
            <Modal visible={!!detailLog} transparent animationType="slide" onRequestClose={closeDetailLog}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeDetailLog} />
                    <View
                        style={[
                            styles.modalSheet,
                            {
                                borderTopLeftRadius: moderateScale(32),
                                borderTopRightRadius: moderateScale(32),
                                maxWidth: modalSheetMaxWidth,
                                width: '100%',
                                alignSelf: 'center',
                                height: '90%',
                                paddingBottom: insets.bottom + 20,
                            },
                        ]}
                    >
                        <View style={styles.modalHandle} />
                        <View style={[styles.modalHeader, { paddingHorizontal: scale(20), paddingTop: verticalScale(4), paddingBottom: verticalScale(12) }]}>
                            <View style={{ flex: 1, paddingRight: scale(8) }}>
                                <Text style={[styles.modalTitle, { fontSize: moderateScale(isCompact ? 20 : 22) }]} numberOfLines={2}>
                                    {detailProjectName}
                                </Text>
                                <Text style={[styles.modalSubtitle, { fontSize: moderateScale(12), marginTop: verticalScale(4) }]}>Site log details</Text>
                            </View>
                            <TouchableOpacity
                                onPress={closeDetailLog}
                                style={[styles.closeModalBtn, { width: scale(36), height: scale(36), borderRadius: 18 }]}
                                hitSlop={12}
                            >
                                <MaterialCommunityIcons name="close" size={moderateScale(22)} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{
                                paddingHorizontal: scale(20),
                                paddingBottom: verticalScale(28) + insets.bottom,
                            }}
                        >
                            {detailLog && (
                                <>
                                    <View style={styles.detailMetaBlock}>
                                        <View style={styles.detailMetaRow}>
                                            <MaterialCommunityIcons name="calendar" size={moderateScale(18)} color="#64748B" />
                                            <Text style={[styles.detailMetaText, { fontSize: moderateScale(14) }]}>
                                                {new Date(detailLog.date).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </Text>
                                        </View>
                                        <View style={[styles.detailMetaRow, { marginTop: verticalScale(8) }]}>
                                            <MaterialCommunityIcons name="account-outline" size={moderateScale(18)} color="#64748B" />
                                            <Text style={[styles.detailMetaText, { fontSize: moderateScale(14) }]}>
                                                {detailLog.reportedBy?.fullName || 'Unknown'}
                                                {detailLog.reportedBy?.role ? ` · ${detailLog.reportedBy.role}` : ''}
                                            </Text>
                                        </View>
                                        {detailLog.isVerified ? (
                                            <View style={[styles.verifiedPill, { marginTop: verticalScale(12), alignSelf: 'flex-start', paddingHorizontal: scale(10), paddingVertical: verticalScale(6), borderRadius: moderateScale(8) }]}>
                                                <MaterialCommunityIcons name="check-decagram" size={moderateScale(16)} color="#059669" />
                                                <Text style={[styles.verifiedPillText, { fontSize: moderateScale(12), marginLeft: scale(6) }]}>Verified</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {detailLog.weather?.status ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(16) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Weather</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(15) }]}>{detailLog.weather.status}</Text>
                                        </View>
                                    ) : null}

                                    {Array.isArray(detailLog.manpower) && detailLog.manpower.length > 0 ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(16) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(8) }]}>Manpower</Text>
                                            {detailLog.manpower.map((m, i) => (
                                                <View key={i} style={[styles.manpowerRow, { paddingVertical: verticalScale(8), paddingHorizontal: scale(12), borderRadius: moderateScale(10), marginBottom: verticalScale(6) }]}>
                                                    <Text style={[styles.manpowerRole, { fontSize: moderateScale(14) }]}>{m.role || 'General'}</Text>
                                                    <Text style={[styles.manpowerNums, { fontSize: moderateScale(13) }]}>
                                                        {m.count ?? 0} crew · {m.hours ?? 0} h each
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    <View style={[styles.detailSection, { marginTop: verticalScale(16) }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(8) }]}>Work performed</Text>
                                        <Text style={[styles.detailBody, { fontSize: moderateScale(15), lineHeight: moderateScale(22) }]}>
                                            {detailLog.workPerformed || '—'}
                                        </Text>
                                    </View>

                                    <View style={[styles.detailSection, { marginTop: verticalScale(18) }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(10) }]}>
                                            Site photos{detailPhotoUris.length ? ` (${detailPhotoUris.length})` : ''}
                                        </Text>
                                        {detailPhotoUris.length > 0 ? (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailPhotoRow}>
                                                {detailPhotoUris.map((uri, idx) => (
                                                    <TouchableOpacity
                                                        key={`${uri}-${idx}`}
                                                        activeOpacity={0.85}
                                                        onPress={() => setPhotoPreviewUri(uri)}
                                                        style={[styles.detailPhotoThumb, { width: scale(108), height: scale(108), borderRadius: moderateScale(14), marginRight: scale(10) }]}
                                                    >
                                                        <Image source={{ uri }} style={[styles.photoThumb, { borderRadius: moderateScale(14) }]} resizeMode="cover" />
                                                        <View style={styles.detailPhotoZoomHint}>
                                                            <MaterialCommunityIcons name="magnify-plus-outline" size={moderateScale(18)} color="#fff" />
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        ) : (
                                            <View style={[styles.detailNoPhotos, { paddingVertical: verticalScale(16), borderRadius: moderateScale(12) }]}>
                                                <MaterialCommunityIcons name="image-off-outline" size={moderateScale(28)} color="#94A3B8" />
                                                <Text style={[styles.detailNoPhotosText, { fontSize: moderateScale(13), marginTop: verticalScale(6) }]}>No photos attached</Text>
                                            </View>
                                        )}
                                    </View>

                                    {detailLog.materialsReceived?.length ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Materials received</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{detailLog.materialsReceived.join(' · ')}</Text>
                                        </View>
                                    ) : null}
                                    {detailLog.equipmentUsed?.length ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Equipment used</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{detailLog.equipmentUsed.join(' · ')}</Text>
                                        </View>
                                    ) : null}
                                    {detailLog.safetyObservations ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Safety</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{detailLog.safetyObservations}</Text>
                                        </View>
                                    ) : null}
                                    {detailLog.delays ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Delays</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{detailLog.delays}</Text>
                                        </View>
                                    ) : null}
                                    {detailLog.visitors?.length ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Visitors</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{detailLog.visitors.join(' · ')}</Text>
                                        </View>
                                    ) : null}
                                    {detailLog.location?.address ? (
                                        <View style={[styles.detailSection, { marginTop: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(6) }]}>Location</Text>
                                            <Text style={[styles.detailBody, { fontSize: moderateScale(14) }]}>{(typeof detailLog.location === 'object' ? detailLog.location?.address : detailLog.location) || ''}</Text>
                                        </View>
                                    ) : null}

                                    {detailLog.createdAt ? (
                                        <Text style={[styles.detailFooterMeta, { fontSize: moderateScale(11), marginTop: verticalScale(22) }]}>
                                            Logged {new Date(detailLog.createdAt).toLocaleString()}
                                        </Text>
                                    ) : null}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!photoPreviewUri} transparent animationType="fade" onRequestClose={() => setPhotoPreviewUri(null)}>
                <View style={styles.photoPreviewRoot}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setPhotoPreviewUri(null)} />
                    <TouchableOpacity style={[styles.photoPreviewClose, { top: verticalScale(52), right: scale(20) }]} onPress={() => setPhotoPreviewUri(null)} hitSlop={16}>
                        <MaterialCommunityIcons name="close" size={moderateScale(30)} color="#fff" />
                    </TouchableOpacity>
                    {photoPreviewUri ? (
                        <View style={styles.photoPreviewContent} pointerEvents="box-none">
                            <Image source={{ uri: photoPreviewUri }} style={styles.photoPreviewImage} resizeMode="contain" />
                        </View>
                    ) : null}
                </View>
            </Modal>

            {/* NEW LOG MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => !submitting && setModalVisible(false)} />
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <View
                            style={[
                                styles.modalSheet,
                                {
                                    borderTopLeftRadius: moderateScale(32),
                                    borderTopRightRadius: moderateScale(32),
                                    maxWidth: modalSheetMaxWidth,
                                    width: '100%',
                                    alignSelf: 'center',
                                    height: '90%',
                                    maxHeight: modalSheetMaxHeight,
                                    paddingBottom: insets.bottom + 20,
                                },
                            ]}
                        >
                            <View style={styles.modalHandle} />
                            <View style={[styles.modalHeader, { paddingHorizontal: scale(20), paddingTop: verticalScale(4), marginBottom: verticalScale(8) }]}>
                                <Text style={[styles.modalTitle, { fontSize: moderateScale(isCompact ? 20 : 22), flex: 1, paddingRight: scale(8) }]}>Daily Site Record</Text>
                                <TouchableOpacity onPress={() => !submitting && setModalVisible(false)} style={styles.closeBtn} hitSlop={12}>
                                    <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                                contentContainerStyle={{
                                    paddingHorizontal: scale(20),
                                    paddingBottom: verticalScale(30),
                                }}
                            >
                                <View style={[styles.inputGroup, { marginBottom: verticalScale(14) }]}>
                                    <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Project</Text>
                                    <TouchableOpacity
                                        style={[styles.selectBtn, { minHeight: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14) }]}
                                        onPress={() => setProjectModalVisible(true)}
                                    >
                                        <Text
                                            style={[styles.selectBtnText, !selectedProject && { color: '#94A3B8' }, { fontSize: moderateScale(14), flex: 1 }]}
                                            numberOfLines={2}
                                        >
                                            {selectedProject?.name || 'Select project…'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(20)} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.inputGroup, { marginBottom: verticalScale(14) }]}>
                                    <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Date</Text>
                                    <View style={[styles.fieldValue, { minHeight: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), paddingVertical: verticalScale(10) }]}>
                                        <MaterialCommunityIcons name="calendar" size={moderateScale(18)} color="#64748B" />
                                        <Text style={[styles.fieldValueText, { fontSize: moderateScale(14), flex: 1 }]}>{date}</Text>
                                    </View>
                                </View>

                                <View style={[styles.row, { marginBottom: verticalScale(14), gap: scale(isCompact ? 8 : 10) }]}>
                                    <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Total crew</Text>
                                        <TextInput
                                            style={[styles.textInput, { minHeight: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]}
                                            value={manpowerCount}
                                            onChangeText={setManpowerCount}
                                            keyboardType="numeric"
                                            placeholder="Count"
                                            placeholderTextColor="#94A3B8"
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                                        <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Hours / person</Text>
                                        <TextInput
                                            style={[styles.textInput, { minHeight: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14), fontSize: moderateScale(14) }]}
                                            value={manpowerHrs}
                                            onChangeText={setManpowerHrs}
                                            keyboardType="numeric"
                                            placeholder="Hrs"
                                            placeholderTextColor="#94A3B8"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.inputGroup, { marginBottom: verticalScale(14) }]}>
                                    <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Site photos (optional, max {MAX_LOG_PHOTOS})</Text>
                                    <Text style={[styles.hintText, { fontSize: moderateScale(11), marginBottom: verticalScale(8) }]}>
                                        Same as web: attach progress photos with this log.
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScrollContent}>
                                        {logPhotoUris.map((uri, idx) => (
                                            <View key={`${uri}-${idx}`} style={[styles.photoThumbWrap, { width: scale(72), height: scale(72), borderRadius: moderateScale(12), marginRight: scale(10) }]}>
                                                <Image source={{ uri }} style={[styles.photoThumb, { borderRadius: moderateScale(12) }]} />
                                                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeLogPhoto(idx)} hitSlop={8}>
                                                    <MaterialCommunityIcons name="close-circle" size={moderateScale(22)} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        {logPhotoUris.length < MAX_LOG_PHOTOS && (
                                            <TouchableOpacity
                                                style={[styles.addPhotoCard, { width: scale(72), height: scale(72), borderRadius: moderateScale(12) }]}
                                                onPress={pickLogPhotos}
                                                activeOpacity={0.85}
                                            >
                                                <MaterialCommunityIcons name="camera-plus-outline" size={moderateScale(28)} color="#6366F1" />
                                                <Text style={[styles.addPhotoLabel, { fontSize: moderateScale(10) }]}>Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </ScrollView>
                                </View>

                                <View style={[styles.inputGroup, { marginBottom: verticalScale(16) }]}>
                                    <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Work done & notes</Text>
                                    <TextInput
                                        style={[styles.textArea, { borderRadius: moderateScale(14), padding: scale(14), fontSize: moderateScale(14), minHeight: verticalScale(isCompact ? 100 : 120) }]}
                                        value={workPerformed}
                                        onChangeText={setWorkPerformed}
                                        multiline
                                        numberOfLines={5}
                                        placeholder="Detailed log of activities…"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.7 }, { minHeight: verticalScale(52), borderRadius: moderateScale(14) }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={[styles.submitBtnText, { fontSize: moderateScale(16) }]}>Submit record</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* PROJECT SELECTION MODAL */}
            <Modal visible={projectModalVisible || filterModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.selectorCard, { borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), maxWidth: scale(500), alignSelf: 'center', width: '100%', paddingBottom: insets.bottom + 24 }]}>
                        <View style={styles.modalHandle} />
                        <View style={[styles.modalHeader, { paddingHorizontal: scale(20), marginBottom: verticalScale(16), marginTop: verticalScale(4) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>{filterModalVisible ? 'Filter' : 'Select Project'}</Text>
                            <TouchableOpacity onPress={() => { setProjectModalVisible(false); setFilterModalVisible(false); }} style={styles.closeBtn}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={filterModalVisible ? [{ _id: null, name: 'All Projects' }, ...(projects || [])] : (projects || [])}
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
    toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, minHeight: verticalScale(44) },
    toolBtnText: { fontWeight: '800', color: '#64748B', fontSize: moderateScale(12) },
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
    photoCountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    photoCountText: { fontWeight: '800', color: '#6366F1' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyText: { textAlign: 'center', fontWeight: '700', color: '#94A3B8', marginTop: 16 },
    detailMetaBlock: { paddingTop: verticalScale(4) },
    detailMetaRow: { flexDirection: 'row', alignItems: 'center' },
    detailMetaText: { marginLeft: scale(10), fontWeight: '700', color: '#334155', flex: 1 },
    verifiedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
    verifiedPillText: { fontWeight: '800', color: '#047857' },
    detailSection: {},
    detailBody: { fontWeight: '600', color: '#475569' },
    detailFooterMeta: { fontWeight: '600', color: '#94A3B8' },
    manpowerRow: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    manpowerRole: { fontWeight: '800', color: '#0F172A' },
    manpowerNums: { fontWeight: '600', color: '#64748B', marginTop: 2 },
    detailPhotoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    detailPhotoThumb: { overflow: 'hidden', backgroundColor: '#E2E8F0' },
    detailPhotoZoomHint: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 4 },
    detailNoPhotos: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
    detailNoPhotosText: { fontWeight: '600', color: '#94A3B8' },
    photoPreviewRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
    photoPreviewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    photoPreviewImage: { width: '100%', height: '72%' },
    photoPreviewClose: { position: 'absolute', zIndex: 100 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#fff',
        width: '100%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, alignSelf: 'center', marginVertical: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { fontWeight: '600', color: '#64748B' },
    closeBtn: { padding: 4 },
    closeModalBtn: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
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
    hintText: { color: '#94A3B8', fontWeight: '600' },
    photoScrollContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
    photoThumbWrap: { overflow: 'hidden', backgroundColor: '#E2E8F0' },
    photoThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoRemoveBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12 },
    addPhotoCard: { borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed', backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    addPhotoLabel: { fontWeight: '800', color: '#6366F1', marginTop: 2 },
    selectorCard: { backgroundColor: '#fff', padding: 24, paddingBottom: 100 },
    selectorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selectorText: { fontWeight: '700', color: '#1E2937' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontWeight: '900', color: '#1E293B', marginTop: 16 },
    emptySubtitle: { fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginTop: 8 },
});

export default DailyLogsScreen;
