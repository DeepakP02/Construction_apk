import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, Animated, ActivityIndicator, Dimensions,
    StatusBar, SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

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
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerContent: {
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    subtitleText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    filterContainer: {
        paddingHorizontal: 16,
        marginTop: 10,
    },
    tabWrapper: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    statusTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 11,
    },
    statusTabText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    statusTabTextActive: {
        color: '#FFFFFF',
    },
    searchSection: {
        paddingHorizontal: 16,
        marginTop: 15,
        marginBottom: 10,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 50,
        borderRadius: 16,
        paddingHorizontal: 15,
        borderWidth: 1.5,
        borderColor: '#DBEAFE', // Light blue tint as per screenshot border glow
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 100,
    },
    jobCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    jobIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    jobName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    projectName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 1,
    },
    cardFooter: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#2563EB',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1E293B',
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
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1,
    },
});

export default WorkerJobsScreen;
