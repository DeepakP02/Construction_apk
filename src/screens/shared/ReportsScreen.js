import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

const { width } = Dimensions.get('window');

const ReportsScreen = ({ navigation }) => {
    const { projects, tasks, jobs } = useApp();

    const stats = useMemo(() => {
        // Find the gym-project (as per user's request example)
        // If not found, use the first project or an empty state
        const activeProject = projects.find(p => p.name?.toLowerCase().includes('gym')) || projects[0] || {};
        
        // Filter jobs and tasks for this project
        const projectJobs = jobs.filter(j => j.projectId === activeProject._id || j.projectId?._id === activeProject._id);
        const projectTasks = tasks.filter(t => t.projectId === activeProject._id || t.projectId?._id === activeProject._id);

        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'completed' || t.status === 'closed').length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const totalSpend = projectJobs.reduce((acc, job) => acc + (job.cost || 0), 0);
        const totalBudget = activeProject.totalBudget || 1500000; // Fallback to user's example budget
        const budgetUsage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

        // Deriving Worker/Labour Intel (Mocking hours for now, can be linked to timelogs if needed)
        const activeWorkers = projectTasks.reduce((acc, t) => {
            if (t.assignedTo) acc.add(t.assignedTo._id || t.assignedTo);
            return acc;
        }, new Set()).size;

        return {
            projectName: activeProject.name || 'No Active Project',
            progress,
            completedTasks,
            totalTasks,
            totalSpend,
            totalBudget,
            budgetUsage,
            workers: activeWorkers,
            projectJobs
        };
    }, [projects, tasks, jobs]);

    const ProgressCircle = ({ percentage }) => (
        <View style={styles.progressCircleContainer}>
            <View style={[styles.progressCircle, { borderTopColor: '#2563EB', borderRightColor: percentage >= 25 ? '#2563EB' : '#F1F5F9', borderBottomColor: percentage >= 50 ? '#2563EB' : '#F1F5F9', borderLeftColor: percentage >= 75 ? '#2563EB' : '#F1F5F9' }]}>
                <Text style={styles.progressText}>{percentage}%</Text>
            </View>
        </View>
    );

    const StatCard = ({ label, value, sub, icon, bg, color }) => (
        <View style={[styles.statCard, SHADOWS.small]}>
            <View style={[styles.iconContainer, { backgroundColor: bg }]}>
                <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
            <View style={styles.statContent}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
                {sub && <Text style={styles.statSub}>{sub}</Text>}
            </View>
        </View>
    );

    const formatCurrency = (amount) => {
        return `$${amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Reports" showBranding={true} showBack={true} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Dashboard Title Section */}
                <View style={styles.header}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.dashboardTitle}>Project Intelligence</Text>
                        <Text style={styles.dashboardSubtitle} numberOfLines={1}>Analytics for {stats.projectName}</Text>
                    </View>
                    <TouchableOpacity style={styles.exportBtn}>
                        <MaterialCommunityIcons name="file-export-outline" size={18} color="#2563EB" />
                        <Text style={styles.exportText}>Export</Text>
                    </TouchableOpacity>
                </View>

                {/* Primary Metrics Grid */}
                <View style={styles.metricsGrid}>
                    {/* Metrics removed as per request */}
                </View>

                {/* Job Cost Distribution (Visual Placeholder for Chart) */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Job Cost Distribution</Text>
                    <View style={styles.chartPlaceholder}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(stats.budgetUsage, 100)}%` }]} />
                        </View>
                        <View style={styles.chartLabels}>
                            <Text style={styles.chartLabel}>Used: {formatCurrency(stats.totalSpend)}</Text>
                            <Text style={styles.chartLabel}>Total: {formatCurrency(stats.totalBudget)}</Text>
                        </View>
                    </View>
                </View>

                {/* Job-Wise Detailed Report */}
                <View style={styles.sectionContainer}>
                    <View style={styles.listHeader}>
                        <Text style={styles.sectionTitle}>Job-Wise Detailed Report</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{stats.projectJobs.length} Active Jobs</Text>
                        </View>
                    </View>

                    {stats.projectJobs.map((job, index) => (
                        <TouchableOpacity 
                            key={job._id || index} 
                            style={[styles.jobCard, SHADOWS.small]}
                            onPress={() => navigation.navigate('JobTasks', { jobId: job._id })}
                        >
                            <View style={styles.jobHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.jobName}>{job.name}</Text>
                                    <Text style={styles.jobType}>{job.status?.toUpperCase() || 'ACTIVE'}</Text>
                                </View>
                                <View style={styles.progressRing}>
                                    <View style={[styles.dot, { backgroundColor: job.status === 'completed' ? '#10B981' : '#F59E0B' }]} />
                                    <Text style={styles.progressValue}>{job.progress || 0}%</Text>
                                </View>
                            </View>

                            <View style={styles.jobTimeline}>
                                <MaterialCommunityIcons name="calendar-range" size={14} color="#94A3B8" />
                                <Text style={styles.timelineText}>
                                    {job.startDate ? new Date(job.startDate).toLocaleDateString('en-GB') : 'N/A'} — {job.endDate ? new Date(job.endDate).toLocaleDateString('en-GB') : 'N/A'}
                                </Text>
                            </View>

                            <View style={styles.costSection}>
                                <View style={styles.costInfo}>
                                    <Text style={styles.costLabel}>Spent / Budget</Text>
                                    <Text style={styles.costValue}>{formatCurrency(job.cost || 0)} / {formatCurrency(job.budget || 0)}</Text>
                                </View>
                                <View style={styles.costProgress}>
                                    <View style={styles.miniBarBg}>
                                        <View style={[styles.miniBarFill, { width: `${Math.min(((job.cost || 0) / (job.budget || 1)) * 100, 100)}%` }]} />
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                    
                    {stats.projectJobs.length === 0 && (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyStateText}>No detailed job reports available</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { paddingBottom: 40 },
    
    header: { padding: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTextContainer: { flex: 1, marginRight: 12 },
    dashboardTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    dashboardSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 4 },
    
    exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    exportText: { fontSize: 13, fontWeight: '900', color: '#2563EB' },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 24, marginBottom: 24 },
    statCard: { width: (width - 62) / 2, backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    statLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 4 },
    statSub: { fontSize: 10, color: '#64748B', fontWeight: '800', marginTop: 6 },

    sectionContainer: { paddingHorizontal: 24, marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
    
    chartPlaceholder: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    progressBarBg: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
    progressBarFill: { height: '100%', backgroundColor: '#2563EB' },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    chartLabel: { fontSize: 11, fontWeight: '800', color: '#64748B' },

    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    countBadge: { backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    countText: { fontSize: 11, fontWeight: '900', color: '#64748B' },

    jobCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' },
    jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    jobName: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
    jobType: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 },
    progressRing: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    progressValue: { fontSize: 12, fontWeight: '900', color: '#1E293B' },
    
    jobTimeline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    timelineText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
    
    costSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
    costInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    costLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8' },
    costValue: { fontSize: 12, fontWeight: '900', color: '#1E293B' },
    costProgress: {},
    miniBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
    miniBarFill: { height: '100%', backgroundColor: '#10B981' },

    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyStateText: { fontSize: 13, color: '#94A3B8', fontWeight: '800', marginTop: 12 }
});

export default ReportsScreen;
