import React, { useState, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, ScrollView, StatusBar, ActivityIndicator 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';

const SubcontractorProjectsScreen = ({ navigation }) => {
    const { jobs, loading, refreshData } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('PLANNING');

    const filters = ['PLANNING', 'ACTIVE', 'ON HOLD', 'COMPLETE'];

    const filteredJobs = useMemo(() => {
        return (jobs || []).filter(j => {
            const matchesSearch = j.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (j.projectId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const normalizedStatus = (j.status || 'planning').toUpperCase().replace('_', ' ');
            const matchesFilter = activeFilter === 'ALL' || normalizedStatus === activeFilter;
            
            return matchesSearch && matchesFilter;
        });
    }, [jobs, searchQuery, activeFilter]);

    const renderProjectCard = ({ item }) => (
        <View style={[styles.jobCard, SHADOWS.medium]}>
            <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                    <View style={styles.blueCircle}>
                        <MaterialCommunityIcons name="briefcase-outline" size={20} color="#2563EB" />
                    </View>
                </View>
                <View style={styles.statusSection}>
                    <Text style={styles.manageLabel}>MANAGE STATUS</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{(item.status || 'PLANNING').toUpperCase()}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.cardBody}>
                <Text style={styles.jobTitle}>{item.name}</Text>
                <View style={styles.locationContainer}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                    <Text style={styles.locationText}>{item.projectId?.name || 'Main Site'}</Text>
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>PROGRESS</Text>
                        <Text style={styles.progressPercent}>{item.progress || 0}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${item.progress || 0}%` }]} />
                    </View>
                </View>
            </View>

            <TouchableOpacity 
                style={styles.viewTasksBtn}
                onPress={() => navigation.navigate('SubcontractorJobDetails', { job: item })}
            >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
                <Text style={styles.viewTasksBtnText}>VIEW TASKS</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Projects" navigation={navigation} />

            {/* Sub-Header matching Web Screenshot */}
            <View style={styles.headerContent}>
                <Text style={styles.titleText}>My Job Assignments</Text>
                <View style={styles.subtitleRow}>
                    <MaterialCommunityIcons name="web" size={14} color="#2563EB" />
                    <Text style={styles.subtitleText}>VIEW YOUR ASSIGNED JOBS AND THEIR TASKS</Text>
                </View>
            </View>

            {/* Filters matching Web Screenshot - Fixed on one screen */}
            <View style={styles.filterContainer}>
                <View style={styles.filterRow}>
                    {filters.map(f => (
                        <TouchableOpacity 
                            key={f} 
                            onPress={() => setActiveFilter(f)}
                            style={[
                                styles.filterTab, 
                                activeFilter === f && styles.filterTabActive
                            ]}
                        >
                            <Text style={[
                                styles.filterTabText, 
                                activeFilter === f && styles.filterTabTextActive
                            ]}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Search Bar matching Web Screenshot */}
            <View style={styles.searchWrapper}>
                <View style={styles.searchContainer}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search objectives..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredJobs}
                keyExtractor={item => item._id || item.id}
                renderItem={renderProjectCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No matching assignments found.</Text>
                        </View>
                    )
                }
                onRefresh={refreshData}
                refreshing={loading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    
    // Header
    headerContent: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 15 },
    titleText: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
    subtitleText: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },

    // Filters
    filterContainer: { backgroundColor: '#F8FAFC', paddingVertical: 8, marginHorizontal: 20, borderRadius: 16, marginBottom: 15 },
    filterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    filterTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    filterTabActive: { backgroundColor: '#FF6B00' },
    filterTabText: { fontSize: 9, fontWeight: '900', color: '#64748B' },
    filterTabTextActive: { color: '#FFFFFF' },

    // Search
    searchWrapper: { paddingHorizontal: 20, marginBottom: 20 },
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F8FAFC', 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        borderRadius: 14, 
        paddingHorizontal: 16,
        height: 50
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#0F172A' },

    // List
    listContainer: { paddingHorizontal: 20, paddingBottom: 100 },

    // Card UI matching Screenshot
    jobCard: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 30, 
        padding: 24, 
        marginBottom: 20, 
        borderWidth: 1, 
        borderColor: '#F1F5F9' 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small
    },
    blueCircle: { 
        width: 32, 
        height: 32, 
        borderRadius: 16, 
        backgroundColor: '#EFF6FF', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    statusSection: { alignItems: 'flex-end' },
    manageLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginBottom: 4 },
    statusBadge: { backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    statusBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

    cardBody: { marginTop: 15 },
    jobTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
    locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 15 },
    locationText: { fontSize: 12, fontWeight: '700', color: '#64748B' },

    progressSection: { marginBottom: 25 },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
    progressPercent: { fontSize: 10, fontWeight: '900', color: '#0F172A' },
    progressBarBg: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 2 },

    viewTasksBtn: { 
        backgroundColor: '#2563EB', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: 52, 
        borderRadius: 14, 
        gap: 8 
    },
    viewTasksBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 16, fontSize: 14, color: '#94A3B8', fontWeight: '700' }
});

export default SubcontractorProjectsScreen;
