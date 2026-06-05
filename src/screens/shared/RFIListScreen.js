import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ScrollView, StatusBar, SafeAreaView, TextInput, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, TouchableWithoutFeedback, Keyboard, RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import api, { uploadMultipart } from '../../utils/api';
import { canCreateRFI, canManageRFI } from '../../utils/rfiPermissions';

const RFIListScreen = ({ navigation }) => {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = width < 380;
    const modalMaxWidth = Math.min(width - 16, 860);
    const modalMaxHeight = Math.min(height * 0.9, 780);
    const { rfis, projects, teamMembers, user, refreshData } = useApp();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProject, setSelectedProject] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPriority, setSelectedPriority] = useState('all');
    const [showFilterModal, setShowFilterModal] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [files, setFiles] = useState([]);
    const [formData, setFormData] = useState({
        projectId: '',
        subject: '',
        description: '',
        location: '',
        category: 'other',
        priority: 'medium',
        assignedTo: '',
        dueDate: ''
    });
    const normalizeId = (v) =>
        String(v?._id || v?.id || v?.$oid || v?.toString?.() || v || '');
    const normalizeRole = (r) => String(r || '').toUpperCase();

    const canManage = canManageRFI(user?.role);
    const canCreate = canCreateRFI(user?.role);

    useEffect(() => {
        const fetchAssignableUsers = async () => {
            if (!canCreate) return;
            try {
                const res = await api.get('/auth/users');
                const users = (Array.isArray(res.data) ? res.data : []).filter(u =>
                    ['PM', 'COMPANY_OWNER', 'FOREMAN'].includes(normalizeRole(u.role))
                );
                setAssignableUsers(users);
            } catch (e) {
                setAssignableUsers([]);
            }
        };
        fetchAssignableUsers();
    }, [canCreate]);

    const getRfiCategory = (r) => String(r?.category || r?.rfiCategory || r?.type || 'other');
    const getRfiAssignedId = (r) => r?.assignedTo || r?.assigned_to || r?.assignee || '';
    const filteredRFIs = useMemo(() => {
        return (rfis || []).filter(r => {
            const matchesSearch =
                r.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.rfiNumber?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesProject =
                selectedProject === 'all' ||
                normalizeId(r.projectId) === normalizeId(selectedProject);
            const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
            const matchesPriority = selectedPriority === 'all' || r.priority === selectedPriority;
            return matchesSearch && matchesProject && matchesStatus && matchesPriority;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [rfis, searchQuery, selectedProject, selectedStatus, selectedPriority]);

    const handleSubmit = async () => {
        if (!formData.projectId || !formData.subject || !formData.description) {
            Alert.alert('Required Fields', 'Please fill in Project, Subject, and Description.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (value === '' || value == null) return;
                if (key === 'category') payload.append(key, String(value).toLowerCase());
                else if (key === 'assignedTo') payload.append(key, String(value));
                else payload.append(key, value);
            });
            files.forEach((file, index) => {
                payload.append('files', {
                    uri: file.uri,
                    name: file.name || `attachment-${index + 1}`,
                    type: file.mimeType || 'application/octet-stream',
                });
            });
            const res = await uploadMultipart('/rfis', payload);
            await refreshData?.();
            setShowCreateModal(false);
            setFormData({
                projectId: '',
                subject: '',
                description: '',
                location: '',
                category: 'other',
                priority: 'medium',
                assignedTo: '',
                dueDate: ''
            });
            setFiles([]);
            Alert.alert('Success', 'RFI submitted successfully');
            if (res?.data?._id) navigation.navigate('RFIDetail', { rfiId: res.data._id });
        } catch (e) {
            Alert.alert('Error', 'Failed to submit RFI');
        } finally {
            setSubmitting(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshData?.();
        } finally {
            setRefreshing(false);
        }
    };

    const pickFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                multiple: true,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;
            setFiles((prev) => [...prev, ...result.assets]);
        } catch {
            Alert.alert('Error', 'Could not pick files');
        }
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleStatusChange = async (rfi) => {
        if (!canManage) return;
        const options = ['open', 'in_review', 'answered', 'closed'];
        const labels = ['Open', 'In Review', 'Answered', 'Closed'];
        Alert.alert('Update Status', 'Change this RFI status to:', [
            ...options.map((s, i) => ({
                text: labels[i],
                onPress: async () => {
                    try {
                        await api.patch(`/rfis/${rfi._id}`, { status: s });
                        refreshData && await refreshData();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to update status');
                    }
                }
            })),
            { text: 'Cancel', style: 'cancel' }
        ]);
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'open': return { bg: '#EFF6FF', color: '#3B82F6', label: 'Open' };
            case 'answered': return { bg: '#F5F3FF', color: '#8B5CF6', label: 'Answered' };
            case 'closed': return { bg: '#ECFDF5', color: '#10B981', label: 'Closed' };
            case 'in_review': return { bg: '#FFFBEB', color: '#F59E0B', label: 'In Review' };
            default: return { bg: '#F1F5F9', color: '#64748B', label: status };
        }
    };

    const getPriorityStyles = (p) => {
        switch (p) {
            case 'low': return { bg: '#ECFDF5', color: '#10B981', label: 'Low' };
            case 'medium': return { bg: '#FFFBEB', color: '#F59E0B', label: 'Medium' };
            case 'high': return { bg: '#FEF2F2', color: '#EF4444', label: 'High' };
            default: return { bg: '#F1F5F9', color: '#64748B', label: p };
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const renderRFICard = ({ item }) => {
        const statusSt = getStatusStyles(item.status);
        const prioritySt = getPriorityStyles(item.priority);
        const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'closed';
        const projName = typeof item.projectId === 'object'
            ? item.projectId?.name
            : (projects || []).find(p => p._id === item.projectId)?.name || '—';
        const raisedBy = typeof item.raisedBy === 'object'
            ? item.raisedBy?.fullName
            : (teamMembers || []).find(u => u._id === item.raisedBy)?.fullName || '—';
        const rawAssigned = getRfiAssignedId(item);
        const assignedTo = typeof rawAssigned === 'object'
            ? rawAssigned?.fullName
            : (teamMembers || []).find(u => normalizeId(u) === normalizeId(rawAssigned))?.fullName ||
              (assignableUsers || []).find(u => normalizeId(u) === normalizeId(rawAssigned))?.fullName ||
              'Unassigned';

        return (
            <View style={[styles.rfiCard, SHADOWS.small, isOverdue && styles.rfiCardOverdue]}>
                {/* Priority Strip */}
                <View style={[styles.priorityStrip, { backgroundColor: prioritySt.color }]} />

                <View style={styles.cardBody}>
                    {/* Top Row: RFI Number + Status */}
                    <View style={styles.cardTopRow}>
                        <View style={styles.rfiNumWrap}>
                            <Text style={styles.rfiNum}>{item.rfiNumber || 'RFI-XXXX'}</Text>
                            {isOverdue && (
                                <View style={styles.overdueChip}>
                                    <MaterialCommunityIcons name="clock-alert" size={11} color="#EF4444" />
                                    <Text style={styles.overdueChipTxt}>OVERDUE</Text>
                                </View>
                            )}
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: statusSt.bg }]}>
                            <Text style={[styles.statusPillTxt, { color: statusSt.color }]}>{statusSt.label}</Text>
                        </View>
                    </View>

                    {/* Subject */}
                    <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>

                    {/* Project */}
                    <View style={styles.projectRow}>
                        <MaterialCommunityIcons name="office-building-outline" size={13} color="#64748B" />
                        <Text style={styles.projectName} numberOfLines={1}>{projName}</Text>
                    </View>

                    <View style={styles.divider} />

                    {/* Info Grid: 2 columns */}
                    <View style={styles.infoGrid}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>RAISED BY</Text>
                            <Text style={styles.infoVal} numberOfLines={1}>{raisedBy}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>ASSIGNED TO</Text>
                            <Text style={[styles.infoVal, { color: assignedTo === 'Unassigned' ? '#94A3B8' : '#1E293B' }]} numberOfLines={1}>
                                {assignedTo}
                            </Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>PRIORITY</Text>
                            <View style={[styles.priorityPill, { backgroundColor: prioritySt.bg }]}>
                                <Text style={[styles.priorityPillTxt, { color: prioritySt.color }]}>{prioritySt.label}</Text>
                            </View>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>DUE DATE</Text>
                            <Text style={[styles.infoVal, isOverdue && { color: '#EF4444', fontWeight: '800' }]}>
                                {formatDate(item.dueDate)}
                            </Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>CREATED</Text>
                            <Text style={styles.infoVal}>{formatDate(item.createdAt)}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>CATEGORY</Text>
                            <Text style={styles.infoVal}>{getRfiCategory(item)}</Text>
                        </View>
                    </View>

                    {/* Action Row */}
                    <View style={styles.actionRow}>
                        {canManage && (
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => handleStatusChange(item)}
                            >
                                <MaterialCommunityIcons name="swap-horizontal" size={15} color="#2563EB" />
                                <Text style={styles.actionBtnTxt}>Update Status</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={[styles.actionBtn, styles.actionBtnGhost]}
                            onPress={() => navigation.navigate('RFIDetail', { rfiId: item._id })}
                        >
                            <MaterialCommunityIcons name="eye-outline" size={15} color="#64748B" />
                            <Text style={[styles.actionBtnTxt, { color: '#64748B' }]}>View</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="All RFIs" showBranding={true} showBack={true} />

            {/* Header */}
            <View style={styles.pageHeader}>
                <View>
                    <Text style={styles.pageTitle}>All RFIs</Text>
                    <Text style={styles.pageSubtitle}>Filter, search and manage all requests</Text>
                </View>
                <View style={styles.headerActions}>
                    {canCreate && (
                        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreateModal(true)}>
                            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                            <Text style={styles.newBtnTxt}>New RFI</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filters Bar */}
            <View style={styles.filtersBar}>
                <View style={styles.searchBox}>
                    <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by subject or RFI#..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                    <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowFilterModal('project')}>
                        <Text style={styles.filterDropdownTxt} numberOfLines={1}>
                            {selectedProject === 'all' ? 'All Projects' : (projects || []).find(p => p._id === selectedProject)?.name || 'Project'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowFilterModal('status')}>
                        <Text style={styles.filterDropdownTxt}>
                            {selectedStatus === 'all' ? 'All Statuses' : getStatusStyles(selectedStatus).label}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowFilterModal('priority')}>
                        <Text style={styles.filterDropdownTxt}>
                            {selectedPriority === 'all' ? 'All Priorities' : getPriorityStyles(selectedPriority).label}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Count Badge */}
            <View style={styles.countRow}>
                <Text style={styles.countText}>{filteredRFIs.length} RFI{filteredRFIs.length !== 1 ? 's' : ''} found</Text>
            </View>

            {/* List */}
            <FlatList
                data={filteredRFIs}
                keyExtractor={(item, index) => item._id ? `rfi-${item._id}-${index}` : `rfi-idx-${index}`}
                renderItem={renderRFICard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <MaterialCommunityIcons name="file-search-outline" size={56} color="#E2E8F0" />
                        <Text style={styles.emptyTitle}>No RFIs Found</Text>
                        <Text style={styles.emptySubtitle}>Try adjusting your filters or create a new RFI</Text>
                    </View>
                }
            />

            {/* CREATE MODAL */}
            <Modal visible={showCreateModal} animationType="slide" transparent statusBarTranslucent presentationStyle="overFullScreen">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                    <View style={[styles.modalCard, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isSmallScreen ? 16 : 24 }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Create New RFI</Text>
                                <Text style={styles.modalSubtitle}>Submit a Request for Information</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                        >
                            <Text style={styles.inputLabel}>Select Project *</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
                                {(projects || []).map(p => (
                                    <TouchableOpacity
                                        key={p._id}
                                        style={[styles.chip, formData.projectId === p._id && styles.chipActive]}
                                        onPress={() => setFormData({ ...formData, projectId: p._id })}
                                    >
                                        <Text style={[styles.chipTxt, formData.projectId === p._id && styles.chipTxtActive]}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Subject *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Brief title of the request..."
                                value={formData.subject}
                                onChangeText={t => setFormData({ ...formData, subject: t })}
                            />

                            <Text style={styles.inputLabel}>Description *</Text>
                            <TextInput
                                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Detailed description of the information needed..."
                                value={formData.description}
                                onChangeText={t => setFormData({ ...formData, description: t })}
                            />

                            <Text style={styles.inputLabel}>Location (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Level 3, Grid B-4"
                                value={formData.location}
                                onChangeText={t => setFormData({ ...formData, location: t })}
                            />

                            <Text style={styles.inputLabel}>Category (Optional)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
                                {['design', 'structural', 'mechanical', 'electrical', 'civil', 'safety', 'material', 'other'].map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.chip, formData.category === cat && styles.chipActive]}
                                        onPress={() => setFormData({ ...formData, category: cat })}
                                    >
                                        <Text style={[styles.chipTxt, formData.category === cat && styles.chipTxtActive]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Priority</Text>
                            <View style={styles.selectorRow}>
                                {['low', 'medium', 'high'].map(p => {
                                    const st = getPriorityStyles(p);
                                    return (
                                        <TouchableOpacity
                                            key={p}
                                            style={[styles.selectorBtn, formData.priority === p && { backgroundColor: st.color, borderColor: st.color }]}
                                            onPress={() => setFormData({ ...formData, priority: p })}
                                        >
                                            <Text style={[styles.selectorBtnTxt, formData.priority === p && { color: '#fff' }]}>{st.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Assign To</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
                                <TouchableOpacity
                                    style={[styles.chip, !formData.assignedTo && styles.chipActive]}
                                    onPress={() => setFormData({ ...formData, assignedTo: '' })}
                                >
                                    <Text style={[styles.chipTxt, !formData.assignedTo && styles.chipTxtActive]}>Unassigned</Text>
                                </TouchableOpacity>
                                {assignableUsers.map(u => (
                                    <TouchableOpacity
                                        key={u._id || u.id}
                                        style={[styles.chip, formData.assignedTo === (u._id || u.id) && styles.chipActive]}
                                            onPress={() => setFormData({ ...formData, assignedTo: normalizeId(u) })}
                                    >
                                        <Text style={[styles.chipTxt, normalizeId(formData.assignedTo) === normalizeId(u) && styles.chipTxtActive]}>
                                            {u.fullName}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Due Date (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD"
                                value={formData.dueDate}
                                onChangeText={t => setFormData({ ...formData, dueDate: t })}
                            />

                            <Text style={styles.inputLabel}>Attachments</Text>
                            <TouchableOpacity style={styles.attachDropzone} onPress={pickFiles}>
                                <MaterialCommunityIcons name="upload" size={18} color="#94A3B8" />
                                <Text style={styles.attachTitle}>Click to upload files</Text>
                                <Text style={styles.attachSub}>PDF, DWG, Images, etc.</Text>
                            </TouchableOpacity>
                            {files.length > 0 ? (
                                <View style={{ marginTop: 10, gap: 8 }}>
                                    {files.map((file, idx) => (
                                        <View key={`${file.uri}-${idx}`} style={styles.fileRow}>
                                            <Text style={styles.fileName} numberOfLines={1}>{file.name || `Attachment ${idx + 1}`}</Text>
                                            <TouchableOpacity onPress={() => removeFile(idx)}>
                                                <MaterialCommunityIcons name="close" size={16} color="#64748B" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? <ActivityIndicator color="#fff" /> : (
                                    <Text style={styles.submitBtnTxt}>SUBMIT RFI</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* FILTER SELECTION MODAL */}
            <Modal visible={!!showFilterModal} transparent animationType="fade">
                <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterModal(null)}>
                    <View style={styles.filterModalBox}>
                        <Text style={styles.filterModalTitle}>
                            Select {showFilterModal?.charAt(0).toUpperCase()}{showFilterModal?.slice(1)}
                        </Text>
                        <ScrollView>
                            <TouchableOpacity
                                style={styles.filterOption}
                                onPress={() => {
                                    if (showFilterModal === 'project') setSelectedProject('all');
                                    if (showFilterModal === 'status') setSelectedStatus('all');
                                    if (showFilterModal === 'priority') setSelectedPriority('all');
                                    setShowFilterModal(null);
                                }}
                            >
                                <Text style={styles.filterOptionTxt}>All {showFilterModal}s</Text>
                                {((showFilterModal === 'project' && selectedProject === 'all') ||
                                    (showFilterModal === 'status' && selectedStatus === 'all') ||
                                    (showFilterModal === 'priority' && selectedPriority === 'all')) &&
                                    <MaterialCommunityIcons name="check" size={18} color="#2563EB" />
                                }
                            </TouchableOpacity>

                            {showFilterModal === 'project' && (projects || []).map(p => (
                                <TouchableOpacity key={p._id} style={styles.filterOption}
                                    onPress={() => { setSelectedProject(p._id); setShowFilterModal(null); }}>
                                    <Text style={styles.filterOptionTxt}>{p.name}</Text>
                                    {selectedProject === p._id && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}

                            {showFilterModal === 'status' && ['open', 'in_review', 'answered', 'closed'].map(s => (
                                <TouchableOpacity key={s} style={styles.filterOption}
                                    onPress={() => { setSelectedStatus(s); setShowFilterModal(null); }}>
                                    <Text style={styles.filterOptionTxt}>{getStatusStyles(s).label}</Text>
                                    {selectedStatus === s && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}

                            {showFilterModal === 'priority' && ['low', 'medium', 'high'].map(p => (
                                <TouchableOpacity key={p} style={styles.filterOption}
                                    onPress={() => { setSelectedPriority(p); setShowFilterModal(null); }}>
                                    <Text style={styles.filterOptionTxt}>{getPriorityStyles(p).label}</Text>
                                    {selectedPriority === p && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    pageTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    pageSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '800', marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, gap: 6 },
    newBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },

    filtersBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1E293B' },
    filterChips: { flexDirection: 'row', gap: 8 },
    filterDropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, minHeight: 44, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    filterDropdownTxt: { fontSize: 12, fontWeight: '800', color: '#64748B', maxWidth: 160, flexShrink: 1 },

    countRow: { paddingHorizontal: 20, paddingVertical: 10 },
    countText: { fontSize: 12, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },

    listContent: { paddingHorizontal: 16, paddingBottom: 100 },

    rfiCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    rfiCardOverdue: { borderColor: '#FEE2E2' },
    priorityStrip: { width: 5 },
    cardBody: { flex: 1, padding: 16 },

    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    rfiNumWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rfiNum: { fontSize: 13, fontWeight: '900', color: '#2563EB', letterSpacing: 0.5 },
    overdueChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    overdueChipTxt: { fontSize: 9, fontWeight: '900', color: '#EF4444' },

    statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusPillTxt: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

    subject: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 8, lineHeight: 22 },
    projectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
    projectName: { fontSize: 12, fontWeight: '700', color: '#64748B' },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 },

    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
    infoCol: { minWidth: '40%' },
    infoLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
    infoVal: { fontSize: 13, fontWeight: '800', color: '#1E293B' },

    priorityPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    priorityPillTxt: { fontSize: 10, fontWeight: '900' },

    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 6 },
    actionBtnGhost: { backgroundColor: '#F8FAFC' },
    actionBtnTxt: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

    emptyWrap: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: '#94A3B8', marginTop: 16 },
    emptySubtitle: { fontSize: 13, fontWeight: '700', color: '#CBD5E1', marginTop: 6, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    modalSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '700', marginTop: 4 },

    inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '700', color: '#1E293B' },
    chipList: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    chipTxt: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    chipTxtActive: { color: '#fff' },

    selectorRow: { flexDirection: 'row', gap: 10 },
    selectorBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    selectorBtnTxt: { fontSize: 13, fontWeight: '900', color: '#64748B' },
    attachDropzone: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#CBD5E1',
        borderRadius: 14,
        minHeight: 90,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        marginTop: 2
    },
    attachTitle: { fontSize: 12, fontWeight: '800', color: '#475569', marginTop: 6 },
    attachSub: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 3 },
    fileRow: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10
    },
    fileName: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '700' },

    submitBtn: { height: 58, backgroundColor: '#2563EB', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
    submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

    // Filter modal
    filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 30 },
    filterModalBox: { backgroundColor: '#fff', borderRadius: 24, padding: 20, maxHeight: 400 },
    filterModalTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
    filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    filterOptionTxt: { fontSize: 15, fontWeight: '700', color: '#475569' },
});

export default RFIListScreen;
