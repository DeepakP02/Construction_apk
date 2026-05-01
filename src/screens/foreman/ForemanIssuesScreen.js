import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, Modal, TextInput, Alert, ScrollView,
    Dimensions, StatusBar, SafeAreaView, RefreshControl, useWindowDimensions,
    Image, Platform, KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl } from '../../utils/api';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ForemanIssuesScreen = ({ navigation, route }) => {
    const { issues, projects, refreshData } = useApp();
    const focusedProjectId = String(route?.params?.projectId || '');
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 380;
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const STATUS_FILTERS = [
        { label: 'All', value: 'All' },
        { label: 'Open', value: 'open' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' }
    ];
    
    // Create Issue State
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'Medium',
        projectId: null,
        location: '',
        attachments: []
    });

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your photos to attach them.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.4,
            base64: false
        });

        if (!result.canceled) {
            const newPhoto = result.assets[0].uri;
            setForm(prev => ({
                ...prev,
                attachments: [...prev.attachments, newPhoto]
            }));
        }
    };

    const removeImage = (index) => {
        setForm(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const filteredIssues = useMemo(() => {
        return (issues || []).filter(issue => {
            const issueProjectId = String(issue?.projectId?._id || issue?.projectId || '');
            const matchesProject = !focusedProjectId || issueProjectId === focusedProjectId;
            const matchesSearch = (issue.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (issue.description || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = selectedStatus === 'All' || issue.status === selectedStatus;
            return matchesProject && matchesSearch && matchesStatus;
        });
    }, [issues, searchQuery, selectedStatus, focusedProjectId]);

    const handleCreateIssue = async () => {
        if (!form.title || !form.projectId) {
            Alert.alert('Required', 'Please provide a title and select a project.');
            return;
        }

        try {
            setSubmitting(true);

            // Submit as multipart so backend stores issue images in `images`.
            const formData = new FormData();
            formData.append('title', form.title);
            formData.append('description', form.description || '');
            formData.append('priority', form.priority.toLowerCase());
            formData.append('projectId', form.projectId);
            formData.append('location', form.location || '');
            formData.append('status', 'open');
            formData.append('date', new Date().toISOString());

            (form.attachments || []).forEach((uri, idx) => {
                formData.append('images', {
                    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                    name: `issue_photo_${idx}_${Date.now()}.jpg`,
                    type: 'image/jpeg'
                });
            });

            await api.post('/issues', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setModalVisible(false);
            setForm({ title: '', description: '', priority: 'Medium', projectId: null, location: '', attachments: [] });
            await refreshData();
            Alert.alert('Success', 'Issue reported successfully');
        } catch (e) {
            console.error('Issue Submit Error:', e.response?.data || e.message);
            Alert.alert('Error', 'Failed to submit issue report');
        } finally {
            setSubmitting(false);
        }
    };

    const getPriorityColor = (p) => {
        switch (p?.toLowerCase()) {
            case 'high': return '#EF4444';
            case 'medium': return '#F59E0B';
            case 'low': return '#10B981';
            default: return '#64748B';
        }
    };
    const normalizeIssueImages = (issue) => {
        const toArray = (value) => {
            if (!value) return [];
            return Array.isArray(value) ? value : [value];
        };
        return [
            ...toArray(issue?.attachments),
            ...toArray(issue?.images),
            ...toArray(issue?.photoIds)
        ];
    };
    const resolveAttachmentUrl = (att) => {
        if (!att) return null;
        if (typeof att === 'string') return att;
        return att.url || att.imageUrl || att.uri || null;
    };

    const renderIssueItem = ({ item }) => {
        return (
            <TouchableOpacity 
                style={[styles.issueCard, SHADOWS.small, { borderRadius: moderateScale(24), marginBottom: verticalScale(16) }]} 
                activeOpacity={0.9}
                onPress={() => {
                    setSelectedIssue(item);
                    setDetailModalVisible(true);
                }}
            >
                <View style={[styles.priorityTab, { backgroundColor: getPriorityColor(item.priority), width: scale(6) }]} />
                <View style={[styles.cardInfo, { padding: moderateScale(20) }]}>
                    <View style={styles.cardMainRow}>
                        <View style={{ flex: 1 }}>
                            <View style={[styles.cardHeader, { marginBottom: verticalScale(10) }]}>
                                <Text style={[styles.issueTitle, { fontSize: moderateScale(16) }]}>{item.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: item.status === 'Resolved' ? '#F0FDF4' : '#FFF7ED', paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(8) }]}>
                                    <Text style={[styles.statusText, { color: item.status === 'Resolved' ? '#10B981' : '#EA580C', fontSize: moderateScale(9) }]}>
                                        {(item.status || 'OPEN').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            
                            <Text style={[styles.issueDesc, { fontSize: moderateScale(13), marginBottom: verticalScale(15), lineHeight: moderateScale(18) }]} numberOfLines={2}>{item.description || 'No additional details provided.'}</Text>
                        </View>
                    </View>
                    
                    <View style={[styles.cardFooter, { paddingTop: verticalScale(12), gap: scale(15) }]}>
                        <View style={[styles.footerItem, { gap: scale(4) }]}>
                            <MaterialCommunityIcons name="office-building" size={moderateScale(14)} color="#94A3B8" />
                            <Text style={[styles.footerText, { fontSize: moderateScale(10) }]}>{item.projectId?.name || 'Project Site'}</Text>
                        </View>
                        <View style={[styles.footerItem, { gap: scale(4) }]}>
                            <MaterialCommunityIcons name="calendar" size={moderateScale(14)} color="#94A3B8" />
                            <Text style={[styles.footerText, { fontSize: moderateScale(10) }]}>{new Date(item.date || Date.now()).toLocaleDateString()}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Issue List" />

            <View style={[styles.content, { paddingHorizontal: isTablet ? '10%' : (isCompact ? 14 : scale(20)), maxWidth: width >= 900 ? 980 : undefined, alignSelf: 'center', width: '100%' }]}>
                <View style={[styles.pageHeader, { marginTop: verticalScale(20), marginBottom: verticalScale(20) }]}>
                    <View>
                        <Text style={[styles.mainTitle, { fontSize: moderateScale(isCompact ? 22 : 26) }]}>Field Issues</Text>
                        <Text style={[styles.mainSubtitle, { fontSize: moderateScale(isCompact ? 12 : 13), marginTop: verticalScale(4) }]}>Report & track site issues</Text>
                    </View>
                    <TouchableOpacity style={[styles.addBtn, { paddingHorizontal: scale(isCompact ? 10 : 14), paddingVertical: verticalScale(isCompact ? 8 : 10), borderRadius: moderateScale(12), gap: scale(6) }]} onPress={() => setModalVisible(true)}>
                        <MaterialCommunityIcons name="alert-plus" size={moderateScale(18)} color="#fff" />
                        <Text style={[styles.addBtnText, { fontSize: moderateScale(12) }]}>Log Issue</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.filterBar, { marginBottom: verticalScale(20) }]}>
                    <View style={[styles.searchBox, { height: verticalScale(50), borderRadius: moderateScale(16), paddingHorizontal: scale(16), gap: scale(12) }]}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput 
                            placeholder="Search issues..."
                            placeholderTextColor="#94A3B8"
                            style={[styles.searchInput, { fontSize: moderateScale(14) }]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.statusFilterRow, { gap: scale(8), marginTop: verticalScale(10) }]}
                    >
                        {STATUS_FILTERS.map((st) => {
                            const active = selectedStatus === st.value;
                            return (
                                <TouchableOpacity
                                    key={st.value}
                                    style={[styles.statusFilterChip, active && styles.statusFilterChipActive]}
                                    onPress={() => setSelectedStatus(st.value)}
                                >
                                    <Text style={[styles.statusFilterChipText, active && styles.statusFilterChipTextActive]}>
                                        {st.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <FlatList
                    data={filteredIssues}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderIssueItem}
                    contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + verticalScale(80), verticalScale(100)) }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={[styles.empty, { padding: scale(60) }]}>
                            <MaterialCommunityIcons name="check-decagram-outline" size={moderateScale(64)} color="#E2E8F0" />
                            <Text style={[styles.emptyTxt, { fontSize: moderateScale(14), marginTop: verticalScale(15) }]}>No active issues found.</Text>
                        </View>
                    }
                />
            </View>

            {/* CREATE ISSUE MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={{ width: '100%' }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
                    >
                    <View style={[styles.modalSheet, { borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), height: '85%', paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.modalHandle} />
                        <View style={[styles.modalHeader, { paddingHorizontal: scale(20) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(22) }]}>Report Site Issue</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingHorizontal: scale(20), paddingBottom: 30 }}
                        >
                            <Text style={[styles.label, { fontSize: moderateScale(10), marginBottom: verticalScale(8), marginTop: verticalScale(16) }]}>ISSUE TITLE</Text>
                            <TextInput 
                                style={[styles.input, { height: verticalScale(50), borderRadius: moderateScale(14), paddingHorizontal: scale(16), fontSize: moderateScale(15) }]}
                                placeholder="e.g. Broken pipe in lobby"
                                value={form.title}
                                onChangeText={t => setForm({...form, title: t})}
                            />

                            <Text style={[styles.label, { fontSize: moderateScale(10), marginTop: verticalScale(16) }]}>SELECT PROJECT</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.projectRow, { marginTop: verticalScale(4) }]}>
                                {projects.map(p => (
                                    <TouchableOpacity 
                                        key={p._id} 
                                        style={[styles.projChip, form.projectId === p._id && styles.projChipActive, { paddingHorizontal: scale(16), paddingVertical: verticalScale(10), borderRadius: moderateScale(12), marginRight: scale(10) }]}
                                        onPress={() => setForm({...form, projectId: p._id})}
                                    >
                                        <Text style={[styles.projChipText, { fontSize: moderateScale(12) }, form.projectId === p._id && { color: '#fff' }]}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={[styles.label, { fontSize: moderateScale(10), marginTop: verticalScale(16) }]}>SEVERITY LEVEL</Text>
                            <View style={[styles.priorityRow, { gap: scale(10), marginTop: verticalScale(4) }]}>
                                {['Low', 'Medium', 'High'].map(p => (
                                    <TouchableOpacity 
                                        key={p} 
                                        style={[styles.prioBtn, { height: verticalScale(44), borderRadius: moderateScale(12) }, form.priority === p && { backgroundColor: getPriorityColor(p), borderColor: getPriorityColor(p) }]}
                                        onPress={() => setForm({...form, priority: p})}
                                    >
                                        <Text style={[styles.prioBtnText, { fontSize: moderateScale(12) }, form.priority === p && { color: '#fff' }]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { fontSize: moderateScale(10), marginTop: verticalScale(20) }]}>DETAILED DESCRIPTION</Text>
                            <TextInput 
                                style={[styles.input, { height: verticalScale(100), textAlignVertical: 'top', paddingTop: verticalScale(12), borderRadius: moderateScale(14), paddingHorizontal: scale(16), marginTop: verticalScale(4) }]}
                                placeholder="Describe the issue in detail..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={form.description}
                                onChangeText={t => setForm({...form, description: t})}
                            />

                            <Text style={[styles.label, { fontSize: moderateScale(10), marginTop: verticalScale(20) }]}>ATTACH PHOTOS</Text>
                            <View style={[styles.photoSection, { marginTop: verticalScale(8) }]}>
                                <TouchableOpacity style={[styles.addPhotoBtn, SHADOWS.small]} onPress={pickImage}>
                                    <MaterialCommunityIcons name="camera-plus" size={32} color="#2563EB" />
                                    <Text style={[styles.addPhotoText, { color: '#2563EB' }]}>Add Photo</Text>
                                </TouchableOpacity>
                                
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {form.attachments.map((img, idx) => (
                                        <View key={idx} style={styles.photoWrapper}>
                                            <Image source={{ uri: img }} style={styles.photoPreview} />
                                            <TouchableOpacity style={styles.removePhoto} onPress={() => removeImage(idx)}>
                                                <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={[styles.createIssueActions, { marginTop: verticalScale(28), marginBottom: verticalScale(16) }]}>
                                <TouchableOpacity
                                    style={styles.createIssueCancelBtn}
                                    onPress={() => setModalVisible(false)}
                                    disabled={submitting}
                                >
                                    <Text style={styles.createIssueCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.submitBtn, SHADOWS.medium, { height: verticalScale(56), borderRadius: moderateScale(16), backgroundColor: '#2563EB' }, submitting && { opacity: 0.7 }]}
                                    onPress={handleCreateIssue}
                                    disabled={submitting}
                                >
                                    {submitting ? <ActivityIndicator color="#fff" /> : (
                                        <Text style={[styles.submitBtnText, { fontSize: moderateScale(14), fontWeight: '900' }]}>Submit Issue</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ISSUE DETAIL MODAL */}
            <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalSheet, { borderTopLeftRadius: moderateScale(32), borderTopRightRadius: moderateScale(32), height: '90%', paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.modalHandle} />
                        <View style={[styles.modalHeader, { paddingHorizontal: scale(20), paddingBottom: verticalScale(15) }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { fontSize: moderateScale(22), color: '#0F172A' }]}>Issue Details</Text>
                                <Text style={[styles.modalSubtitle, { fontSize: moderateScale(12), color: '#64748B' }]}>Reference #{String(selectedIssue?._id || '').slice(-6).toUpperCase()}</Text>
                            </View>
                            <TouchableOpacity 
                                style={[styles.closeModalBtn, { width: scale(36), height: scale(36), borderRadius: 18 }]} 
                                onPress={() => setDetailModalVisible(false)}
                            >
                                <MaterialCommunityIcons name="close" size={moderateScale(22)} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={{ paddingHorizontal: scale(20), paddingBottom: 40 }}
                        >
                            <View style={[styles.detailStatusRow, { marginBottom: verticalScale(20), marginTop: verticalScale(10) }]}>
                                <View style={[styles.statusBadge, { backgroundColor: (selectedIssue?.status || 'open') === 'resolved' ? '#F0FDF4' : '#FFF7ED', paddingHorizontal: scale(12), paddingVertical: verticalScale(6), borderRadius: 8 }]}>
                                    <Text style={[styles.statusText, { color: (selectedIssue?.status || 'open') === 'resolved' ? '#10B981' : '#EA580C', fontSize: moderateScale(11), fontWeight: '800' }]}>
                                        {(selectedIssue?.status || 'open').toUpperCase()}
                                    </Text>
                                </View>
                                <View style={[styles.detailPriority, { backgroundColor: getPriorityColor(selectedIssue?.priority) + '15', borderColor: getPriorityColor(selectedIssue?.priority), borderRadius: 8 }]}>
                                    <Text style={[styles.detailPriorityText, { color: getPriorityColor(selectedIssue?.priority), fontWeight: '900' }]}>
                                        {(selectedIssue?.priority || 'medium').toUpperCase()} PRIORITY
                                    </Text>
                                </View>
                            </View>

                            <Text style={[styles.detailTitle, { fontSize: moderateScale(20), lineHeight: moderateScale(26) }]}>{selectedIssue?.title}</Text>
                            
                            <View style={[styles.detailMetaRow, { marginBottom: verticalScale(24) }]}>
                                <View style={styles.detailMetaItem}>
                                    <View style={styles.metaIconBg}>
                                        <MaterialCommunityIcons name="office-building" size={16} color="#2563EB" />
                                    </View>
                                    <Text style={styles.detailMetaText}>{selectedIssue?.projectId?.name || 'Project Site'}</Text>
                                </View>
                                <View style={styles.detailMetaItem}>
                                    <View style={styles.metaIconBg}>
                                        <MaterialCommunityIcons name="calendar" size={16} color="#2563EB" />
                                    </View>
                                    <Text style={styles.detailMetaText}>{new Date(selectedIssue?.date || Date.now()).toLocaleDateString()}</Text>
                                </View>
                            </View>

                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionLabel}>DESCRIPTION</Text>
                                <View style={styles.descriptionCard}>
                                    <Text style={styles.detailDescription}>{selectedIssue?.description || 'No additional details provided.'}</Text>
                                </View>
                            </View>

                            {(normalizeIssueImages(selectedIssue).length > 0) && (
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailSectionLabel}>ATTACHED PHOTOS ({normalizeIssueImages(selectedIssue).length})</Text>
                                    <View style={styles.detailPhotoGrid}>
                                        {normalizeIssueImages(selectedIssue).map((img, idx) => {
                                            const imgUrl = resolveAttachmentUrl(img);
                                            if (!imgUrl) return null;
                                            return (
                                                <TouchableOpacity 
                                                    key={idx} 
                                                    style={[styles.detailPhotoWrapper, SHADOWS.small]}
                                                    onPress={() => setPreviewImage(getServerUrl(imgUrl))}
                                                    activeOpacity={0.8}
                                                >
                                                    <Image source={{ uri: getServerUrl(imgUrl) }} style={styles.detailPhoto} />
                                                    <View style={styles.zoomOverlay}>
                                                        <MaterialCommunityIcons name="magnify-plus" size={20} color="#fff" />
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* FULL IMAGE PREVIEW MODAL */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <View style={styles.previewOverlay}>
                    <TouchableOpacity 
                        style={styles.closePreview} 
                        onPress={() => setPreviewImage(null)}
                    >
                        <MaterialCommunityIcons name="close" size={32} color="#fff" />
                    </TouchableOpacity>
                    <Image 
                        source={{ uri: previewImage }} 
                        style={styles.fullPreviewImage} 
                        resizeMode="contain" 
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    content: { flex: 1 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mainTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { color: '#64748B', fontWeight: '800' },
    addBtn: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center' },
    addBtnText: { color: '#fff', fontWeight: '900' },
    filterBar: { },
    statusFilterRow: { paddingRight: scale(10) },
    statusFilterChip: {
        minHeight: verticalScale(40),
        borderRadius: moderateScale(12),
        paddingHorizontal: scale(14),
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center'
    },
    statusFilterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    statusFilterChipText: { fontSize: moderateScale(12), fontWeight: '800', color: '#64748B' },
    statusFilterChipTextActive: { color: '#fff' },
    searchBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, fontWeight: '700', color: '#1E293B' },
    list: { },
    issueCard: { backgroundColor: '#fff', flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    priorityTab: { },
    cardInfo: { flex: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    issueTitle: { fontWeight: '900', color: '#0F172A', flex: 1, marginRight: 10 },
    statusBadge: { },
    statusText: { fontWeight: '900' },
    issueDesc: { color: '#64748B', fontWeight: '500' },
    cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    footerItem: { flexDirection: 'row', alignItems: 'center' },
    footerText: { fontWeight: '800', color: '#94A3B8' },
    empty: { alignItems: 'center' },
    emptyTxt: { fontWeight: '700', color: '#CBD5E1' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#fff', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
    modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, alignSelf: 'center', marginVertical: 12 },
    modalContent: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { color: '#64748B', fontWeight: '700', marginTop: 2 },
    label: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '700', color: '#1E293B' },
    projectRow: { flexDirection: 'row' },
    projChip: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    projChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    projChipText: { fontWeight: '800', color: '#64748B' },
    priorityRow: { flexDirection: 'row' },
    prioBtn: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    prioBtnText: { fontWeight: '900', color: '#64748B' },
    submitBtn: { backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
    createIssueActions: { flexDirection: 'row', gap: scale(10), alignItems: 'center' },
    createIssueCancelBtn: { flex: 1, height: verticalScale(56), borderRadius: moderateScale(16), backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    createIssueCancelText: { color: '#475569', fontWeight: '900', textTransform: 'uppercase', fontSize: moderateScale(12) },

    // Photo Section Styles
    photoSection: { flexDirection: 'row', marginTop: 10, gap: 12, alignItems: 'center' },
    addPhotoBtn: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#F8FAFC', borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    addPhotoText: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
    photoList: { flex: 1 },
    photoWrapper: { position: 'relative', marginRight: 12 },
    photoPreview: { width: 100, height: 100, borderRadius: 16 },
    removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 },

    // Issue Card Image Styles
    cardMainRow: { flexDirection: 'row', gap: 12 },
    thumbnailWrapper: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F1F5F9' },
    thumbnail: { width: '100%', height: '100%' },
    photoCountBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    photoCountText: { color: '#fff', fontSize: 10, fontWeight: '900' },

    // Preview Styles
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullPreviewImage: { width: '100%', height: '80%' },
    closePreview: { position: 'absolute', top: 50, right: 20, zIndex: 100 },

    // Detail Modal Styles
    closeModalBtn: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    detailStatusRow: { flexDirection: 'row', gap: 12 },
    detailPriority: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    detailPriorityText: { fontSize: 10, fontWeight: '900' },
    detailTitle: { fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    detailMetaRow: { flexDirection: 'row', gap: 20 },
    detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    detailMetaText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    detailSection: { marginBottom: 28 },
    detailSectionLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
    descriptionCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    detailDescription: { fontSize: 15, color: '#334155', lineHeight: 24, fontWeight: '500' },
    detailPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detailPhotoWrapper: { width: '47%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F1F5F9' },
    detailPhoto: { width: '100%', height: '100%' },
    zoomOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }
});

export default ForemanIssuesScreen;
