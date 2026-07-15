import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_PROJECTS } from '../../mock/data';

const MAX_LOG_PHOTOS = 5;

const resolveLogPhotoUri = (photo) => {
    if (photo == null) return '';
    const raw = typeof photo === 'string' ? photo : photo?.url || photo?.secure_url || photo?.path || '';
    if (!raw) return '';
    const resolved = getServerUrl(raw);
    return resolved || raw;
};

const formatSafeDate = (dateString, options = { day: '2-digit', month: 'short' }) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    try {
        return d.toLocaleDateString('en-US', options);
    } catch (e) {
        return d.toDateString();
    }
};

const DailyLogsScreen = ({ navigation }) => {
    const { user, projects, refreshData, refreshProjects, selectedProject: globalSelectedProject } = useApp();
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
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [logPhotoUris, setLogPhotoUris] = useState([]);
    const [detailLog, setDetailLog] = useState(null);
    const [photoPreviewUri, setPhotoPreviewUri] = useState(null);
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [isSelectingForNewLog, setIsSelectingForNewLog] = useState(false);

    const detailLogIdRef = useRef(null);

    const fetchLogs = useCallback(async () => {
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
    }, []);

    const openProjectSelector = useCallback(() => {
        // Use the existing filter modal for project selection
        setFilterModalVisible(true);
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Keep detailLog in sync when logs refresh — use a ref to avoid re-render loop
    useEffect(() => {
        const id = detailLogIdRef.current;
        if (!id || !logs.length) return;
        const fresh = logs.find((l) => String(l._id) === String(id));
        if (fresh) setDetailLog(fresh);
    }, [logs]);

    // Track the current detail log id in a ref (no re-render)
    useEffect(() => {
        detailLogIdRef.current = detailLog?._id || null;
    }, [detailLog]);

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

    // Sync local projects with context projects
    useEffect(() => {
        if (projects && projects.length > 0) {
            console.log('[DailyLogsScreen] Projects available from context:', projects.length);
        }
    }, [projects]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLogs();
        refreshData();
    }, [fetchLogs, refreshData]);

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

    const takePhotoWithCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow camera access to take site photos.');
                return;
            }
            const remaining = MAX_LOG_PHOTOS - logPhotoUris.length;
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.75,
            });
            if (result.canceled || !result.assets?.length) return;
            const newUris = result.assets.map((a) => a.uri).slice(0, remaining);
            setLogPhotoUris((prev) => [...prev, ...newUris].slice(0, MAX_LOG_PHOTOS));
        } catch (e) {
            Alert.alert('Error', 'Could not open camera.');
        }
    };

    const handleAddPhotos = () => {
        if (logPhotoUris.length >= MAX_LOG_PHOTOS) {
            Alert.alert('Photo limit', `You can attach up to ${MAX_LOG_PHOTOS} photos per log.`);
            return;
        }

        Alert.alert(
            'Add Site Photo',
            'Select how you want to add a photo:',
            [
                { text: 'Take Photo', onPress: takePhotoWithCamera },
                { text: 'Choose from Library', onPress: pickLogPhotos },
                { text: 'Cancel', style: 'cancel' }
            ],
            { cancelable: true }
        );
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

            // Fetch and append GPS location automatically with a hard timeout
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const locationTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Location timeout')), 5000)
                    );
                    const loc = await Promise.race([
                        Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        }),
                        locationTimeout,
                    ]);
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

    const filteredLogs = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const selPid = selectedFilterProject?._id || selectedFilterProject?.id;
        const isWorker = user?.role === 'WORKER';
        const userId = user?._id;

        return logs.filter((log) => {
            const matchesSearch = !query ||
                (log.workPerformed && log.workPerformed.toLowerCase().includes(query)) ||
                (log.projectId?.name && log.projectId.name.toLowerCase().includes(query));
            const logPid = log.projectId?._id || log.projectId;
            const matchesProject = !selectedFilterProject || String(logPid) === String(selPid);
            const matchesOwner = !isWorker || (log.reportedBy && String(log.reportedBy._id) === String(userId));
            return matchesSearch && matchesProject && matchesOwner;
        });
    }, [logs, searchQuery, selectedFilterProject, user?.role, user?._id]);

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

    const renderLogItem = useCallback(({ item }) => {
        const totalManpower = item.manpower?.reduce((acc, m) => acc + (m.count || 0), 0) || 0;
        const photoCount = Array.isArray(item.photos) ? item.photos.length : 0;

        return (
            <TouchableOpacity 
                style={[styles.tableRow, { paddingVertical: verticalScale(14) }]} 
                activeOpacity={0.7}
                onPress={() => setDetailLog(item)}
            >
                {/* Column: Date & Reporter */}
                <View style={[styles.column, { width: scale(70) }]}>
                    <Text style={[styles.cellMainText, { fontSize: moderateScale(13) }]}>{formatSafeDate(item.date, { day: '2-digit', month: 'short' })}</Text>
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
    }, [isCompact]);

    const TableHeader = useMemo(() => (
        <View style={[styles.tableHeader, { paddingVertical: verticalScale(10) }]}>
            <Text style={[styles.headerLabel, { width: scale(70), fontSize: moderateScale(10) }]}>DATE/BY</Text>
            <Text style={[styles.headerLabel, { flex: 1, paddingHorizontal: scale(4), fontSize: moderateScale(10) }]}>PROJECT & ACTIVITY</Text>
            <Text style={[styles.headerLabel, { width: scale(isCompact ? 56 : 65), textAlign: 'right', fontSize: moderateScale(10) }]}>STATS</Text>
            <View style={{ width: scale(16), marginLeft: scale(4) }} />
        </View>
    ), [isCompact]);

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
                        <TouchableOpacity 
                            style={[styles.actionBtn, { paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderRadius: moderateScale(12) }]} 
                            onPress={async () => {
                                setModalVisible(true);
                                try {
                                    await refreshProjects();
                                } catch (e) {
                                    console.error('Failed to refresh projects for new log:', e);
                                }
                            }}
                        >
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
                            onPress={async () => {
                                // Refresh projects before opening filter
                                try {
                                    await refreshProjects();
                                } catch (e) {
                                    console.error('Failed to refresh projects for filter:', e);
                                }
                                setFilterModalVisible(true);
                            }}
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

                {TableHeader}

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
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={7}
                        removeClippedSubviews={Platform.OS !== 'web'}
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
                        {photoPreviewUri ? (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 1000, justifyContent: 'center', borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), overflow: 'hidden' }]}>
                                <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setPhotoPreviewUri(null)} />
                                <TouchableOpacity 
                                    style={{ position: 'absolute', top: verticalScale(20), right: scale(20), zIndex: 1001, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: SIZES.radiusCard }} 
                                    onPress={() => setPhotoPreviewUri(null)} 
                                    hitSlop={16}
                                >
                                    <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#fff" />
                                </TouchableOpacity>
                                <Image source={{ uri: photoPreviewUri }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
                            </View>
                        ) : null}
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
                                                {formatSafeDate(detailLog.date, {
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



            {/* NEW LOG MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1} 
                        onPress={() => !submitting && setModalVisible(false)}
                    >
                        <TouchableWithoutFeedback>
                            <View
                                style={[
                                    styles.modalSheet,
                                    {
                                        borderTopLeftRadius: moderateScale(32),
                                        borderTopRightRadius: moderateScale(32),
                                        maxWidth: modalSheetMaxWidth,
                                        width: '100%',
                                        alignSelf: 'center',
                                        flex: 1,
                                        maxHeight: modalSheetMaxHeight,
                                        paddingBottom: insets.bottom + 20,
                                    },
                                ]}
                            >
                                <View style={styles.modalHandle} />
                                <View style={[styles.modalHeader, { paddingHorizontal: scale(20), paddingTop: verticalScale(4), marginBottom: verticalScale(8) }]}>
                                    <Text style={[styles.modalTitle, { fontSize: moderateScale(isCompact ? 20 : 22), flex: 1, paddingRight: scale(8) }]}>
                                        {projectDropdownOpen ? 'Select Project' : 'Daily Site Record'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (projectDropdownOpen) {
                                                setProjectDropdownOpen(false);
                                                setProjectSearchQuery('');
                                            } else {
                                                if (!submitting) setModalVisible(false);
                                            }
                                        }}
                                        style={styles.closeBtn}
                                        hitSlop={12}
                                    >
                                        <MaterialCommunityIcons
                                            name={projectDropdownOpen ? 'arrow-left' : 'close'}
                                            size={moderateScale(24)}
                                            color="#0F172A"
                                        />
                                    </TouchableOpacity>
                                </View>

                                {projectDropdownOpen ? (
                                    <View style={{ flex: 1 }}>
                                        <View style={[styles.selectorSearchWrap, { marginHorizontal: scale(20), marginBottom: verticalScale(10) }]}>
                                            <View style={[styles.selectorSearchBar, { height: verticalScale(42), borderRadius: moderateScale(12), paddingHorizontal: scale(12) }]}>
                                                <MaterialCommunityIcons name="magnify" size={moderateScale(18)} color="#94A3B8" />
                                                <TextInput
                                                    style={[styles.selectorSearchInput, { fontSize: moderateScale(14) }]}
                                                    placeholder="Search projects…"
                                                    placeholderTextColor="#94A3B8"
                                                    value={projectSearchQuery}
                                                    onChangeText={setProjectSearchQuery}
                                                    autoCorrect={false}
                                                />
                                                {projectSearchQuery.length > 0 && (
                                                    <TouchableOpacity onPress={() => setProjectSearchQuery('')} hitSlop={8} style={{ padding: scale(4) }}>
                                                        <MaterialCommunityIcons name="close-circle" size={moderateScale(16)} color="#94A3B8" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>

                                        <FlatList
                                            data={(() => {
                                                const source = projects || [];
                                                if (!projectSearchQuery.trim()) return source;
                                                return source.filter(p => p.name && p.name.toLowerCase().includes(projectSearchQuery.trim().toLowerCase()));
                                            })()}
                                            keyExtractor={(item) => String(item._id || item.id || Math.random())}
                                            contentContainerStyle={{ paddingHorizontal: scale(20), paddingBottom: verticalScale(40) }}
                                            showsVerticalScrollIndicator={false}
                                            keyboardShouldPersistTaps="handled"
                                            renderItem={({ item }) => {
                                                const itemId = String(item._id || item.id || '');
                                                const isSelected = String(selectedProject?._id || selectedProject?.id || '') === itemId;
                                                return (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.inlineDropdownItem,
                                                            { paddingVertical: verticalScale(14), paddingHorizontal: scale(10), borderRadius: moderateScale(12), marginBottom: verticalScale(6) },
                                                            isSelected && styles.inlineDropdownItemActive,
                                                        ]}
                                                        activeOpacity={0.6}
                                                        onPress={() => {
                                                            setSelectedProject(item);
                                                            setProjectDropdownOpen(false);
                                                            setProjectSearchQuery('');
                                                        }}
                                                    >
                                                        <View style={[
                                                            styles.selectorIcon,
                                                            { width: scale(36), height: scale(36), borderRadius: moderateScale(10), marginRight: scale(12) },
                                                        ]}>
                                                            <MaterialCommunityIcons name="office-building" size={moderateScale(18)} color="#2563EB" />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.selectorText, { fontSize: moderateScale(15) }]} numberOfLines={2}>
                                                                {item.name}
                                                            </Text>
                                                        </View>
                                                        {isSelected ? (
                                                            <MaterialCommunityIcons name="check-circle" size={moderateScale(22)} color="#2563EB" />
                                                        ) : (
                                                            <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#CBD5E1" />
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            ListEmptyComponent={
                                                <View style={{ alignItems: 'center', paddingVertical: verticalScale(40) }}>
                                                    <MaterialCommunityIcons name="folder-search-outline" size={moderateScale(40)} color="#CBD5E1" />
                                                    <Text style={[styles.emptyText, { fontSize: moderateScale(14), marginTop: verticalScale(12) }]}>
                                                        {projectSearchQuery ? 'No matching projects' : 'No projects available'}
                                                    </Text>
                                                </View>
                                            }
                                        />
                                    </View>
                                ) : (
                                    <ScrollView
                                        style={{ flex: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                        keyboardDismissMode="on-drag"
                                        automaticallyAdjustKeyboardInsets={false}
                                        contentContainerStyle={{
                                            paddingHorizontal: scale(20),
                                            paddingBottom: verticalScale(30),
                                        }}
                                    >
                                        <View style={[styles.inputGroup, { marginBottom: verticalScale(14) }]}>
                                            <Text style={[styles.label, { fontSize: moderateScale(10) }]}>Project</Text>
                                            <TouchableOpacity
                                                style={[styles.selectBtn, { minHeight: verticalScale(48), borderRadius: moderateScale(12), paddingHorizontal: scale(14) }]}
                                                onPress={() => setProjectDropdownOpen(true)}
                                            >
                                                <Text
                                                    style={[styles.selectBtnText, !selectedProject && { color: COLORS.textMuted }, { fontSize: moderateScale(14), flex: 1 }]}
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
                                                        onPress={handleAddPhotos}
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
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>



            {/* FILTER PROJECT SELECTION MODAL (only for filter — not nested in another modal) */}
            <Modal
                visible={filterModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => { setFilterModalVisible(false); }}
            >
                <TouchableWithoutFeedback onPress={() => { setFilterModalVisible(false); }}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <View style={[
                                styles.selectorCard,
                                {
                                    borderTopLeftRadius: moderateScale(32),
                                    borderTopRightRadius: moderateScale(32),
                                    maxWidth: scale(500),
                                    alignSelf: 'center',
                                    width: '100%',
                                    maxHeight: height * 0.65,
                                    paddingBottom: insets.bottom + 24,
                                },
                            ]}>
                                <View style={styles.modalHandle} />
                                <View style={[styles.modalHeader, { paddingHorizontal: scale(20), marginBottom: verticalScale(8), marginTop: verticalScale(4) }]}>
                                    <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>
                                        {filterModalVisible ? 'Filter by Project' : 'Select Project'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => { setFilterModalVisible(false); }}
                                        style={styles.closeBtn}
                                        hitSlop={12}
                                    >
                                        <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                {/* Project search within modal */}
                                <View style={[styles.selectorSearchWrap, { marginHorizontal: scale(20), marginBottom: verticalScale(10) }]}>
                                    <View style={[styles.selectorSearchBar, { height: verticalScale(42), borderRadius: moderateScale(12), paddingHorizontal: scale(12) }]}>
                                        <MaterialCommunityIcons name="magnify" size={moderateScale(18)} color="#94A3B8" />
                                        <TextInput
                                            style={[styles.selectorSearchInput, { fontSize: moderateScale(14) }]}
                                            placeholder="Search projects…"
                                            placeholderTextColor="#94A3B8"
                                            value={projectSearchQuery}
                                            onChangeText={setProjectSearchQuery}
                                            autoCorrect={false}
                                        />
                                        {projectSearchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => setProjectSearchQuery('')} hitSlop={8}>
                                                <MaterialCommunityIcons name="close-circle" size={moderateScale(18)} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <FlatList
                                    data={(() => {
                                        const source = [{ _id: null, name: 'All Projects', _isAllOption: true }, ...(projects || [])];
                                        if (!projectSearchQuery.trim()) return source;
                                        const q = projectSearchQuery.trim().toLowerCase();
                                        return source.filter(p => p._isAllOption || (p.name && p.name.toLowerCase().includes(q)));
                                    })()}
                                    keyExtractor={(item, index) => (item._id || item.id || `proj-${index}`)}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={true}
                                    contentContainerStyle={{ paddingHorizontal: scale(20), paddingBottom: verticalScale(16) }}
                                    renderItem={({ item }) => {
                                        const isAllOption = item._isAllOption;
                                        const itemId = String(item._id || item.id || '');
                                        const isSelected = isAllOption ? !selectedFilterProject : String(selectedFilterProject?._id || selectedFilterProject?.id || '') === itemId;

                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.selectorItem,
                                                    { paddingVertical: verticalScale(14), paddingHorizontal: scale(4) },
                                                    isSelected && styles.selectorItemActive,
                                                ]}
                                                activeOpacity={0.6}
                                                onPress={() => {
                                                    setSelectedFilterProject(isAllOption ? null : item);
                                                    setFilterModalVisible(false);
                                                    setProjectSearchQuery('');
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                    <View style={[
                                                        styles.selectorIcon,
                                                        { width: scale(36), height: scale(36), borderRadius: moderateScale(10), marginRight: scale(12) },
                                                        isAllOption && { backgroundColor: '#EEF2FF' },
                                                    ]}>
                                                        <MaterialCommunityIcons
                                                            name={isAllOption ? 'filter-variant-remove' : 'office-building'}
                                                            size={moderateScale(18)}
                                                            color={isAllOption ? '#6366F1' : '#2563EB'}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.selectorText, { fontSize: moderateScale(15) }]} numberOfLines={2}>
                                                            {item.name}
                                                        </Text>
                                                        {!isAllOption && item.status && (
                                                            <Text style={[styles.selectorSubText, { fontSize: moderateScale(11), marginTop: verticalScale(2) }]}>
                                                                {item.status}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {isSelected ? (
                                                    <MaterialCommunityIcons name="check-circle" size={moderateScale(22)} color="#2563EB" />
                                                ) : (
                                                    <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#CBD5E1" />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', paddingVertical: verticalScale(32) }}>
                                            <MaterialCommunityIcons name="folder-search-outline" size={moderateScale(48)} color="#CBD5E1" />
                                            <Text style={[styles.emptyText, { fontSize: moderateScale(14), marginTop: verticalScale(12) }]}>
                                                {projectSearchQuery ? 'No matching projects' : 'No projects available'}
                                            </Text>
                                        </View>
                                    }
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flex: 1 },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5 },
    subtitle: { color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
    actionBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtnText: { color: COLORS.white, fontWeight: '900' },
    filterArea: { gap: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
    searchInput: { flex: 1, marginLeft: 8, fontWeight: '600', color: COLORS.textPrimary },
    toolsRow: { flexDirection: 'row', gap: SPACING.s },
    toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, minHeight: verticalScale(44) },
    toolBtnText: { fontWeight: '800', color: COLORS.textSecondary, fontSize: moderateScale(12) },
    tableHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingHorizontal: 4 },
    headerLabel: { fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
    listContainer: { paddingBottom: 100 },
    tableRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    column: { justifyContent: 'center' },
    cellMainText: { fontWeight: '800', color: COLORS.textPrimary },
    cellSubText: { fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
    cellProjectText: { fontWeight: '800', color: COLORS.textPrimary },
    cellWorkText: { fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
    statusChip: { backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
    statusChipText: { fontWeight: '900', color: '#0369A1' },
    photoCountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    photoCountText: { fontWeight: '800', color: '#6366F1' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyText: { textAlign: 'center', fontWeight: '700', color: COLORS.textMuted, marginTop: SPACING.m },
    detailMetaBlock: { paddingTop: verticalScale(4) },
    detailMetaRow: { flexDirection: 'row', alignItems: 'center' },
    detailMetaText: { marginLeft: scale(10), fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
    verifiedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
    verifiedPillText: { fontWeight: '800', color: '#047857' },
    detailSection: {},
    detailBody: { fontWeight: '600', color: COLORS.textSecondary },
    detailFooterMeta: { fontWeight: '600', color: COLORS.textMuted },
    manpowerRow: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    manpowerRole: { fontWeight: '800', color: COLORS.textPrimary },
    manpowerNums: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
    detailPhotoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    detailPhotoThumb: { overflow: 'hidden', backgroundColor: '#E2E8F0' },
    detailPhotoZoomHint: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 4 },
    detailNoPhotos: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
    detailNoPhotosText: { fontWeight: '600', color: COLORS.textMuted },
    photoPreviewRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
    photoPreviewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    photoPreviewImage: { width: '100%', height: '72%' },
    photoPreviewClose: { position: 'absolute', zIndex: 100 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: COLORS.card,
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
    modalTitle: { fontWeight: '900', color: COLORS.textPrimary },
    modalSubtitle: { fontWeight: '600', color: COLORS.textSecondary },
    closeBtn: { padding: 4 },
    closeModalBtn: { backgroundColor: COLORS.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    inputGroup: { marginBottom: SPACING.m },
    label: { fontWeight: '900', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    selectBtn: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectBtnText: { fontWeight: '700', color: COLORS.textPrimary },
    row: { flexDirection: 'row', gap: 10 },
    fieldValue: { backgroundColor: COLORS.surfaceSecondary, flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
    fieldValueText: { fontWeight: '800', color: COLORS.textSecondary },
    textInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    textArea: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, fontWeight: '600', color: COLORS.textSecondary, textAlignVertical: 'top' },
    submitBtn: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: COLORS.white, fontWeight: '900' },
    hintText: { color: COLORS.textMuted, fontWeight: '600' },
    photoScrollContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
    photoThumbWrap: { overflow: 'hidden', backgroundColor: '#E2E8F0' },
    photoThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoRemoveBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: SIZES.radiusBtn },
    addPhotoCard: { borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed', backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    addPhotoLabel: { fontWeight: '800', color: '#6366F1', marginTop: 2 },
    selectorCard: { backgroundColor: COLORS.card, padding: 24, paddingBottom: 100 },
    selectorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
    selectorItemActive: { backgroundColor: '#EFF6FF', borderBottomColor: '#BFDBFE' },
    selectorIcon: { backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
    selectorText: { fontWeight: '700', color: '#1E2937' },
    selectorSubText: { fontWeight: '600', color: COLORS.textMuted },
    selectorSearchWrap: {},
    selectorSearchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    selectorSearchInput: { flex: 1, marginLeft: 8, fontWeight: '600', color: COLORS.textPrimary },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontWeight: '900', color: COLORS.textPrimary, marginTop: SPACING.m },
    emptySubtitle: { fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
    inlineDropdown: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    inlineDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.card,
    },
    inlineDropdownItemActive: {
        backgroundColor: '#EFF6FF',
        borderBottomColor: '#BFDBFE',
    },
});

export default DailyLogsScreen;
