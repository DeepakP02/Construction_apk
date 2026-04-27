import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, StatusBar, ActivityIndicator, Dimensions, RefreshControl, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ForemanJobsScreen = ({ navigation }) => {
    const { jobs, refreshData, loading: appLoading, selectedProject } = useApp();
    const { width } = useWindowDimensions();
    const [search, setSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState('ALL');
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const stats = {
        active: (jobs || []).filter(j => j.status === 'active' || j.status === 'in_progress').length,
        planning: (jobs || []).filter(j => j.status === 'planning' || j.status === 'todo').length
    };

    const filteredJobs = (jobs || []).filter(j => {
        const matchesSearch = (j.name || j.title || '').toLowerCase().includes(search.toLowerCase()) ||
            (j.location || j.projectId?.name || '').toLowerCase().includes(search.toLowerCase());

        const statusMap = {
            'PLANNING': ['planning', 'todo', 'pending'],
            'ACTIVE': ['active', 'in_progress'],
            'COMPLETE': ['completed', 'done'],
            'ON HOLD': ['on-hold']
        };

        const matchesSelected = !selectedProject || (j.projectId?._id === (selectedProject._id || selectedProject.id) || j.projectId === (selectedProject._id || selectedProject.id));
        const matchesStatus = activeStatus === 'ALL' || statusMap[activeStatus]?.includes(j.status);
        return matchesSearch && matchesStatus && matchesSelected;
    });

    const renderJobItem = ({ item }) => {
        return (
            <View style={[styles.jobCard, SHADOWS.medium, { marginHorizontal: isTablet ? '10%' : scale(20), padding: moderateScale(20), borderRadius: moderateScale(28) }]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { width: scale(48), height: scale(48), borderRadius: moderateScale(12) }]}>
                        <MaterialCommunityIcons name="briefcase-variant-outline" size={moderateScale(24)} color="#2563EB" />
                    </View>
                    <View style={[styles.headerRight, { gap: verticalScale(4) }]}>
                        <Text style={[styles.manageLabel, { fontSize: moderateScale(7) }]}>MANAGE STATUS</Text>
                        <TouchableOpacity style={[styles.statusPill, { paddingHorizontal: scale(12), paddingVertical: verticalScale(6), borderRadius: moderateScale(8) }]}>
                            <Text style={[styles.statusPillText, { fontSize: moderateScale(10) }]}>{(item.status || 'PLANNING').toUpperCase().replace('_', ' ')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.cardBody, { marginTop: verticalScale(16), marginBottom: verticalScale(20) }]}>
                    <Text style={[styles.jobTitle, { fontSize: moderateScale(22) }]}>{item.name || item.title || 'Untitled Job'}</Text>
                    <View style={[styles.locationRow, { marginTop: verticalScale(6), gap: scale(4) }]}>
                        <MaterialCommunityIcons name="map-marker" size={moderateScale(16)} color="#94A3B8" />
                        <Text style={[styles.locationText, { fontSize: moderateScale(13) }]}>{item.location || 'Site Location'}</Text>
                    </View>

                    <View style={[styles.progressContainer, { marginTop: verticalScale(20) }]}>
                        <View style={[styles.progressLabelRow, { marginBottom: verticalScale(8) }]}>
                            <Text style={[styles.progressLabel, { fontSize: moderateScale(10) }]}>PROGRESS</Text>
                            <Text style={[styles.progressValue, { fontSize: moderateScale(11) }]}>{item.progress || 0}%</Text>
                        </View>
                        <View style={[styles.progressTrack, { height: verticalScale(6), borderRadius: moderateScale(3) }]}>
                            <View style={[styles.progressFill, { width: `${item.progress || 0}%`, borderRadius: moderateScale(3) }]} />
                        </View>
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.viewTasksBtn, { height: verticalScale(56), borderRadius: moderateScale(14), gap: scale(10) }]}
                    onPress={() => navigation.navigate('ForemanJobDetail', { jobId: item._id || item.id })}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="check-circle-outline" size={moderateScale(20)} color="#fff" />
                    <Text style={[styles.viewTasksText, { fontSize: moderateScale(14) }]}>VIEW TASKS</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const ListHeader = () => (
        <View>
            <View style={[styles.titleSection, { padding: scale(24) }]}>
                <Text style={[styles.screenTitle, { fontSize: moderateScale(28) }]}>My Job Assignments</Text>
                <View style={[styles.subtitleRow, { marginTop: verticalScale(4), gap: scale(6) }]}>
                    <MaterialCommunityIcons name="earth" size={moderateScale(16)} color="#2563EB" />
                    <Text style={[styles.screenSubtitle, { fontSize: moderateScale(11) }]}>VIEW YOUR ASSIGNED JOBS AND THEIR TASKS</Text>
                </View>
            </View>

            <View style={[styles.filterBar, SHADOWS.small, { marginHorizontal: isTablet ? '10%' : scale(20), padding: moderateScale(8), borderRadius: moderateScale(20), marginBottom: verticalScale(24) }]}>
                <View style={[styles.searchContainer, { paddingHorizontal: scale(12) }]}>
                    <MaterialCommunityIcons name="magnify" size={moderateScale(22)} color="#94A3B8" />
                    <TextInput 
                        style={[styles.searchInput, { fontSize: moderateScale(14), marginLeft: scale(10) }]}
                        placeholder="Search jobs..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity style={[styles.filterMenu, { paddingHorizontal: scale(16), gap: scale(8) }]}>
                    <Text style={[styles.filterMenuText, { fontSize: moderateScale(12) }]}>
                        {activeStatus === 'ALL' ? 'All Statuses' : activeStatus}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={moderateScale(16)} color="#64748B" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Job Center" showBranding={true} />

            <Animated.FlatList
                style={{ opacity: fadeAnim }}
                data={filteredJobs}
                keyExtractor={(item, index) => item._id ? `fjob-${item._id}-${index}` : `fjob-idx-${index}`}
                renderItem={renderJobItem}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: verticalScale(100) }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={[styles.emptyView, { padding: scale(60) }]}>
                        <MaterialCommunityIcons name="office-building-marker" size={moderateScale(60)} color="#E2E8F0" />
                        <Text style={[styles.emptyTitle, { fontSize: moderateScale(18), marginTop: verticalScale(16) }]}>No Job Assignments</Text>
                        <Text style={[styles.emptySub, { fontSize: moderateScale(13), marginTop: verticalScale(8) }]}>You don't have any jobs assigned to you at this moment.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    scrollContent: { },
    titleSection: { },
    screenTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    subtitleRow: { flexDirection: 'row', alignItems: 'center' },
    screenSubtitle: { fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
    filterBar: { flexDirection: 'row', backgroundColor: '#fff', alignItems: 'center' },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
    searchInput: { flex: 1, fontWeight: '600', color: '#1E293B' },
    filterMenu: { flexDirection: 'row', alignItems: 'center' },
    filterMenuText: { fontWeight: '800', color: '#1E293B' },
    jobCard: { 
        backgroundColor: '#fff', 
        borderWidth: 1, 
        borderColor: '#fff',
        marginBottom: verticalScale(20)
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    iconBox: { backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
    manageLabel: { fontWeight: '900', color: '#94A3B8' },
    statusPill: { backgroundColor: '#0F172A' },
    statusPillText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
    cardBody: { },
    jobTitle: { fontWeight: '900', color: '#0F172A' },
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    locationText: { fontWeight: '700', color: '#94A3B8' },
    progressContainer: { },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    progressValue: { fontWeight: '900', color: '#0F172A' },
    progressTrack: { backgroundColor: '#F1F5F9', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#2563EB' },
    viewTasksBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    viewTasksText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
    emptyView: { alignItems: 'center' },
    emptyTitle: { fontWeight: '900', color: '#1E293B' },
    emptySub: { fontWeight: '600', color: '#94A3B8', textAlign: 'center' }
});

export default ForemanJobsScreen;
