import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, Image, Dimensions, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';

const { width } = Dimensions.get('window');

const ProjectManagerJobsScreen = ({ navigation }) => {
    const { projects, refreshData, selectedProject } = useApp();
    const [search, setSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState('ALL');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Edit Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [editName, setEditName] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editBudget, setEditBudget] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const filteredProjects = (projects || []).filter(proj => {
        const loc = typeof proj.location === 'object' ? proj.location?.address : proj.location;
        const matchesSearch = proj.name?.toLowerCase().includes(search.toLowerCase()) ||
            (loc || '').toLowerCase().includes(search.toLowerCase());

        const statusMap = {
            'PRE-CON': 'planning',
            'ACTIVE': 'active',
            'COMPLETE': 'completed',
            'ON HOLD': 'on-hold'
        };

        const matchesSelected = !selectedProject || (proj._id === (selectedProject._id || selectedProject.id));
        const matchesStatus = activeStatus === 'ALL' || proj.status === statusMap[activeStatus];
        return matchesSearch && matchesStatus && matchesSelected;
    });


    const openEditModal = (project) => {
        setEditingProject(project);
        setEditName(project.name);
        setEditLocation((typeof project.location === 'object' ? project.location?.address : project.location) || '');
        setEditBudget(project.budget?.toString() || '');
        setIsEditModalVisible(true);
    };

    const handleUpdate = async () => {
        if (!editName.trim()) {
            Alert.alert('Error', 'Project name is required');
            return;
        }

        try {
            setIsUpdating(true);
            await api.patch(`/projects/${editingProject._id}`, {
                name: editName,
                location: editLocation,
                budget: Number(editBudget) || 0
            });
            setIsEditModalVisible(false);
            refreshData();
            Alert.alert('Success', 'Project updated successfully');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update project');
        } finally {
            setIsUpdating(false);
        }
    };

    const renderProjectItem = ({ item }) => {
        const statusConfig = {
            'planning': { label: 'PLAN', color: '#F97316', bg: '#FFF7ED' },
            'active': { label: 'LIVE', color: '#10B981', bg: '#ECFDF5' },
            'completed': { label: 'DONE', color: COLORS.textSecondary, bg: '#F8FAFC' },
            'on-hold': { label: 'HOLD', color: '#FACC15', bg: '#FEFCE8' }
        };
        const config = statusConfig[item.status] || { label: '???', color: COLORS.textSecondary, bg: '#F8FAFC' };

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.ultraCompactRow, SHADOWS.small]}
                onPress={() => navigation.navigate('PMProjectDetail', { projectId: item._id })}
            >
                <View style={styles.topSection}>
                    <View style={styles.mainInfo}>
                        <View style={[styles.indicatorLine, { backgroundColor: config.color }]} />
                        <View>
                            <Text style={[styles.tinyName, { fontSize: width < 380 ? 12 : 13 }]} numberOfLines={1} adjustsFontSizeToFit>{item.name}</Text>
                            <Text style={styles.tinyLoc} numberOfLines={1}>{(typeof item.location === 'object' ? item.location?.address : item.location) || 'Site'}</Text>
                        </View>
                    </View>

                    <View style={styles.metricInfo}>
                        <Text style={styles.tinyBudget}>${(Number(item.budget) || 0).toLocaleString()}</Text>
                        <TouchableOpacity
                            style={[styles.tinyBadge, { backgroundColor: config.bg, borderColor: config.color + '20' }]}
                            onPress={() => navigation.navigate('PMProjectDetail', { projectId: item._id })}
                        >
                            <Text style={[styles.tinyBadgeText, { color: config.color }]}>{config.label}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bottomSection}>
                    <View style={styles.clientProgress}>
                        <Text style={styles.tinyClient}>{item.clientId?.fullName || 'No Client'}</Text>
                        <Text style={styles.tinyProgress}>{item.progress || 0}% Done</Text>
                    </View>

                    <View style={styles.miniActionStrip}>
                        <TouchableOpacity style={styles.miniBtn} onPress={() => navigation.navigate('Drawings', { projectId: item._id })}>
                            <MaterialCommunityIcons name="floor-plan" size={14} color="#10B981" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.miniBtn} onPress={() => openEditModal(item)}>
                            <MaterialCommunityIcons name="pencil" size={14} color="#F59E0B" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <WorkerHeader title="Projects" />

            <View style={styles.stickyHeader}>
                <View style={styles.headerTopRow}>
                    <View style={styles.ultraCompactSearchBox}>
                        <MaterialCommunityIcons name="magnify" size={16} color="#94A3B8" />
                        <TextInput
                            style={styles.tinySearchInput}
                            placeholder="Search projects..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {/* Filter Toolbar */}
                <View style={styles.compactToolbar}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={['ALL', 'ACTIVE', 'PRE-CON', 'HOLD', 'DONE']}
                        keyExtractor={i => i}
                        contentContainerStyle={styles.tinyFilterList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.tinyFilterChip, activeStatus === item && styles.tinyFilterChipActive]}
                                onPress={() => setActiveStatus(item)}
                            >
                                <Text style={[styles.tinyFilterChipText, activeStatus === item && styles.tinyFilterChipTextActive]}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            <Animated.FlatList
                data={filteredProjects}
                keyExtractor={(item, index) => item?._id ? `pmjob-${item._id}-${index}` : (item?.id ? `pmjob-${item.id}-${index}` : `idx-${index}`)}
                renderItem={renderProjectItem}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <MaterialCommunityIcons name="office-building" size={60} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No projects found in this portfolio</Text>
                    </View>
                }
            />

            {/* Edit Project Modal */}
            <Modal visible={isEditModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Project</Text>
                            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalForm}>
                            <Text style={styles.inputLabel}>Project Name</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Enter project name"
                            />

                            <Text style={styles.inputLabel}>Location</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editLocation}
                                onChangeText={setEditLocation}
                                placeholder="Enter location"
                            />

                            <Text style={styles.inputLabel}>Budget ($)</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editBudget}
                                onChangeText={setEditBudget}
                                placeholder="Enter budget"
                                keyboardType="numeric"
                            />

                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleUpdate}
                                disabled={isUpdating}
                            >
                                {isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    stickyHeader: {
        paddingHorizontal: SPACING.m,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 10
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    ultraCompactSearchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 10,
        height: 38,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    tinySearchInput: { flex: 1, marginLeft: 6, fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },

    compactToolbar: { marginTop: 2 },
    tinyFilterList: { gap: 6 },
    tinyFilterChip: { paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
    tinyFilterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    tinyFilterChipText: { fontSize: 9, fontWeight: '900', color: COLORS.textSecondary },
    tinyFilterChipTextActive: { color: COLORS.white },

    scroll: { paddingHorizontal: SPACING.m, paddingTop: 12, paddingBottom: 100 },

    ultraCompactRow: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusBtn,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    topSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    mainInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.s },
    indicatorLine: { width: 3, height: 20, borderRadius: 2 },
    tinyName: { fontSize: 13, fontWeight: '900', color: COLORS.textPrimary },
    tinyLoc: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },

    metricInfo: { alignItems: 'flex-end', gap: 2 },
    tinyBudget: { fontSize: 11, fontWeight: '900', color: '#10B981' },
    tinyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    tinyBadgeText: { fontSize: 8, fontWeight: '900' },

    bottomSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 6 },
    clientProgress: { flex: 1 },
    tinyClient: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary },
    tinyProgress: { fontSize: 10, fontWeight: '900', color: '#3B82F6' },

    miniActionStrip: { flexDirection: 'row', gap: 6 },
    miniBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border },

    emptyWrap: { alignItems: 'center', marginTop: 80, gap: 16 },
    emptyText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: SIZES.radiusModal, borderTopRightRadius: SIZES.radiusModal, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
    modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
    modalForm: { gap: 16 },
    inputLabel: { fontSize: 12, fontWeight: '900', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
    modalInput: { backgroundColor: COLORS.background, borderRadius: SIZES.radiusBtn, height: 48, paddingHorizontal: SPACING.m, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.m },
    saveBtn: { backgroundColor: '#2563EB', height: 50, borderRadius: SIZES.radiusBtn, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
});

export default ProjectManagerJobsScreen;
