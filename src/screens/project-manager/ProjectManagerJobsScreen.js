import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, Image, Dimensions, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
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
        const matchesSearch = proj.name?.toLowerCase().includes(search.toLowerCase()) ||
            proj.location?.toLowerCase().includes(search.toLowerCase());

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
        setEditLocation(project.location || '');
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
            'completed': { label: 'DONE', color: '#64748B', bg: '#F8FAFC' },
            'on-hold': { label: 'HOLD', color: '#FACC15', bg: '#FEFCE8' }
        };
        const config = statusConfig[item.status] || { label: '???', color: '#64748B', bg: '#F8FAFC' };

        return (
            <View style={[styles.ultraCompactRow, SHADOWS.small]}>
                <View style={styles.topSection}>
                    <View style={styles.mainInfo}>
                        <View style={[styles.indicatorLine, { backgroundColor: config.color }]} />
                        <View>
                            <Text style={[styles.tinyName, { fontSize: width < 380 ? 12 : 13 }]} numberOfLines={1} adjustsFontSizeToFit>{item.name}</Text>
                            <Text style={styles.tinyLoc} numberOfLines={1}>{item.location || 'Site'}</Text>
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
                        <TouchableOpacity style={styles.miniBtn} onPress={() => navigation.navigate('PMProjectDetail', { projectId: item._id })}>
                            <MaterialCommunityIcons name="eye" size={14} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.miniBtn} onPress={() => openEditModal(item)}>
                            <MaterialCommunityIcons name="pencil" size={14} color="#F59E0B" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
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
                keyExtractor={item => item._id || item.id}
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    stickyHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    ultraCompactSearchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        height: 38,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tinySearchInput: { flex: 1, marginLeft: 6, fontSize: 12, fontWeight: '600', color: '#1E293B' },

    compactToolbar: { marginTop: 2 },
    tinyFilterList: { gap: 6 },
    tinyFilterChip: { paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    tinyFilterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    tinyFilterChipText: { fontSize: 9, fontWeight: '900', color: '#64748B' },
    tinyFilterChipTextActive: { color: '#fff' },

    scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },

    ultraCompactRow: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    topSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    mainInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
    indicatorLine: { width: 3, height: 20, borderRadius: 2 },
    tinyName: { fontSize: 13, fontWeight: '900', color: '#1E293B' },
    tinyLoc: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },

    metricInfo: { alignItems: 'flex-end', gap: 2 },
    tinyBudget: { fontSize: 11, fontWeight: '900', color: '#10B981' },
    tinyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    tinyBadgeText: { fontSize: 8, fontWeight: '900' },

    bottomSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 6 },
    clientProgress: { flex: 1 },
    tinyClient: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    tinyProgress: { fontSize: 10, fontWeight: '900', color: '#3B82F6' },

    miniActionStrip: { flexDirection: 'row', gap: 6 },
    miniBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#E2E8F0' },

    emptyWrap: { alignItems: 'center', marginTop: 80, gap: 16 },
    emptyText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    modalForm: { gap: 16 },
    inputLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 12, height: 48, paddingHorizontal: 16, fontSize: 14, fontWeight: '600', color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    saveBtn: { backgroundColor: '#2563EB', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

export default ProjectManagerJobsScreen;
