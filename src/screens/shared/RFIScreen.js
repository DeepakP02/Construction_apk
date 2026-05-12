import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, useWindowDimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import { canCreateRFI } from '../../utils/rfiPermissions';

const RFI_CATEGORIES = ['design', 'structural', 'mechanical', 'electrical', 'civil', 'safety', 'material', 'other'];

const RFIScreen = ({ navigation }) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isCompactLayout = windowWidth < 700;
    const isSmallScreen = windowWidth < 380;
    const modalMaxWidth = Math.min(windowWidth - 16, 900);
    const modalMaxHeight = Math.min(windowHeight * 0.9, 760);
    const { user, projects, refreshData } = useApp();
    const allowCreateRFI = canCreateRFI(user?.role);
    const [rfis, setRfis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Create RFI Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isSelectingProject, setIsSelectingProject] = useState(false);
    const [isSelectingCategory, setIsSelectingCategory] = useState(false);
    const [isSelectingAssignee, setIsSelectingAssignee] = useState(false);
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [files, setFiles] = useState([]);
    const [showIOSDatePicker, setShowIOSDatePicker] = useState(false);
    const [dueDateValue, setDueDateValue] = useState(null);
    const [form, setForm] = useState({
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

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/rfis');
            setRfis(res.data || []);
        } catch (e) {
            console.error('Fetch RFI error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchData();
        });
        return unsubscribe;
    }, [navigation, fetchData]);

    useEffect(() => {
        const fetchAssignableUsers = async () => {
            if (!allowCreateRFI) {
                setAssignableUsers([]);
                return;
            }
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
    }, [allowCreateRFI]);

    const resetCreateForm = () => {
        setForm({
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
        setDueDateValue(null);
        setShowIOSDatePicker(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const openCreateModal = () => {
        resetCreateForm();
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        resetCreateForm();
    };

    const pickFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                multiple: true,
                copyToCacheDirectory: true
            });
            if (result.canceled || !result.assets?.length) return;
            const MAX_SIZE = 50 * 1024 * 1024;
            const valid = [];
            const oversized = [];
            result.assets.forEach((f) => {
                if ((f.size || 0) > MAX_SIZE) oversized.push(f.name || 'File');
                else valid.push(f);
            });
            if (oversized.length > 0) {
                Alert.alert('File Too Large', `${oversized[0]} exceeds 50MB limit.`);
            }
            if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
        } catch (e) {
            Alert.alert('Error', 'Could not pick files');
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const formatDueDate = (value) => {
        if (!value) return 'dd/mm/yyyy';
        return new Date(value).toLocaleDateString();
    };

    const applyDueDate = (dateObj) => {
        if (!dateObj) return;
        setDueDateValue(dateObj);
        setForm(prev => ({ ...prev, dueDate: dateObj.toISOString() }));
    };

    const openDueDatePicker = () => {
        const current = dueDateValue || new Date();
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                mode: 'date',
                value: current,
                minimumDate: new Date(),
                onChange: (_, selectedDate) => {
                    if (selectedDate) applyDueDate(selectedDate);
                }
            });
            return;
        }
        setShowIOSDatePicker(true);
    };

    const handleCreateRFI = async () => {
        if (!form.projectId || !form.subject.trim() || !form.description.trim()) {
            Alert.alert('Required', 'Please fill in Project, Subject, and Description');
            return;
        }
        try {
            setSubmitting(true);
            const payload = new FormData();
            Object.entries(form).forEach(([key, value]) => {
                if (value === '' || value == null) return;
                if (key === 'category') payload.append(key, String(value).toLowerCase());
                else if (key === 'assignedTo') payload.append(key, String(value));
                else payload.append(key, value);
            });
            files.forEach((file, index) => {
                payload.append('files', {
                    uri: file.uri,
                    name: file.name || `attachment-${index + 1}`,
                    type: file.mimeType || 'application/octet-stream'
                });
            });
            const res = await api.post('/rfis', payload);
            closeCreateModal();
            await Promise.all([fetchData(), refreshData?.()]);
            Alert.alert('Success', 'RFI submitted successfully');
            if (res?.data?._id) navigation.navigate('RFIDetail', { rfiId: res.data._id });
        } catch (e) {
            Alert.alert('Error', 'Failed to submit RFI');
        } finally {
            setSubmitting(false);
        }
    };

    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: rfis.length,
            open: rfis.filter(r => r.status === 'open').length,
            inReview: rfis.filter(r => r.status === 'in_review').length,
            answered: rfis.filter(r => r.status === 'answered').length,
            closed: rfis.filter(r => r.status === 'closed').length,
            overdue: rfis.filter(r => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < now).length,
            highPriority: rfis.filter(r => r.status !== 'closed' && r.priority === 'high').length
        };
    }, [rfis]);

    const recentRFIs = useMemo(() => {
        return [...rfis].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    }, [rfis]);

    const highPriorityRFIs = useMemo(() => {
        return rfis.filter(r => r.status !== 'closed' && r.priority === 'high').slice(0, 3);
    }, [rfis]);

    const overdueRFIs = useMemo(() => {
        const now = new Date();
        return rfis.filter(r => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < now).slice(0, 3);
    }, [rfis]);

    const getStatusLabel = (status) => {
        switch (status) {
            case 'open': return 'Open';
            case 'in_review': return 'In Review';
            case 'answered': return 'Answered';
            case 'closed': return 'Closed';
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#EF4444';
            case 'in_review': return '#F59E0B';
            case 'answered': return '#10B981';
            case 'closed': return '#64748B';
            default: return '#94A3B8';
        }
    };

    const StatBox = ({ label, value, color, bg }) => (
        <View style={[styles.statBox, { backgroundColor: bg || '#F8FAFC' }]}>
            <Text style={[styles.statValue, { color: color || '#0F172A' }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    const RFICard = ({ item }) => (
        <TouchableOpacity style={[styles.rfiCard, SHADOWS.small]} onPress={() => navigation.navigate('RFIDetail', { rfiId: item._id })}>
            <View style={styles.rfiHeader}>
                <Text style={styles.rfiNumber}>{item.rfiNumber || 'RFI-XXXX'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
                </View>
            </View>
            <Text style={styles.rfiSubject} numberOfLines={1}>{item.subject}</Text>
            <View style={styles.rfiFooter}>
                <MaterialCommunityIcons name="office-building" size={12} color="#94A3B8" />
                <Text style={styles.rfiProject} numberOfLines={1}>{item.projectId?.name || 'General'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="RFI Dashboard" showBranding={true} />
            
            <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* DASHBOARD HEADER */}
                <View style={styles.dashboardHeader}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.mainTitle}>RFI Console</Text>
                        <Text style={styles.mainSubtitle}>Monitoring information requests across jobs</Text>
                    </View>
                    {allowCreateRFI ? (
                        <TouchableOpacity style={styles.newBtn} onPress={openCreateModal}>
                            <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
                            <Text style={styles.newBtnText}>NEW RFI</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* OVERDUE / ALERTS SECTION */}
                <View style={styles.alertSection}>
                    <View style={styles.alertCard}>
                        <View style={styles.alertHeaderRow}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#EF4444" />
                            <Text style={styles.alertHeaderTitle}>Critical & Overdue</Text>
                            {overdueRFIs.length > 0 && (
                                <View style={styles.alertBadge}>
                                    <Text style={styles.alertBadgeText}>{overdueRFIs.length}</Text>
                                </View>
                            )}
                        </View>

                        {overdueRFIs.length === 0 ? (
                            <Text style={styles.emptyAlertText}>No overdue RFIs at this time.</Text>
                        ) : (
                            overdueRFIs.map((item, index) => (
                                <TouchableOpacity 
                                    key={`overdue-${item._id || index}`} 
                                    style={styles.alertItem}
                                    onPress={() => navigation.navigate('RFIDetail', { rfiId: item._id })}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.alertItemTitle} numberOfLines={1}>{item.subject}</Text>
                                        <Text style={styles.alertItemMeta}>{item.projectId?.name || 'General'}</Text>
                                    </View>
                                    <Text style={styles.alertItemDate}>
                                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Overdue'}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>

                {/* RECENT RFIs */}
                <View style={{ marginTop: 32 }}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('RFIList')}>
                            <Text style={styles.viewAllText}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.recentView}>
                        {recentRFIs.length === 0 ? (
                            <View style={[styles.rfiCard, { alignItems: 'center', padding: 30 }]}>
                                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>No RFIs found.</Text>
                            </View>
                        ) : (
                            recentRFIs.map((item, idx) => <RFICard key={`recent-${item._id || idx}`} item={item} />)
                        )}
                    </View>
                </View>

                {/* FOOTER LINK */}
                <TouchableOpacity 
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('RFIList')}
                >
                    <Text style={styles.footerLinkText}>OPEN FULL RFI CENTER</Text>
                    <Text style={styles.footerLinkSub}>Manage, Filter and Search all Project RFIs</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* CREATE RFI MODAL */}
            <Modal visible={showCreateModal} animationType="slide" transparent statusBarTranslucent presentationStyle="overFullScreen">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                    <View style={[styles.modalCard, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isSmallScreen ? 14 : 20 }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>New RFI</Text>
                                <Text style={styles.modalSubtitle}>Submit a Request for Information</Text>
                            </View>
                            <TouchableOpacity onPress={closeCreateModal}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 26 }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                        >
                            <Text style={styles.inputLabel}>Project *</Text>
                            <TouchableOpacity style={styles.dropdownField} onPress={() => setIsSelectingProject(true)}>
                                <Text style={[styles.dropdownFieldText, !form.projectId && styles.dropdownPlaceholder]} numberOfLines={1}>
                                    {projects.find(p => (p._id || p.id) === form.projectId)?.name || 'Select Project...'}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Subject *</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Brief description of the request..."
                                placeholderTextColor="#94A3B8"
                                value={form.subject}
                                onChangeText={t => setForm({ ...form, subject: t })}
                            />

                            <Text style={styles.inputLabel}>Description *</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Detailed description of the information requested..."
                                placeholderTextColor="#94A3B8"
                                value={form.description}
                                onChangeText={t => setForm({ ...form, description: t })}
                            />

                            <View style={[styles.rowTwoCols, isCompactLayout && styles.stackCols]}>
                                <View style={styles.rowCol}>
                                    <Text style={styles.inputLabel}>Location (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Level 3, Grid B-4"
                                        placeholderTextColor="#94A3B8"
                                        value={form.location}
                                        onChangeText={t => setForm({ ...form, location: t })}
                                    />
                                </View>
                                <View style={styles.rowCol}>
                                    <Text style={styles.inputLabel}>Category (Optional)</Text>
                                    <TouchableOpacity style={styles.dropdownField} onPress={() => setIsSelectingCategory(true)}>
                                        <Text style={styles.dropdownFieldText}>
                                            {form.category.charAt(0).toUpperCase() + form.category.slice(1)}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={[styles.rowThreeCols, isCompactLayout && styles.stackCols]}>
                                <View style={styles.rowCol}>
                                    <Text style={styles.inputLabel}>Priority</Text>
                                    <View style={styles.priorityRow}>
                                        {[['low', '#64748B'], ['medium', '#F59E0B'], ['high', '#EF4444']].map(([p, color]) => (
                                            <TouchableOpacity
                                                key={p}
                                                style={[styles.priorityBtn, form.priority === p && { backgroundColor: color, borderColor: color }]}
                                                onPress={() => setForm({ ...form, priority: p })}
                                            >
                                                <Text style={[styles.priorityBtnTxt, form.priority === p && { color: '#fff' }]}>
                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.rowCol}>
                                    <Text style={styles.inputLabel}>Assign To</Text>
                                    <TouchableOpacity style={styles.dropdownField} onPress={() => setIsSelectingAssignee(true)}>
                                        <Text style={[styles.dropdownFieldText, !form.assignedTo && styles.dropdownPlaceholder]} numberOfLines={1}>
                                            {form.assignedTo
                                                ? (assignableUsers.find(u => normalizeId(u) === normalizeId(form.assignedTo))?.fullName || 'Assigned user')
                                                : 'Unassigned'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.rowCol}>
                                    <Text style={styles.inputLabel}>Due Date</Text>
                                    <TouchableOpacity style={styles.dropdownField} onPress={openDueDatePicker}>
                                        <Text style={[styles.dropdownFieldText, !form.dueDate && styles.dropdownPlaceholder]}>
                                            {formatDueDate(form.dueDate)}
                                        </Text>
                                        <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Attachments</Text>
                            <TouchableOpacity style={styles.attachDropzone} onPress={pickFiles}>
                                <MaterialCommunityIcons name="upload" size={22} color="#94A3B8" />
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

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={closeCreateModal}
                                    disabled={submitting}
                                >
                                    <Text style={styles.modalCancelTxt}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                                    onPress={handleCreateRFI}
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.submitBtnTxt}>Submit RFI</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={isSelectingProject} transparent animationType="fade" onRequestClose={() => setIsSelectingProject(false)}>
                <View style={styles.selectModalBack}>
                    <View style={styles.selectModalCard}>
                        <Text style={styles.selectModalTitle}>Select Project</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {(projects || []).map((project, idx) => (
                                <TouchableOpacity
                                    key={project._id ? `rfi-project-${project._id}` : `rfi-project-${idx}`}
                                    style={[styles.selectOption, form.projectId === (project._id || project.id) && styles.selectOptionActive]}
                                    onPress={() => {
                                        setForm(prev => ({ ...prev, projectId: project._id || project.id }));
                                        setIsSelectingProject(false);
                                    }}
                                >
                                    <Text style={styles.selectOptionText}>{project.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selectCloseBtn} onPress={() => setIsSelectingProject(false)}>
                            <Text style={styles.selectCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isSelectingCategory} transparent animationType="fade" onRequestClose={() => setIsSelectingCategory(false)}>
                <View style={styles.selectModalBack}>
                    <View style={styles.selectModalCard}>
                        <Text style={styles.selectModalTitle}>Select Category</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {RFI_CATEGORIES.map((category) => (
                                <TouchableOpacity
                                    key={category}
                                    style={[styles.selectOption, form.category === category && styles.selectOptionActive]}
                                    onPress={() => {
                                        setForm(prev => ({ ...prev, category }));
                                        setIsSelectingCategory(false);
                                    }}
                                >
                                    <Text style={styles.selectOptionText}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selectCloseBtn} onPress={() => setIsSelectingCategory(false)}>
                            <Text style={styles.selectCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isSelectingAssignee} transparent animationType="fade" onRequestClose={() => setIsSelectingAssignee(false)}>
                <View style={styles.selectModalBack}>
                    <View style={styles.selectModalCard}>
                        <Text style={styles.selectModalTitle}>Assign To</Text>
                        <TouchableOpacity
                            style={[styles.selectOption, !form.assignedTo && styles.selectOptionActive]}
                            onPress={() => {
                                setForm(prev => ({ ...prev, assignedTo: '' }));
                                setIsSelectingAssignee(false);
                            }}
                        >
                            <Text style={styles.selectOptionText}>Unassigned</Text>
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {assignableUsers.map((member) => (
                                <TouchableOpacity
                                    key={member._id || member.id}
                                    style={[styles.selectOption, normalizeId(form.assignedTo) === normalizeId(member) && styles.selectOptionActive]}
                                    onPress={() => {
                                        setForm(prev => ({ ...prev, assignedTo: normalizeId(member) }));
                                        setIsSelectingAssignee(false);
                                    }}
                                >
                                    <Text style={styles.selectOptionText}>{member.fullName} ({member.role})</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selectCloseBtn} onPress={() => setIsSelectingAssignee(false)}>
                            <Text style={styles.selectCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {Platform.OS === 'ios' && showIOSDatePicker ? (
                <View style={styles.iosDateWrap}>
                    <DateTimePicker
                        value={dueDateValue || new Date()}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={(_, selectedDate) => {
                            if (selectedDate) applyDueDate(selectedDate);
                        }}
                    />
                    <TouchableOpacity style={styles.iosDateDoneBtn} onPress={() => setShowIOSDatePicker(false)}>
                        <Text style={styles.iosDateDoneTxt}>Done</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    dashboardHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTextContainer: { flex: 1, marginRight: 12 },
    mainTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '800', marginTop: 4 },
    newBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    newBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    statsGrid: { paddingHorizontal: 20, marginBottom: 24 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statBox: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    statValue: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    statLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', marginTop: 4, textTransform: 'uppercase' },

    sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    viewAllText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
    recentView: { paddingHorizontal: 20 },

    rfiCard: { backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    rfiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    rfiNumber: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    rfiSubject: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    rfiFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    rfiProject: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

    alertSection: { paddingHorizontal: 20, marginTop: 16 },
    alertCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    alertHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    alertHeaderTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginLeft: 8, flex: 1 },
    alertBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    alertBadgeText: { fontSize: 11, fontWeight: '900', color: '#EF4444' },
    emptyAlertText: { fontSize: 13, color: '#94A3B8', fontWeight: '800', textAlign: 'center', paddingVertical: 10 },
    alertItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 14, marginBottom: 8 },
    alertItemTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    alertItemMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '700' },
    alertItemDate: { fontSize: 11, color: '#EF4444', marginTop: 2, fontWeight: '800' },

    footerLink: { margin: 20, backgroundColor: '#0F172A', padding: 20, borderRadius: 24, alignItems: 'center' },
    footerLinkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    footerLinkSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', marginTop: 4 },

    // Create Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    modalSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '700', marginTop: 4 },
    inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '700', color: '#1E293B' },
    dropdownField: {
        minHeight: 50,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    dropdownFieldText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1E293B', marginRight: 8 },
    dropdownPlaceholder: { color: '#94A3B8', fontWeight: '600' },
    rowTwoCols: { flexDirection: 'row', gap: 10 },
    rowThreeCols: { flexDirection: 'row', gap: 10 },
    stackCols: { flexDirection: 'column' },
    rowCol: { flex: 1, minWidth: 0 },
    priorityRow: { flexDirection: 'row', gap: 10 },
    priorityBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    priorityBtnTxt: { fontSize: 12, fontWeight: '900', color: '#64748B', textTransform: 'uppercase' },
    attachDropzone: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#CBD5E1',
        borderRadius: 14,
        minHeight: 110,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        marginTop: 2
    },
    attachTitle: { fontSize: 13, fontWeight: '800', color: '#475569', marginTop: 8 },
    attachSub: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 4 },
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
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 24, alignItems: 'center' },
    modalCancelBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    modalCancelTxt: { color: '#475569', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
    submitBtn: { flex: 1.25, height: 56, backgroundColor: '#2563EB', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
    selectModalBack: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 24 },
    selectModalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, maxHeight: '70%' },
    selectModalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    selectOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selectOptionActive: { backgroundColor: '#EFF6FF' },
    selectOptionText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    selectCloseBtn: { marginTop: 16, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    selectCloseText: { color: '#475569', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
    iosDateWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    iosDateDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 },
    iosDateDoneTxt: { color: '#2563EB', fontSize: 16, fontWeight: '800' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: '#64748B', textAlign: 'center', marginTop: 8 },
});


export default RFIScreen;
