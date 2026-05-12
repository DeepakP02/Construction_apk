import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, SafeAreaView, StatusBar, Modal, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PMProjectDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const isCompact = windowWidth < 360;
    const { projectId } = route.params;
    const { projects, jobs: allJobs, refreshData, teamMembers, addJob, user, setSelectedProject } = useApp();
    const [loading, setLoading] = useState(false);
    const [isCreatingJob, setIsCreatingJob] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

    // Create Job states
    const [jobName, setJobName] = useState('');
    const [jobLocation, setJobLocation] = useState('');
    const [jobBudget, setJobBudget] = useState('');
    const [jobStatus, setJobStatus] = useState('planning');
    const [jobDescription, setJobDescription] = useState('');
    const [jobStartDate, setJobStartDate] = useState('');
    const [jobEndDate, setJobEndDate] = useState('');
    const [assignRole, setAssignRole] = useState('ALL');
    const [leadWorker, setLeadWorker] = useState('');
    const [leadWorkerId, setLeadWorkerId] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');

    // Selection states
    const [isSelectingWorker, setIsSelectingWorker] = useState(false);
    const [isSelectingRole, setIsSelectingRole] = useState(false);
    const [isSelectingJobStatus, setIsSelectingJobStatus] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null);
    const [filteredStaff, setFilteredStaff] = useState([]);

    const project = (projects || []).find(p => p._id === projectId || p.id === projectId) || {
        name: 'Demo two',
        status: 'planning',
        projectManager: 'p m',
        budget: 1200,
        startDate: '2026-03-31',
        endDate: '2026-05-08'
    };

    const projectJobs = (allJobs || []).filter(j => (j.projectId?._id || j.projectId) === projectId);
    const displayJobs = projectJobs.length > 0 ? projectJobs : [{
        id: 'mock-1',
        name: 'Demo Project job',
        jobCode: '123 selevt option',
        status: 'planning',
        progress: 0,
        projectManager: 'p m',
        leadWorker: 'Worker',
        crewSize: 0,
        startDate: '2026-04-09',
        endDate: '2026-04-22',
        budget: 1200
    }];

    const stats = {
        totalJobs: projectJobs.length || 1,
    };

    const filteredJobs = projectJobs.length > 0 ? projectJobs.filter(job => {
        const matchesSearch = (job.name || job.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = activeFilter === 'All' || 
            (activeFilter === 'Active' && job.status === 'in_progress') ||
            (activeFilter === 'Planning' && (job.status === 'planning' || job.status === 'on-hold')) ||
            (activeFilter === 'Completed' && job.status === 'completed');
        return matchesSearch && matchesFilter;
    }) : displayJobs;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', refreshData);
        return unsubscribe;
    }, [navigation]);

    const handleBack = () => {
        if (navigation?.canGoBack?.()) {
            navigation.goBack();
            return;
        }
        navigation.navigate('Main');
    };
    const focusCurrentProject = () => {
        if (!projectId) return;
        setSelectedProject?.({ _id: projectId, id: projectId, name: project?.name || '' });
    };
    const roleOptions = [
        { label: 'All Roles', value: 'ALL' },
        ...Array.from(
            new Set(
                (teamMembers || [])
                    .map(m => String(m.role || '').toUpperCase().trim())
                    .filter(Boolean)
            )
        ).map(role => ({ label: role.replace('_', ' '), value: role }))
    ];
    const jobStatusOptions = [
        { label: 'Planning', value: 'planning' },
        { label: 'Active', value: 'active' },
        { label: 'On Hold', value: 'on-hold' },
        { label: 'Completed', value: 'completed' }
    ];
    const parsePickerDate = (value) => {
        if (!value || typeof value !== 'string') return new Date();
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            const y = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const d = Number(m[3]);
            return new Date(y, mo, d);
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return new Date();
        return parsed;
    };
    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    const openAndroidDatePicker = (field) => {
        DateTimePickerAndroid.open({
            value: parsePickerDate(field === 'startDate' ? jobStartDate : jobEndDate),
            mode: 'date',
            is24Hour: true,
            onChange: (event, selectedDate) => {
                if (event.type !== 'set' || !selectedDate) return;
                const dateStr = formatDateLocal(selectedDate);
                if (field === 'startDate') setJobStartDate(dateStr);
                if (field === 'endDate') setJobEndDate(dateStr);
            }
        });
    };

    const handleCreateJob = async () => {
        if (!jobName.trim()) {
            Alert.alert('Required', 'Job title is required');
            return;
        }

        try {
            setIsCreatingJob(true);
            const payload = {
                name: jobName.trim(),
                location: jobLocation.trim(),
                budget: Number(jobBudget) || 0,
                status: jobStatus || 'planning',
                progress: 0,
                projectId: projectId,
                leadWorker: leadWorker || undefined,
                assignedTo: leadWorkerId, // Primary field for chat scoping
                leadWorkerId: leadWorkerId, // Redundant field for backend/scoping coverage
                workerId: leadWorkerId, // Fallback field
                foremanId: leadWorkerId || undefined,
                projectManager: user?.fullName || user?.name || project.projectManager || 'p m',
                projectManagerId: user?._id || user?.id,
                startDate: jobStartDate || undefined,
                endDate: jobEndDate || undefined,
                description: jobDescription.trim(),
                assignedRoleType: assignRole === 'ALL' ? undefined : assignRole
            };

            const res = await addJob(payload);
            if (res.success) {
                setIsCreateModalVisible(false);
                setJobName('');
                setJobLocation('');
                setJobBudget('');
                setJobStatus('planning');
                setJobDescription('');
                setJobStartDate('');
                setJobEndDate('');
                setAssignRole('ALL');
                setLeadWorker('');
                setLeadWorkerId(null);
                refreshData();
                Alert.alert('Success', 'Job created successfully');
            } else {
                Alert.alert('Error', res.message || 'Failed to create job');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsCreatingJob(false);
        }
    };

    const handleHeaderMenuPress = () => {
        Alert.alert('Project Actions', 'Choose an action', [
            { text: 'Refresh', onPress: refreshData },
            { text: 'Create Job', onPress: () => setIsCreateModalVisible(true) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const renderHeader = () => (
            <View style={[styles.header, { paddingHorizontal: isCompact ? 12 : 16 }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
                <Text style={[styles.headerTitle, { fontSize: isCompact ? 16 : 18 }]} numberOfLines={1}>{project.name || 'Project Detail'}</Text>
                <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: '#F97316' }]} />
                    <Text style={styles.statusText}>{project.status?.toUpperCase() || 'PLANNING'}</Text>
                </View>
            </View>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleHeaderMenuPress}>
                <MaterialCommunityIcons name="dots-vertical" size={24} color="#64748B" />
            </TouchableOpacity>
        </View>
    );

    const renderProjectInfo = () => (
        <View style={styles.infoCard}>
            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Project Manager</Text>
                    <View style={styles.managerWrap}>
                        <View style={styles.managerAvatar}>
                            <Text style={styles.avatarText}>{(project.projectManager?.[0] || 'P').toUpperCase()}</Text>
                        </View>
                        <Text style={styles.managerName}>{project.projectManager || 'Not Assigned'}</Text>
                    </View>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Project Phase</Text>
                    <View style={styles.phaseWrap}>
                        <Text style={styles.phaseName}>{project.status === 'planning' ? 'Planning' : 'Active Site'}</Text>
                        <TouchableOpacity style={styles.changeBtn}>
                            <Text style={styles.changeBtnText}>CHANGE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderQuickActions = () => {
        const actions = [
            {
                key: 'drawings',
                icon: 'floor-plan',
                label: 'View Drawings',
                color: '#6366F1',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('Drawings', { projectId, projectName: project.name });
                },
            },
            {
                key: 'client-updates',
                icon: 'bullhorn-outline',
                label: 'Client Updates',
                color: '#10B981',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('Reports', { projectId, projectName: project.name, source: 'client-updates' });
                },
            },
            {
                key: 'purchase-orders',
                icon: 'cart-outline',
                label: 'Purchase Orders',
                color: '#EF4444',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('PurchaseOrders', { projectId, projectName: project.name });
                },
            },
            {
                key: 'tasks',
                icon: 'clipboard-list-outline',
                label: 'Tasks',
                color: '#8B5CF6',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('MainTabs', {
                        screen: 'Tasks',
                        params: { projectId, projectName: project.name }
                    });
                },
            },
            {
                key: 'deficiencies',
                icon: 'alert-circle-outline',
                label: 'Deficiencies',
                color: '#F43F5E',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('ForemanIssues', { projectId, projectName: project.name });
                },
            },
            {
                key: 'contacts',
                icon: 'contacts-outline',
                label: 'Contacts',
                color: '#14B8A6',
                onPress: () => {
                    focusCurrentProject();
                    navigation.navigate('CrewClock', { projectId, projectName: project.name });
                },
            },
        ];

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
                {actions.map((action) => (
                    <TouchableOpacity
                        key={action.key}
                        style={styles.actionItem}
                        onPress={() => {
                            try {
                                action.onPress?.();
                            } catch (e) {
                                Alert.alert('Navigation', `${action.label} is not available right now.`);
                            }
                        }}
                    >
                        <View style={[styles.actionIconBox, { backgroundColor: action.color + '15' }]}>
                            <MaterialCommunityIcons name={action.icon} size={22} color={action.color} />
                        </View>
                        <Text style={styles.actionLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    const renderDatesAndStats = () => (
        <View style={styles.statsContainer}>
            <View style={styles.dateRow}>
                <View style={styles.dateCard}>
                    <Text style={styles.dateLabel}>Start Date</Text>
                    <Text style={styles.dateValue}>{project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Mar 31, 2026'}</Text>
                </View>
                <View style={styles.dateCard}>
                    <Text style={styles.dateLabel}>End Date</Text>
                    <Text style={styles.dateValue}>{project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 8, 2026'}</Text>
                </View>
            </View>

        </View>
    );

    const renderJobsHeader = () => (
        <View style={styles.jobsHeader}>
            <View style={styles.jobsTitleRow}>
                <View>
                    <Text style={styles.jobsTitle}>Jobs</Text>
                    <Text style={styles.jobsSubtitle}>{stats.totalJobs} job in this project</Text>
                </View>
                <TouchableOpacity style={styles.createJobBtn} onPress={() => setIsCreateModalVisible(true)}>
                    <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                    <Text style={styles.createJobBtnText}>Create Job</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
                <View style={styles.searchBox}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                    {['All', 'Planning', 'Active', 'Completed'].map(filter => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>{filter}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const formatJobDateRange = (startDate, endDate) => {
        if (!startDate && !endDate) return 'Dates not set';
        const fmt = (d) => {
            if (!d) return '--';
            const parsed = new Date(d);
            if (Number.isNaN(parsed.getTime())) return '--';
            return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        return `${fmt(startDate)} \u2192 ${fmt(endDate)}`;
    };

    const renderJobCard = (job) => (
        <TouchableOpacity key={job._id || job.id} style={styles.jobCard}>
            <View style={styles.jobCardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{job.name || job.title || 'Untitled Job'}</Text>
                    <Text style={styles.jobSubtitle}>
                        {(typeof job.location === 'object' ? job.location?.address : job.location) || job.description || 'No location/notes added'}
                    </Text>
                </View>
                <View style={styles.jobStatusWrap}>
                    <View style={[styles.jobStatusBadge, { backgroundColor: (job.status === 'on_hold' || job.status === 'on-hold') ? '#FEFCE8' : '#EFF6FF' }]}>
                        <Text style={[styles.jobStatusText, { color: (job.status === 'on_hold' || job.status === 'on-hold') ? '#CA8A04' : '#2563EB' }]}>
                            {(job.status === 'on_hold' || job.status === 'on-hold') ? 'On Hold' : job.status?.replace('_', ' ').toUpperCase() || 'PLANNING'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.progressSection}>
                <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressValue}>{job.progress || 0}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${job.progress || 0}%` }]} />
                </View>
            </View>

            <View style={styles.jobMetaGrid}>
                <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="account-tie-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>PM: {job.projectManager || project.projectManager || 'p m'}</Text>
                </View>
                <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="account-hard-hat-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>Lead Worker: {job.leadWorker || 'Worker'}</Text>
                </View>
            </View>

            <View style={styles.jobActionsRow}>
                <TouchableOpacity 
                    style={styles.assignBtn}
                    onPress={() => navigation.navigate('CrewClock')}
                >
                    <MaterialCommunityIcons name="account-plus-outline" size={14} color="#2563EB" />
                    <Text style={styles.assignBtnText}>Assign Foreman/Sub</Text>
                </TouchableOpacity>
                <View style={styles.crewInfo}>
                    <MaterialCommunityIcons name="account-group-outline" size={14} color="#64748B" />
                    <Text style={styles.crewText}>Crew: {job.crewSize || 0} assigned</Text>
                </View>
            </View>

            <View style={styles.jobFooter}>
                <View style={styles.footerItem}>
                    <MaterialCommunityIcons name="calendar-range" size={14} color="#64748B" />
                    <Text style={styles.footerText}>{formatJobDateRange(job.startDate, job.endDate)}</Text>
                </View>
                <View style={styles.footerItem}>
                    <MaterialCommunityIcons name="currency-usd" size={14} color="#10B981" />
                    <Text style={[styles.footerText, { color: '#10B981', fontWeight: '800' }]}>${(job.budget || 0).toLocaleString()}</Text>
                </View>
            </View>

            <View style={styles.equipmentRow}>
                <Text style={styles.equipmentLabel}>Equipment On Site</Text>
                <View style={styles.equipmentBadge}>
                    <Text style={styles.equipmentCount}>0</Text>
                </View>
                <Text style={styles.noEquipment}>No equipment assigned</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            {renderHeader()}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom + 90, 100), maxWidth: windowWidth >= 900 ? 980 : undefined, alignSelf: 'center', width: '100%' }
                ]}
            >
                {renderProjectInfo()}
                {renderQuickActions()}
                {renderDatesAndStats()}
                {renderJobsHeader()}
                
                {filteredJobs.length > 0 ? (
                    filteredJobs.map(renderJobCard)
                ) : (
                    <TouchableOpacity style={styles.emptyJobs} onPress={() => setIsCreateModalVisible(true)}>
                        <MaterialCommunityIcons name="office-building" size={48} color="#E2E8F0" />
                        <Text style={styles.emptyJobsTitle}>Create New Job</Text>
                        <Text style={styles.emptyJobsSub}>Add a job to this project</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal visible={isCreateModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
                    >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Job</Text>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.modalFormScroll}
                            contentContainerStyle={styles.modalFormScrollContent}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="always"
                            keyboardDismissMode="none"
                        >
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Job Title</Text>
                                <TextInput style={styles.modalInput} value={jobName} onChangeText={setJobName} placeholder="Job Title" />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Location / Address</Text>
                                <TextInput style={styles.modalInput} value={jobLocation} onChangeText={setJobLocation} placeholder="Site block, level or full address" />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                                <TouchableOpacity
                                    style={[styles.modalInput, styles.dropdownField]}
                                    onPress={() => {
                                        if (Platform.OS === 'android') openAndroidDatePicker('startDate');
                                        else setDatePickerField('startDate');
                                    }}
                                >
                                    <Text style={[styles.modalInputText, { color: jobStartDate ? '#1E293B' : '#94A3B8' }]}>
                                        {jobStartDate || 'Select start date'}
                                    </Text>
                                    <MaterialCommunityIcons name="calendar" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                                <TouchableOpacity
                                    style={[styles.modalInput, styles.dropdownField]}
                                    onPress={() => {
                                        if (Platform.OS === 'android') openAndroidDatePicker('endDate');
                                        else setDatePickerField('endDate');
                                    }}
                                >
                                    <Text style={[styles.modalInputText, { color: jobEndDate ? '#1E293B' : '#94A3B8' }]}>
                                        {jobEndDate || 'Select end date'}
                                    </Text>
                                    <MaterialCommunityIcons name="calendar" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Budget ($)</Text>
                                <TextInput style={styles.modalInput} value={jobBudget} onChangeText={setJobBudget} placeholder="Budget" keyboardType="numeric" />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Job Status</Text>
                                <TouchableOpacity
                                    style={[styles.modalInput, styles.dropdownField]}
                                    onPress={() => setIsSelectingJobStatus(true)}
                                >
                                    <Text style={styles.modalInputText}>
                                        {jobStatusOptions.find(s => s.value === jobStatus)?.label || 'Planning'}
                                    </Text>
                                    <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Assign Role</Text>
                                <TouchableOpacity
                                    style={[styles.modalInput, styles.dropdownField]}
                                    onPress={() => setIsSelectingRole(true)}
                                >
                                    <Text style={styles.modalInputText}>
                                        {roleOptions.find(r => r.value === assignRole)?.label || 'All Roles'}
                                    </Text>
                                    <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>{assignRole === 'ALL' ? 'Lead Worker' : 'Select Identity'}</Text>
                                <TouchableOpacity 
                                    style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} 
                                    onPress={() => {
                                        const staff = (teamMembers || []).filter(m => 
                                            assignRole === 'ALL'
                                                ? ['WORKER', 'FOREMAN', 'SUBCONTRACTOR', 'PM'].includes(m.role)
                                                : m.role === assignRole
                                        );
                                        setFilteredStaff(staff);
                                        setIsSelectingWorker(true);
                                    }}
                                >
                                    <Text style={[styles.modalInputText, { color: leadWorker ? '#1E293B' : '#94A3B8' }]}>
                                        {leadWorker || (assignRole === 'ALL' ? 'Select Lead Staff...' : 'Select User...')}
                                    </Text>
                                    <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Description / Notes</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalInputArea]}
                                    value={jobDescription}
                                    onChangeText={setJobDescription}
                                    placeholder="Describe scope, notes, or instructions..."
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setIsCreateModalVisible(false)}
                                    disabled={isCreatingJob}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.saveBtn, { backgroundColor: '#0F172A' }]} 
                                    onPress={handleCreateJob}
                                    disabled={isCreatingJob}
                                >
                                    {isCreatingJob ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Job</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Staff Selection Modal */}
            <Modal visible={isSelectingWorker} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>Select Lead Staff</Text>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {filteredStaff.map((m, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    style={styles.selItem} 
                                    onPress={() => {
                                        setLeadWorker(m.fullName || m.name);
                                        setLeadWorkerId(m._id || m.id);
                                        setIsSelectingWorker(false);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.selLabel}>{m.fullName || m.name}</Text>
                                        <Text style={styles.selSubLabel}>{m.role}</Text>
                                    </View>
                                    {String(leadWorkerId || '') === String(m._id || m.id) ? (
                                        <MaterialCommunityIcons name="check-circle" size={20} color="#2563EB" />
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                            {filteredStaff.length === 0 && (
                                <Text style={{ textAlign: 'center', padding: 20, color: '#94A3B8' }}>No eligible staff found.</Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.selClose} onPress={() => setIsSelectingWorker(false)}>
                            <Text style={styles.selCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Role Selection Modal */}
            <Modal visible={isSelectingRole} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>Select Role</Text>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {roleOptions.map((role, i) => (
                                <TouchableOpacity
                                    key={`${role.value}-${i}`}
                                    style={styles.selItem}
                                    onPress={() => {
                                        setAssignRole(role.value);
                                        setLeadWorker('');
                                        setLeadWorkerId(null);
                                        setIsSelectingRole(false);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.selLabel}>{role.label}</Text>
                                    </View>
                                    {assignRole === role.value ? (
                                        <MaterialCommunityIcons
                                            name="check-circle"
                                            size={20}
                                            color="#2563EB"
                                        />
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selClose} onPress={() => setIsSelectingRole(false)}>
                            <Text style={styles.selCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Job Status Selection Modal */}
            <Modal visible={isSelectingJobStatus} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>Select Job Status</Text>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {jobStatusOptions.map((status, i) => (
                                <TouchableOpacity
                                    key={`${status.value}-${i}`}
                                    style={styles.selItem}
                                    onPress={() => {
                                        setJobStatus(status.value);
                                        setIsSelectingJobStatus(false);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.selLabel}>{status.label}</Text>
                                    </View>
                                    {jobStatus === status.value ? (
                                        <MaterialCommunityIcons
                                            name="check-circle"
                                            size={20}
                                            color="#2563EB"
                                        />
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selClose} onPress={() => setIsSelectingJobStatus(false)}>
                            <Text style={styles.selCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {Platform.OS === 'ios' && datePickerField ? (
                <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                    <DateTimePicker
                        value={parsePickerDate(datePickerField === 'startDate' ? jobStartDate : jobEndDate)}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                            if (!selectedDate) return;
                            const dateStr = formatDateLocal(selectedDate);
                            if (datePickerField === 'startDate') setJobStartDate(dateStr);
                            if (datePickerField === 'endDate') setJobEndDate(dateStr);
                        }}
                    />
                    <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setDatePickerField(null)}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Bottom Nav Simulation */}
            <View style={[styles.bottomNav, { height: 60 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) }]}>
                <TouchableOpacity style={styles.navItem}>
                    <MaterialCommunityIcons name="view-dashboard" size={24} color="#2563EB" />
                    <Text style={[styles.navText, { color: '#2563EB', fontSize: isCompact ? 9 : 10 }]}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => navigation.navigate('ForemanIssues', { projectId, projectName: project?.name })}
                >
                    <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={24} color="#64748B" />
                    <Text style={[styles.navText, { fontSize: isCompact ? 9 : 10 }]}>Punch List</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        paddingTop: 30, 
        paddingBottom: 15,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitleWrap: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
    headerActionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

    scrollContent: { paddingBottom: 100 },

    infoCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoItem: { flex: 0.48 },
    infoLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
    managerWrap: { flexDirection: 'row', alignItems: 'center' },
    managerAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    avatarText: { fontSize: 10, fontWeight: '900', color: '#4F46E5' },
    managerName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
    phaseWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    phaseName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
    changeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#F1F5F9' },
    changeBtnText: { fontSize: 10, fontWeight: '800', color: '#64748B' },

    actionsScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    actionItem: { alignItems: 'center', width: 80 },
    actionIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    actionLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textAlign: 'center' },

    statsContainer: { paddingHorizontal: 16, marginBottom: 20 },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    dateCard: { flex: 0.48, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    dateLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 4 },
    dateValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    metricCard: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    metricLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 4 },
    metricValue: { fontSize: 15, fontWeight: '900', color: '#1E293B' },

    jobsHeader: { paddingHorizontal: 16, marginBottom: 12 },
    jobsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    jobsTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    jobsSubtitle: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    createJobBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    createJobBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginLeft: 4 },

    filterRow: { gap: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#1E293B' },
    filterChips: { gap: 8 },
    filterChip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    filterChipText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
    filterChipTextActive: { color: '#FFFFFF' },

    emptyJobs: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0' },
    emptyJobsTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginTop: 12 },
    emptyJobsSub: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
    modalKeyboardWrap: { width: '100%' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '90%' },
    modalFormScroll: { flexGrow: 0 },
    modalFormScrollContent: { paddingBottom: 26 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 12, height: 48, paddingHorizontal: 16, fontSize: 14, fontWeight: '600', color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
    modalInputArea: { minHeight: 90, height: 90, paddingTop: 12 },
    dropdownField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
    modalCancelBtn: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', justifyContent: 'center', height: 56 },
    modalCancelText: { color: '#475569', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
    saveBtn: { flex: 1.25, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },

    jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
    jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    jobTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    jobSubtitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
    jobStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    jobStatusText: { fontSize: 10, fontWeight: '900' },

    progressSection: { marginBottom: 16 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    progressValue: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
    progressBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3 },
    progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },

    jobMetaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', flex: 0.48 },
    metaText: { fontSize: 12, fontWeight: '600', color: '#64748B', marginLeft: 6 },

    jobActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F8FAFC', marginBottom: 12 },
    assignBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    assignBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB', marginLeft: 4 },
    crewInfo: { flexDirection: 'row', alignItems: 'center' },
    crewText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginLeft: 4 },

    jobFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    footerItem: { flexDirection: 'row', alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '700', color: '#64748B', marginLeft: 6 },

    equipmentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8 },
    equipmentLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginRight: 8 },
    equipmentBadge: { backgroundColor: '#E2E8F0', width: 18, height: 18, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    equipmentCount: { fontSize: 10, fontWeight: '900', color: '#475569' },
    noEquipment: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },

    bottomNav: { 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        height: 60, 
        backgroundColor: '#FFFFFF', 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    navItem: { alignItems: 'center' },
    navText: { fontSize: 10, fontWeight: '800', color: '#64748B', marginTop: 4 },

    modalInputText: { fontSize: 14, fontWeight: '600' },
    selOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    selTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
    selItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    selSubLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
    selClose: { marginTop: 20, paddingVertical: 12, alignItems: 'center' },
    selCloseText: { fontSize: 14, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
    pickerDoneBtn: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    pickerDoneText: { color: '#2563EB', fontWeight: '800', fontSize: 14 }
});

export default PMProjectDetailScreen;
