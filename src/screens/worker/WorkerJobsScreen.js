import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, Animated, ActivityIndicator, Dimensions,
    StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale } from '../../utils/responsive';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WorkerJobsScreen = ({ navigation }) => {
    const { jobs, projects, metrics, refreshData, selectedProject } = useApp();
    const [search, setSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState('PLANNING'); 
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const workerMetrics = metrics?.workerMetrics || {};
    // Software's 'My Job Assignments' for workers uses assignedProjects from metrics
    const assignedJobs = workerMetrics.assignedProjects || [];

    const statusMap = {
        'PLANNING': ['planning', 'pending', 'todo'],
        'ACTIVE': ['active', 'in_progress', 'in-progress'],
        'ON HOLD': ['on_hold', 'on-hold', 'hold'],
        'COMPLETE': ['completed', 'complete', 'done']
    };

    const displayJobs = (assignedJobs.length > 0 ? assignedJobs : (jobs || [])).filter(job => {
        // Handle both object structures
        const jobName = job.name || job.jobName || 'Unnamed Assignment';
        const projName = job.project?.name || job.projectName || 'General Project';

        const matchesSearch = jobName.toLowerCase().includes(search.toLowerCase()) ||
            projName.toLowerCase().includes(search.toLowerCase());

        const matchesSelected = !selectedProject || (job.project?._id === (selectedProject._id || selectedProject.id) || job.projectId === (selectedProject._id || selectedProject.id));
        const jobStatus = (job.status || 'planning').toLowerCase();
        const allowedStatuses = statusMap[activeStatus] || [];
        const matchesStatus = allowedStatuses.includes(jobStatus);
        
        return matchesSearch && matchesStatus && matchesSelected;
    });

    const renderJobItem = ({ item }) => {
        const jobName = item.name || item.jobName || 'Unnamed Assignment';
        const projName = item.project?.name || item.projectName || 'General Project';
        const id = item._id || item.id;
        
        // Progress can be estimated from status
        const status = (item.status || '').toLowerCase();
        const progress = status === 'completed' ? 100 : (status === 'active' ? 50 : 0);

        return (
            <TouchableOpacity 
                style={[styles.jobCard, SHADOWS.card]}
                onPress={() => navigation.navigate('JobTasks', { jobId: id })}
            >
                <View style={styles.cardInfo}>
                    <View style={styles.jobIconBox}>
                        <MaterialCommunityIcons name="briefcase-variant" size={20} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.jobName}>{jobName}</Text>
                        <Text style={styles.projectName}>{projName}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                </View>
                
                <View style={styles.cardFooter}>
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{progress}%</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const StatusTab = ({ label }) => {
        const isActive = activeStatus === label;
        const getBgColor = () => {
            if (!isActive) return 'transparent';
            switch (label) {
                case 'PLANNING': return '#FF6B00'; // Orange
                case 'ACTIVE': return '#2563EB';   // Blue
                case 'ON HOLD': return '#F59E0B';  // Yellow
                case 'COMPLETE': return '#16A34A'; // Green
                default: return '#FF6B00';
            }
        };

        return (
            <TouchableOpacity 
                onPress={() => setActiveStatus(label)}
                style={[
                    styles.statusTab, 
                    isActive && { backgroundColor: getBgColor() }
                ]}
            >
                <Text style={[
                    styles.statusTabText, 
                    isActive && styles.statusTabTextActive
                ]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} title="Jobs" />

            <View style={styles.headerContent}>
                <Text style={styles.mainTitle}>My Job Assignments</Text>
                <View style={styles.subtitleRow}>
                    <MaterialCommunityIcons name="earth" size={14} color="#2563EB" />
                    <Text style={styles.subtitleText}>VIEW YOUR ASSIGNED JOBS AND THEIR TASKS</Text>
                </View>
            </View>

            {/* Filter Tabs - mirroring the orange active state in screenshot */}
            <View style={styles.filterContainer}>
                <View style={styles.tabWrapper}>
                    <StatusTab label="PLANNING" />
                    <StatusTab label="ACTIVE" />
                    <StatusTab label="ON HOLD" />
                    <StatusTab label="COMPLETE" />
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search objectives..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <FlatList
                    data={displayJobs}
                    keyExtractor={(item) => item._id}
                    renderItem={renderJobItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="briefcase-outline" size={48} color="#E2E8F0" />
                            </View>
                            <Text style={styles.emptyTitle}>NO ASSIGNED JOBS FOUND</Text>
                        </View>
                    }
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    headerContent: {
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.xs,
    },
    mainTitle: {
        ...TYPOGRAPHY.screenTitle,
        color: COLORS.textPrimary,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    subtitleText: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textMuted,
    },
    filterContainer: {
        paddingHorizontal: SPACING.m,
        marginTop: SPACING.s,
    },
    tabWrapper: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statusTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: SIZES.radiusBtn,
    },
    statusTabText: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textMuted,
    },
    statusTabTextActive: {
        color: COLORS.white,
    },
    searchSection: {
        paddingHorizontal: SPACING.m,
        marginTop: SPACING.m,
        marginBottom: SPACING.s,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        height: 50,
        borderRadius: SIZES.radiusInput,
        paddingHorizontal: SPACING.m,
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    listContainer: {
        padding: SPACING.m,
        paddingBottom: 100,
    },
    jobCard: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: SPACING.m,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    jobIconBox: {
        width: 40,
        height: 40,
        borderRadius: SIZES.radiusBtn,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    jobName: {
        ...TYPOGRAPHY.subtitle,
        color: COLORS.textPrimary,
    },
    projectName: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    cardFooter: {
        marginTop: SPACING.sm,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#2563EB',
        borderRadius: 3,
    },
    progressText: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textPrimary,
        width: 30,
        textAlign: 'right',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    emptyTitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        letterSpacing: 1,
    },
});

export default WorkerJobsScreen;

