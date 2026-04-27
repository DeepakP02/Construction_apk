import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, StatusBar, ScrollView, 
    TouchableOpacity, TextInput, Image, Dimensions, RefreshControl,
    Modal, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getServerUrl } from '../../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const ClientProjectsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { projects, user, loading, refreshData } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPhase, setSelectedPhase] = useState('ALL');
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    // Metrics calculation
    const metrics = useMemo(() => {
        const clientProjects = projects || [];
        return {
            active: clientProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length,
            planning: clientProjects.filter(p => !p.status || p.status === 'planning' || p.status === 'pre_construction').length
        };
    }, [projects]);

    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        return projects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            const status = (p.status || 'planning').toLowerCase();
            let matchesPhase = true;
            if (selectedPhase === 'PLANNING') {
                matchesPhase = status === 'planning' || status === 'pre_construction';
            } else if (selectedPhase === 'IN PROGRESS') {
                matchesPhase = status === 'active' || status === 'in_progress';
            } else if (selectedPhase === 'COMPLETED') {
                matchesPhase = status === 'completed' || status === 'done';
            }

            return matchesSearch && matchesPhase;
        });
    }, [projects, searchQuery, selectedPhase]);

    const ProjectCard = ({ project }) => {
        const progress = project.progressPercentage || 0;
        
        return (
            <TouchableOpacity 
                style={[styles.card, SHADOWS.medium]}
                onPress={() => navigation.navigate('ClientProgress', { project })}
            >
                {/* Content Section */}
                <View style={styles.cardContent}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <View style={styles.locRow}>
                            <MaterialCommunityIcons name="map-marker" size={12} color="#2563EB" />
                            <Text style={styles.locTxt} numberOfLines={1}>{project.location || 'SITE TBD'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { position: 'relative', top: 0, left: 0, paddingVertical: 2, paddingHorizontal: 6 }]}>
                            <Text style={[styles.statusText, { fontSize: 8 }]}>{(project.status || 'PLANNING').toUpperCase()}</Text>
                        </View>
                    </View>
                    
                    <Text style={styles.projTitle} numberOfLines={1}>{project.name}</Text>
                    <Text style={styles.pmInfo}>PM: {project.projectManager?.fullName || 'SHAWN'}</Text>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MaterialCommunityIcons name="trending-up" size={14} color="#2563EB" />
                                <Text style={styles.progressLabel}>PROGRESS</Text>
                            </View>
                            <Text style={styles.progressValue}>{progress}%</Text>
                        </View>
                        <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${Math.max(progress, 5)}%` }]} />
                        </View>
                    </View>

                    {/* Client Info */}
                    <View style={styles.clientInfo}>
                        <MaterialCommunityIcons name="account-circle-outline" size={14} color="#94A3B8" />
                        <View>
                            <Text style={styles.clientLabel}>CLIENT</Text>
                            <Text style={styles.clientName}>{project.client?.fullName || user?.fullName || 'Vishawjit'}</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Drawings', { project })}>
                            <MaterialCommunityIcons name="file-document-outline" size={16} color="#475569" />
                            <Text style={styles.outlineBtnTxt}>DRAWINGS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('ClientProgress', { project })}>
                            <MaterialCommunityIcons name="chart-line" size={16} color="#fff" />
                            <Text style={styles.primaryBtnTxt}>PROGRESS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Portfolio Control" showBranding={true} hideSearch={true} />

            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header Actions */}
                <View style={styles.headerSection}>
                    <View>
                        <Text style={styles.screenTitle}>Projects</Text>
                    </View>
                    {!isSmallDevice && (
                        <View style={styles.layoutIcons}>
                            <MaterialCommunityIcons name="view-grid" size={24} color="#0F172A" />
                            <MaterialCommunityIcons name="view-list" size={24} color="#94A3B8" />
                        </View>
                    )}
                </View>


                {/* Search Bar */}
                <View style={styles.searchRow}>
                    <View style={styles.searchContainer}>
                        <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Site name..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity 
                        style={styles.filterBtn}
                        onPress={() => setShowPhaseModal(true)}
                    >
                        <Text style={styles.filterText}>{selectedPhase === 'ALL' ? (isSmallDevice ? 'Phase' : 'Status') : selectedPhase}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* Project List */}
                <View style={styles.projectList}>
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map(p => <ProjectCard key={p._id} project={p} />)
                    ) : (
                        <View style={styles.emptyCard}>
                            <MaterialCommunityIcons name="folder-search-outline" size={48} color="#E2E8F0" />
                            <Text style={styles.emptyTxt}>No projects found</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Phase Selection Modal */}
            <Modal visible={showPhaseModal} transparent animationType="fade">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowPhaseModal(false)}
                >
                    <View style={[styles.modalContent, SHADOWS.large]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Project Phase</Text>
                            <TouchableOpacity onPress={() => setShowPhaseModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.phaseList}>
                            {['ALL', 'PLANNING', 'IN PROGRESS', 'COMPLETED'].map((phase) => (
                                <TouchableOpacity
                                    key={phase}
                                    style={[
                                        styles.phaseItem, 
                                        selectedPhase === phase && styles.phaseItemActive
                                    ]}
                                    onPress={() => {
                                        setSelectedPhase(phase);
                                        setShowPhaseModal(false);
                                    }}
                                >
                                    <View style={[
                                        styles.phaseIcon,
                                        selectedPhase === phase && { backgroundColor: '#fff' }
                                    ]}>
                                        <MaterialCommunityIcons 
                                            name={phase === 'ALL' ? 'earth' : phase === 'PLANNING' ? 'calendar-blank' : phase === 'IN PROGRESS' ? 'trending-up' : 'check-circle'} 
                                            size={20} 
                                            color={selectedPhase === phase ? '#2563EB' : '#64748B'} 
                                        />
                                    </View>
                                    <Text style={[
                                        styles.phaseName,
                                        selectedPhase === phase && { color: '#fff' }
                                    ]}>{phase}</Text>
                                    {selectedPhase === phase && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: isSmallDevice ? 12 : 16, paddingTop: 10 },
    
    headerSection: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: isSmallDevice ? 16 : 20 
    },
    screenTitle: { fontSize: isSmallDevice ? 24 : 28, fontWeight: '950', color: '#0F172A', letterSpacing: -1 },
    layoutIcons: { flexDirection: 'row', gap: 12 },

    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    searchContainer: { 
        flex: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#fff', 
        borderRadius: 14, 
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '700', color: '#1E293B' },
    filterBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        backgroundColor: '#fff', 
        borderRadius: 14, 
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    filterText: { fontSize: 12, fontWeight: '900', color: '#475569' },

    card: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
    cardImageContainer: { height: 200, width: '100%', position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    statusBadge: { 
        position: 'absolute', 
        top: 16, 
        left: 16, 
        backgroundColor: '#EA580C', 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 8 
    },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    
    cardContent: { padding: 20 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    locTxt: { fontSize: 10, fontWeight: '900', color: '#2563EB', letterSpacing: 0.5 },
    projTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
    pmInfo: { fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 20 },
    
    progressContainer: { marginBottom: 20 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    progressLabel: { fontSize: 10, fontWeight: '950', color: '#64748B', letterSpacing: 1 },
    progressValue: { fontSize: 12, fontWeight: '950', color: '#0F172A' },
    barBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: '#2563EB' },
    
    clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    clientLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
    clientName: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    
    actionRow: { flexDirection: 'row', gap: 12 },
    outlineBtn: { 
        flex: 1, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8, 
        height: 48, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    outlineBtnTxt: { fontSize: 12, fontWeight: '900', color: '#475569' },
    primaryBtn: { 
        flex: 1, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8, 
        height: 48, 
        borderRadius: 12, 
        backgroundColor: '#2563EB' 
    },
    primaryBtnTxt: { fontSize: 12, fontWeight: '900', color: '#fff' },
    
    emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyTxt: { fontSize: 14, fontWeight: '800', color: '#94A3B8', marginTop: 12 },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
    },
    phaseList: {
        gap: 12,
    },
    phaseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 16,
    },
    phaseItemActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    phaseIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    phaseName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
});

export default ClientProjectsScreen;

