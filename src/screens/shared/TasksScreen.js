import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text, Modal, ScrollView, Alert, Animated, TextInput, Platform, useWindowDimensions, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { COLORS, SPACING, SIZES, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';

const ROLE_LABELS = {
    PM: 'Project Manager',
    FOREMAN: 'Foreman',
    WORKER: 'Worker',
    SUBCONTRACTOR: 'Subcontractor'
};

const getAssignableRoleOptions = (currentRole) => {
    if (['FOREMAN', 'SUBCONTRACTOR'].includes(currentRole)) {
        return [{ label: 'Worker', value: 'WORKER' }];
    }
    if (['PM', 'COMPANY_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(currentRole)) {
        return [
            { label: 'Worker', value: 'WORKER' },
            { label: 'Foreman', value: 'FOREMAN' },
            { label: 'PM', value: 'PM' },
            { label: 'Subcontractor', value: 'SUBCONTRACTOR' }
        ];
    }
    return [{ label: 'Worker', value: 'WORKER' }];
};

const VIEW_MODES = [
    { id: 'list', icon: 'format-list-bulleted', label: 'List' },
    { id: 'board', icon: 'view-column-outline', label: 'Board' },
    { id: 'gantt', icon: 'chart-gantt', label: 'Gantt' },
    { id: 'calendar', icon: 'calendar-month-outline', label: 'Calendar' }
];

const DISPLAY_MODES = [
    { id: 'compact', icon: 'view-headline', label: 'Compact' },
    { id: 'comfortable', icon: 'view-day-outline', label: 'Comfortable' }
];

const TasksScreen = ({ navigation }) => {
    const { width, height } = useWindowDimensions();
    const isCompact = width < 380;
    const modalMaxWidth = Math.min(width - 16, 700);
    const modalMaxHeight = Math.min(height * 0.9, 760);
    const { tasks, addTask, updateTask, deleteTask, projects, teamMembers, fetchTeamMembers, user, refreshData, selectedProject } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [displayMode, setDisplayMode] = useState('comfortable');
    const [filterTab, setFilterTab] = useState('all'); // 'my' or 'all'
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [serverTasks, setServerTasks] = useState([]);
    
    // Custom Selector State (Stable)
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});

    const COLLAPSE_STORAGE_KEY = 'tasksCollapsedNodesV1';

    const [datePickerMode, setDatePickerMode] = useState(null); // 'startDate' or 'dueDate'

    const promptDeleteTask = (task) => {
        const id = task?._id || task?.id;
        if (!id) return;
        const hasChildren = (task?.children && task.children.length > 0) || (visibleTasks || []).some(t => String(t.parentTaskId ? (t.parentTaskId?._id || t.parentTaskId) : '') === String(id));

        if (!hasChildren) {
            Alert.alert('Delete Task', `Delete "${task.title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) }
            ]);
            return;
        }

        Alert.alert(
            'Delete Parent Task',
            'This task has children. Choose delete strategy.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Move Children Up', onPress: () => deleteTask(id, { action: 'moveUpward' }) },
                { text: 'Delete All', style: 'destructive', onPress: () => deleteTask(id, { action: 'cascade' }) }
            ]
        );
    };

    const openTaskActions = (task) => {
        if (isSubcontractor) {
            Alert.alert('View Only', 'Subcontractor can only view assigned tasks.');
            return;
        }
        Alert.alert(
            task?.title || 'Task Actions',
            'Choose an action',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add Child Task',
                    onPress: () => navigation.navigate('TaskCreate', {
                        isChild: true,
                        parentTaskId: task._id || task.id,
                        projectId: task?.projectId?._id || task?.projectId
                    })
                },
                { text: 'Rename / Edit', onPress: () => handleOpenModal(task) },
                {
                    text: task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete',
                    onPress: () => updateTask(task._id || task.id, { status: task.status === 'completed' ? 'todo' : 'completed' })
                },
                { text: 'Delete', style: 'destructive', onPress: () => promptDeleteTask(task) }
            ]
        );
    };

    const formatDate = (date) => {
        if (!date) return '';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) {
            return '';
        }
    };

    const parsePickerDate = (value) => {
        if (!value || typeof value !== 'string') return new Date();
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const openDatePicker = (field) => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: parsePickerDate(form[field]),
                mode: 'date',
                is24Hour: true,
                onChange: (event, selectedDate) => {
                    if (event.type !== 'set' || !selectedDate) return;
                    setForm(prev => ({ ...prev, [field]: formatDate(selectedDate) }));
                }
            });
            return;
        }
        setDatePickerMode(field);
    };

    const [form, setForm] = useState({
        title: '',
        project: '',
        projectId: '',
        assignedRoleType: '',
        assignedTo: [],
        category: 'TASK',
        priority: 'Medium',
        status: 'todo',
        startDate: '',
        dueDate: '',
        description: ''
    });
    
    const [loading, setLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const latestFetchSeqRef = useRef(0);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
            fetchTeamMembers();
            fetchWebSyncedTasks();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation, fetchWebSyncedTasks]);

    useEffect(() => {
        const t = setTimeout(() => {
            fetchWebSyncedTasks();
        }, 220);
        return () => clearTimeout(t);
    }, [fetchWebSyncedTasks]);

    useEffect(() => {
        const restoreCollapsed = async () => {
            try {
                const raw = await AsyncStorage.getItem(COLLAPSE_STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setCollapsedNodes(new Set(parsed.map(v => String(v))));
                }
            } catch (e) {}
        };
        restoreCollapsed();
    }, []);

    useEffect(() => {
        AsyncStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(collapsedNodes))).catch(() => {});
    }, [collapsedNodes]);

    // Metrics Calculation
    const role = user?.role;
    const isManagerial = ['PM', 'FOREMAN', 'OWNER', 'COMPANY_OWNER'].includes(role);
    const isPersonalOnlyRole = ['WORKER', 'SUBCONTRACTOR'].includes(role);
    const isSubcontractor = role === 'SUBCONTRACTOR';
    const normalizeTasks = useCallback((data) => {
        return (data || []).map((t) => {
            const taskIdRef = t.taskId?._id || t.taskId || null;
            const parentSubTaskIdRef = t.parentSubTaskId?._id || t.parentSubTaskId || null;
            const inferredParentId = parentSubTaskIdRef || taskIdRef || null;
            const normalizedProjectId =
                typeof t.projectId === 'string'
                    ? { _id: t.projectId }
                    : (t.projectId || t.taskId?.projectId || t.taskId?.jobId?.projectId || null);
            return {
                ...t,
                _id: t._id || t.id,
                projectId: normalizedProjectId,
                parentTaskId: t.parentTaskId?._id || t.parentTaskId || (t.isSubTask ? inferredParentId : null),
                level: Number(t.level || 0),
                path: t.path || '',
                isSubTask: !!(t.isSubTask || t.parentSubTaskId || t.taskId || t.parentTaskId),
            };
        });
    }, []);
    const fetchWebSyncedTasks = useCallback(async () => {
        const seq = ++latestFetchSeqRef.current;
        try {
            const params = {
                q: search?.trim() || undefined,
                projectId: selectedProject?._id || selectedProject?.id || undefined,
            };
            if ((filterTab === 'my' || isSubcontractor) && user?._id) params.assignedTo = user._id;
            const res = await api.get('/tasks', { params });
            if (latestFetchSeqRef.current !== seq) return;
            setServerTasks(normalizeTasks(Array.isArray(res.data) ? res.data : []));
        } catch {
            if (latestFetchSeqRef.current !== seq) return;
            setServerTasks([]);
        }
    }, [search, selectedProject, filterTab, isSubcontractor, user?._id, normalizeTasks]);
    const visibleTasks = (serverTasks && serverTasks.length > 0 ? serverTasks : tasks) || [];

    useEffect(() => {
        // Backend already restricts WORKER/SUBCONTRACTOR visibility to "my tasks".
        // Default the UI tab accordingly to match web flow and avoid confusion.
        if (isPersonalOnlyRole) setFilterTab('my');
    }, [isPersonalOnlyRole]);

    const isAssignedToUser = (t) => {
        const myId = user?._id ? String(user._id) : null;
        if (!myId) return false;

        const assigned = t?.assignedTo;
        if (Array.isArray(assigned)) {
            return assigned.some(a => {
                const id = a && typeof a === 'object' ? (a._id || a.id) : a;
                return id ? String(id) === myId : false;
            });
        }
        if (assigned && typeof assigned === 'object') {
            const id = assigned._id || assigned.id;
            return id ? String(id) === myId : false;
        }
        if (assigned) return String(assigned) === myId || String(assigned) === String(user?.fullName || '');
        return false;
    };
    
    const filteredTasks = (visibleTasks || []).filter(t => {
        const isAssignedToMe = isAssignedToUser(t);
        
        const assigneeNames = Array.isArray(t.assignedTo) 
            ? t.assignedTo.map(a => a.fullName?.toLowerCase() || '').join(' ')
            : (t.assignedTo?.fullName?.toLowerCase() || '');

        const q = search.toLowerCase();
        const matchesSearch = t.title?.toLowerCase().includes(q) || 
                             t.projectId?.name?.toLowerCase().includes(q) ||
                             t.jobName?.toLowerCase?.().includes?.(q) ||
                             t.category?.toLowerCase().includes(q) ||
                             assigneeNames.includes(q);
        
        const matchesTab = filterTab === 'all' ? true : isAssignedToMe;
        
        // --- FORCE VISIBILITY FOR SUBTASKS ---
        let matchesSelected = !selectedProject;
        if (selectedProject) {
            const selId = String(selectedProject._id || selectedProject.id);
            const myProjId = String(t.projectId?._id || t.projectId);
            matchesSelected = myProjId === selId;
        }

        const isCreatedByMe = String(t.createdBy?._id || t.createdBy) === String(user?._id || user?.id);
        const canSee = isManagerial ? true : (isAssignedToMe || isCreatedByMe);
        const isRootForList = !t.parentTaskId;
        const finalMatch = isRootForList && canSee && matchesSearch && matchesTab && matchesSelected;
        return finalMatch;
    });

    // Build hierarchy for rendering
    const buildHierarchy = (allTasks, explicitlyMatchedTasks) => {
        const map = new Map();
        const roots = [];
        const orphans = [];
        const matchedIds = new Set(explicitlyMatchedTasks.map(t => String(t._id || t.id)));
        
        // 1. Create a map of all tasks with basic structure
        allTasks.forEach(t => {
            const id = String(t._id || t.id);
            map.set(id, { ...t, children: [], level: 0 });
        });
        
        // 2. Resolve parent-child links
        allTasks.forEach(t => {
            const id = String(t._id || t.id);
            const node = map.get(id);
            
            const directParentId = t.parentTaskId ? String(t.parentTaskId?._id || t.parentTaskId) : null;

            if (directParentId && map.has(directParentId)) {
                const parentNode = map.get(directParentId);
                parentNode.children.push(node);
                
                if (!node.projectId && parentNode.projectId) {
                    node.projectId = parentNode.projectId;
                }
            } else {
                if (!directParentId) {
                    roots.push(node);
                } else {
                    // Strict hierarchy mode: if parent is missing, keep as orphan (do not promote as root).
                    orphans.push(node);
                }
            }
        });

        // 3. Visibility Check: Node is visible if matched, or descendant is visible
        const visibleIds = new Set();
        
        const checkVisibility = (node) => {
            const id = String(node._id || node.id);
            const isMatched = matchedIds.has(id);
            let childMatched = false;
            
            node.children.forEach(child => {
                if (checkVisibility(child)) {
                    childMatched = true;
                }
            });
            
            if (isMatched || childMatched) {
                visibleIds.add(id);
                return true;
            }
            return false;
        };

        roots.forEach(root => checkVisibility(root));

        // 4. Flatten visible tree (Collapse aware)
        const flatList = [];
        const flatten = (nodes, level, parentCollapsed = false) => {
            const sortedNodes = [...nodes].sort((a, b) => {
                const pathSort = String(a.path || '').localeCompare(String(b.path || ''));
                if (pathSort !== 0) return pathSort;
                return (a.position || 0) - (b.position || 0);
            });
            sortedNodes.forEach(n => {
                const id = String(n._id || n.id);
                if (visibleIds.has(id)) {
                    n.level = level;
                    n.isCollapsed = collapsedNodes.has(id);
                    n.hasChildren = n.children && n.children.length > 0;
                    
                    if (!parentCollapsed) {
                        flatList.push(n);
                    }
                    
                    if (n.children && n.children.length > 0) {
                        flatten(n.children, level + 1, parentCollapsed || collapsedNodes.has(id));
                    }
                }
            });
        };
        flatten(roots, 0, false);
        console.log(`--- [Hierarchy] Built tree with ${flatList.length} visible items ---`);
        return flatList;
    };

    const hierarchicalTasks = buildHierarchy(visibleTasks || [], filteredTasks);

    const now = new Date();
    const overdueCount = filteredTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
    const activeCount = filteredTasks.filter(t => t.status === 'in_progress' || t.status === 'todo').length;
    const doneCount = filteredTasks.filter(t => t.status === 'completed').length;

    // Filter team by selected role
    const filteredTeam = form.assignedRoleType 
        ? (teamMembers || []).filter(m => m.role === form.assignedRoleType)
        : (teamMembers || []);

    const handleOpenModal = (task = null, preselectedParentId = '') => {
        if (isSubcontractor) {
            Alert.alert('View Only', 'Subcontractor can only view assigned tasks.');
            return;
        }
        if (task) {
            setEditingTask(task);
            setForm({
                title: task.title,
                project: task.projectId?.name || '',
                projectId: task.projectId?._id || task.projectId || '',
                parentTaskId: task.parentTaskId ? (task.parentTaskId?._id || task.parentTaskId) : '',
                assignedRoleType: task.assignedRoleType || '',
                assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo.map(a => a._id || a) : [],
                category: task.category || 'TASK',
                priority: task.priority || 'Medium',
                status: task.status || 'todo',
                startDate: formatDate(task.startDate),
                dueDate: formatDate(task.dueDate),
                description: task.description || ''
            });
        } else {
            setEditingTask(null);
            const parent = preselectedParentId ? visibleTasks.find(t => String(t._id || t.id) === String(preselectedParentId)) : null;
            
            let parentId = '';
            if (parent) {
                parentId = parent._id || parent.id;
            }

            setForm({
                title: '',
                project: parent ? (parent.projectId?.name || '') : (selectedProject?.name || projects[0]?.name || ''),
                projectId: parent ? (parent.projectId?._id || parent.projectId || '') : (selectedProject?._id || selectedProject?.id || projects[0]?._id || projects[0]?.id || ''),
                parentTaskId: parentId,
                assignedRoleType: '',
                assignedTo: [],
                category: 'TASK',
                priority: 'Medium',
                status: 'todo',
                startDate: '',
                dueDate: '',
                description: ''
            });
        }
        setModalVisible(true);
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (val) => {
            onSelect(val);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const handleSave = async () => {
        if (!form.title) {
            Alert.alert('Error', 'Task title is required');
            return;
        }
        if (!form.projectId) {
            Alert.alert('Error', 'Project selection is required');
            return;
        }

        setLoading(true);
        let success;
        
        const payload = { ...form };
        
        // Ensure projectId is strictly set (important for filtering)
        if (!payload.projectId && payload.parentTaskId) {
            const parent = visibleTasks.find(t => String(t._id || t.id) === String(payload.parentTaskId));
            if (parent) {
                payload.projectId = parent.projectId?._id || parent.projectId;
            }
        }

        if (!payload.assignedRoleType) delete payload.assignedRoleType;
        if (!payload.startDate) delete payload.startDate;
        if (!payload.dueDate) delete payload.dueDate;
        
        // Ensure assignedTo is a single string (ObjectId), not an array
        if (Array.isArray(payload.assignedTo)) {
            payload.assignedTo = payload.assignedTo.length > 0 ? payload.assignedTo[0] : null;
        }
        if (!payload.assignedTo) delete payload.assignedTo;

        if (editingTask) {
            const taskId = editingTask._id || editingTask.id;
            console.log(`--- [UI] UPDATING TASK [ID: ${taskId}] ---`, payload);
            success = await updateTask(taskId, payload);
        } else {
            success = await addTask(payload);
        }
        setLoading(false);

        if (success) {
            setModalVisible(false);
            // Wait for DB indexing to settle before refreshing the list
            refreshData();
        } else {
            Alert.alert('Error', 'Operation failed. Please check your connection.');
        }
    };

    const MetricCard = ({ label, count, color, bg }) => (
        <View style={[styles.metricCard, { backgroundColor: bg }]}>
            <Text style={[styles.metricCount, { color }]}>{count}</Text>
            <Text style={[styles.metricLabel, { color }]}>{label}</Text>
        </View>
    );

    const DropdownField = ({ label, value, icon, onPress, flex = 1 }) => (
        <View style={{ flex }}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.compactDropdown} activeOpacity={0.7} onPress={onPress}>
                <Text style={styles.dropdownValue} numberOfLines={1}>
                    {value || `Select...`}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color="#3B82F6" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <WorkerHeader title="Tasks" />
            <View style={[styles.stickyHeader, { paddingHorizontal: isCompact ? 12 : 16 }]}>
                <View style={styles.headerTopRowCompact}>
                    <View style={styles.searchBoxCompact}>
                        <MaterialCommunityIcons name="magnify" size={16} color="#94A3B8" />
                        <TextInput
                            style={styles.tinySearchInput}
                            placeholder="Find task..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    {!isSubcontractor ? (
                        <TouchableOpacity
                            style={[styles.createTaskBtn, { paddingHorizontal: isCompact ? 12 : 16, height: isCompact ? 40 : 44 }]}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('TaskCreate')}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                            <Text style={[styles.createTaskBtnText, { fontSize: isCompact ? 12 : 13 }]}>New</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Sub-Header: Tabs */}
                <View style={styles.toolbarCompact}>
                    <View style={styles.tabBarCompact}>
                        {!isSubcontractor ? (
                            <TouchableOpacity 
                                style={[styles.smallTab, filterTab === 'all' && styles.smallTabActive]} 
                                onPress={() => setFilterTab('all')}
                            >
                                <Text style={[styles.smallTabText, filterTab === 'all' && styles.smallTabTextActive]}>ALL</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity 
                            style={[styles.smallTab, filterTab === 'my' && styles.smallTabActive]} 
                            onPress={() => setFilterTab('my')}
                        >
                            <Text style={[styles.smallTabText, filterTab === 'my' && styles.smallTabTextActive]}>MY TASKS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <Animated.FlatList
                data={hierarchicalTasks}
                keyExtractor={(item, index) => item._id ? `task-${item._id}` : `task-idx-${index}`}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isCompact ? 12 : 16 }]}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                    const statusColors = {
                        todo: { color: '#64748B', bg: '#F1F5F9', label: 'TODO' },
                        in_progress: { color: '#3B82F6', bg: '#EFF6FF', label: 'LIVE' },
                        review: { color: '#F59E0B', bg: '#FFFBEB', label: 'REVIEW' },
                        completed: { color: '#10B981', bg: '#ECFDF5', label: 'DONE' }
                    };
                    const sc = statusColors[item.status] || statusColors.todo;
                    const level = item.level || 0;

                        // Damped spacing scheme to scale for infinite hierarchies
                        const dynamicMargin = level === 0 ? 0 : level === 1 ? 18 : level === 2 ? 32 : Math.min(32 + (level - 2) * 8, 60);
                        const isDeepLevel = level >= 3;

                        return (
                            <View style={[styles.taskItemWrapper, { marginLeft: dynamicMargin }]}>
                                {level > 0 && (
                                    <View style={styles.treeConnector}>
                                        <View style={[styles.connectorVertical, { bottom: 25 }]} />
                                        <View style={styles.connectorHorizontal} />
                                    </View>
                                )}
                                <TouchableOpacity 
                                    style={[
                                        styles.taskTableRow, 
                                        SHADOWS.small,
                                        level > 0 && styles.subtaskCard,
                                        level > 1 && styles.deepSubtaskCard,
                                        isDeepLevel && { padding: 8 } // Tighter padding for deep hierarchy
                                    ]} 
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('TaskHierarchyDetail', { taskId: item._id || item.id })}
                                    onLongPress={isSubcontractor ? undefined : () => openTaskActions(item)}
                                >
                                    <View style={styles.tableTopRow}>
                                        <View style={styles.tableNameCol}>
                                            <View style={[styles.indicatorLine, { backgroundColor: sc.color }]} />
                                            <View style={{ flex: 1 }}>
                                                <View style={styles.badgeRow}>
                                                    <View style={[styles.typeBadge, { backgroundColor: level === 0 ? '#EFF6FF' : (level === 1 ? '#F0FDF4' : '#FFF7ED') }]}>
                                                        <Text style={[styles.typeBadgeText, { color: level === 0 ? '#3B82F6' : (level === 1 ? '#22C55E' : '#F97316') }]}>
                                                            {level === 0 ? 'MAIN TASK' : (level === 1 ? 'SUBTASK' : `LEVEL ${level}`)}
                                                        </Text>
                                                    </View>
                                                    {level > 0 && (
                                                        <View style={styles.parentTag}>
                                                            <Text style={styles.parentTagText} numberOfLines={1}>
                                                                OF: {(visibleTasks.find(t => String(t._id || t.id) === String(item.parentTaskId ? (item.parentTaskId?._id || item.parentTaskId) : ''))?.title || 'Parent').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                    {item.hasChildren && (
                                                        <TouchableOpacity 
                                                            style={{ padding: 4 }}
                                                            onPress={() => {
                                                                const newCollapsed = new Set(collapsedNodes);
                                                                const id = String(item._id || item.id);
                                                                if (newCollapsed.has(id)) {
                                                                    newCollapsed.delete(id);
                                                                } else {
                                                                    newCollapsed.add(id);
                                                                }
                                                                setCollapsedNodes(newCollapsed);
                                                            }}
                                                        >
                                                            <MaterialCommunityIcons 
                                                                name={item.isCollapsed ? 'chevron-right' : 'chevron-down'} 
                                                                size={18} 
                                                                color="#64748B" 
                                                            />
                                                        </TouchableOpacity>
                                                    )}
                                                    <Text style={[styles.taskTitleText, { fontSize: isDeepLevel ? 12 : (isCompact ? 13 : 15) }]} numberOfLines={1}>{item.title}</Text>
                                                </View>
                                                <Text style={styles.projectContextText} numberOfLines={1}>
                                                    {item.projectId?.name || item.project || 'Main Project'}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <View style={styles.tableMetricCol}>
                                            <View style={[styles.miniStatusBadge, { backgroundColor: sc.bg, borderColor: sc.color + '20' }]}>
                                                <Text style={[styles.miniStatusText, { color: sc.color }]}>{sc.label}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.tableBottomRow}>
                                        <View style={[styles.assigneeCol, { flex: 1.5 }]}>
                                            <MaterialCommunityIcons name="account-circle-outline" size={12} color="#94A3B8" />
                                            <Text style={styles.assigneeText} numberOfLines={1} adjustsFontSizeToFit>
                                                {Array.isArray(item.assignedTo) && item.assignedTo.length > 0 
                                                    ? item.assignedTo[0].fullName 
                                                    : (item.assignedTo?.fullName || 'Unassigned')}
                                            </Text>
                                        </View>
                                        <View style={[styles.dateCol, { flex: 1 }]}>
                                            <MaterialCommunityIcons name="calendar-clock" size={12} color="#94A3B8" />
                                            <Text style={styles.tableDateText} numberOfLines={1}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No Date'}</Text>
                                        </View>
                                        {!isSubcontractor ? (
                                            <View style={styles.actionsCol}>
                                                <TouchableOpacity onPress={() => handleOpenModal(item)}>
                                                    <MaterialCommunityIcons name="pencil" size={isDeepLevel ? 12 : 14} color="#64748B" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => promptDeleteTask(item)}>
                                                    <MaterialCommunityIcons name="trash-can-outline" size={isDeepLevel ? 12 : 14} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            </View>
                    );
                }}
            />

            <Modal visible={modalVisible} animationType="slide" transparent={true} statusBarTranslucent presentationStyle="overFullScreen">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                    <View style={[styles.modalContent, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isCompact ? 16 : 20 }]}>
                        <View style={styles.modalIndicator} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingTask ? 'Edit Task' : 'Create New Task'}</Text>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                        >
                            <CustomInput
                                label="Task Title"
                                placeholder="e.g. Install Safety Nets Level 3"
                                value={form.title}
                                onChangeText={t => setForm({ ...form, title: t })}
                            />

                            <DropdownField 
                                label="Project" 
                                value={form.project} 
                                onPress={() => openDropdown('Project', 
                                    projects.map(p => ({ label: p.name, value: p._id || p.id })),
                                    (val) => {
                                        const p = projects.find(proj => (proj._id || proj.id) === val);
                                        if (p) {
                                            setForm({ ...form, project: p.name, projectId: val, parentTaskId: '' });
                                        }
                                    }
                                )}
                            />

                            <DropdownField 
                                label="Parent Task (Optional)" 
                                value={form.parentTaskId ? (visibleTasks.find(t => String(t._id || t.id) === String(form.parentTaskId))?.title || 'Selected') : 'None (Top Level)'} 
                                onPress={() => openDropdown('Parent Task', 
                                    [
                                        { label: 'None (Top Level)', value: 'NONE' },
                                        ...(visibleTasks || [])
                                            .filter(
                                                (t) =>
                                                    (t.projectId?._id || t.projectId) === form.projectId &&
                                                    (t._id || t.id) !== (editingTask?._id || editingTask?.id) &&
                                                    !t.isSubTask &&
                                                    !t.isJobTask
                                            )
                                            .map((t) => ({ label: t.title, value: t._id || t.id }))
                                    ],
                                    (val) => {
                                        if (val === 'NONE') {
                                            setForm({ ...form, parentTaskId: '' });
                                        } else {
                                            setForm({ ...form, parentTaskId: val });
                                        }
                                    }
                                )}
                            />

                            <View style={[styles.formGrid, isCompact && styles.formGridStacked]}>
                                <DropdownField 
                                    label="Role" 
                                    value={form.assignedRoleType ? ROLE_LABELS[form.assignedRoleType] : 'Any Role'} 
                                    onPress={() =>
                                        openDropdown(
                                            'Assign Role',
                                            [{ label: 'Any Role', value: '' }, ...getAssignableRoleOptions(user?.role)],
                                            (val) => setForm({ ...form, assignedRoleType: val, assignedTo: [] })
                                        )
                                    }
                                />
                                <DropdownField 
                                    label="Assign To" 
                                    value={form.assignedTo.length > 0 ? (teamMembers.find(m => (m._id || m.id) === form.assignedTo[0])?.fullName || 'Selected') : 'Unassigned'} 
                                    onPress={() => openDropdown('Assign To', 
                                        filteredTeam.map(m => ({ label: m.fullName, value: m._id || m.id })),
                                        (val) => setForm({ ...form, assignedTo: [val] })
                                    )}
                                />
                            </View>

                            <View style={[styles.formGrid, isCompact && styles.formGridStacked]}>
                                <DropdownField 
                                    label="Category" 
                                    value={form.category} 
                                    onPress={() => openDropdown('Category', 
                                        [{ label: 'TASK', value: 'TASK' }, { label: 'TODO', value: 'TODO' }],
                                        (val) => setForm({ ...form, category: val })
                                    )}
                                />
                                <DropdownField 
                                    label="Priority" 
                                    value={form.priority} 
                                    onPress={() => openDropdown('Priority', 
                                        [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }],
                                        (val) => setForm({ ...form, priority: val })
                                    )}
                                />
                            </View>

                            <DropdownField 
                                label="Status" 
                                value={form.status.replace('_', ' ').toUpperCase()} 
                                onPress={() => openDropdown('Status', 
                                    [
                                        { label: 'TO DO', value: 'todo' },
                                        { label: 'IN PROGRESS', value: 'in_progress' },
                                        { label: 'REVIEW', value: 'review' },
                                        { label: 'COMPLETED', value: 'completed' }
                                    ],
                                    (val) => setForm({ ...form, status: val })
                                )}
                            />

                            <View style={[styles.formGrid, isCompact && styles.formGridStacked]}>
                                <TouchableOpacity 
                                    style={{ flex: 1 }} 
                                    activeOpacity={0.7}
                                    onPress={() => openDatePicker('startDate')}
                                >
                                    <CustomInput 
                                        label="Start Date" 
                                        placeholder="YYYY-MM-DD" 
                                        value={form.startDate} 
                                        editable={false}
                                        icon="calendar-start"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ flex: 1 }} 
                                    activeOpacity={0.7}
                                    onPress={() => openDatePicker('dueDate')}
                                >
                                    <CustomInput 
                                        label="Due Date" 
                                        placeholder="YYYY-MM-DD" 
                                        value={form.dueDate} 
                                        editable={false}
                                        icon="calendar-check"
                                    />
                                </TouchableOpacity>
                            </View>

                            {Platform.OS === 'ios' && datePickerMode && (
                                <DateTimePicker
                                    value={parsePickerDate(form[datePickerMode])}
                                    mode="date"
                                    display="spinner"
                                    onChange={(event, selectedDate) => {
                                        if (event.type === 'set') {
                                            const savedMode = datePickerMode;
                                            if (selectedDate) {
                                                setForm(prev => ({ ...prev, [savedMode]: formatDate(selectedDate) }));
                                            }
                                        }
                                    }}
                                />
                            )}

                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={styles.descriptionInput}
                                placeholder="Task description..."
                                multiline
                                value={form.description}
                                onChangeText={t => setForm({ ...form, description: t })}
                            />

                            <View style={[styles.modalButtons, isCompact && styles.modalButtonsStacked]}>
                                <View style={styles.modalBtnCol}>
                                    <CustomButton title="Cancel" type="outline" onPress={() => setModalVisible(false)} />
                                </View>
                                <View style={[styles.modalBtnCol, styles.modalBtnColPrimary]}>
                                    <CustomButton title={editingTask ? 'Save' : 'Create'} onPress={handleSave} loading={loading} />
                                </View>
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* STABLE COMPACT SELECTOR MODAL */}
            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={i} style={styles.selItem} onPress={() => selOnSelect(opt.value)}>
                                    <Text style={styles.selLabel}>{opt.label}</Text>
                                    {form[selTitle.toLowerCase().replace(' ', '')] === opt.value && (
                                        <MaterialCommunityIcons name="check" size={16} color="#3B82F6" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selClose} onPress={() => setSelVisible(false)}>
                            <Text style={styles.selCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    stickyHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 10 },
    headerTopRowCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    titleSection: { flex: 1 },
    mainTitleCompact: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    mainSubtitleCompact: { fontSize: 11, fontWeight: '700', color: '#64748B' },
    
    createTaskBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 12, gap: 6, marginLeft: 10 },
    createTaskBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

    toolbarCompact: { flexDirection: 'row', alignItems: 'center' },
    searchBoxCompact: { 
        flex: 1,
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F8FAFC', 
        borderRadius: 12, 
        height: 44, 
        paddingHorizontal: 12, 
        borderWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    tinySearchInput: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '600', color: '#1E293B' },

    tabBarCompact: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, height: 34 },
    smallTab: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
    smallTabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
    smallTabText: { fontSize: 8, fontWeight: '900', color: '#64748B' },
    smallTabTextActive: { color: '#0F172A' },

    scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 100 },

    taskTableRow: { 
        backgroundColor: '#fff', 
        borderRadius: 16, 
        padding: 12, 
        marginBottom: 10, 
        borderWidth: 1, 
        borderColor: '#F1F5F9' 
    },
    tableTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    tableNameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    indicatorLine: { width: 3, height: 22, borderRadius: 2 },
    taskTitleText: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    projectContextText: { fontSize: 10, fontWeight: '700', color: '#64748B' },

    tableMetricCol: { alignItems: 'flex-end', gap: 4 },
    priorityText: { fontSize: 8, fontWeight: '900', color: '#94A3B8' },
    miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    miniStatusText: { fontSize: 8, fontWeight: '900' },

    tableBottomRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderTopWidth: 1, 
        borderTopColor: '#F8FAFC', 
        paddingTop: 8 
    },
    assigneeCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    assigneeText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    dateCol: { flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 },
    tableDateText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    actionsCol: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    taskItemWrapper: { position: 'relative' },
    treeConnector: {
        position: 'absolute',
        left: -18,
        top: 0,
        bottom: 0,
        width: 20,
        zIndex: 1,
    },
    connectorVertical: {
        position: 'absolute',
        left: 10,
        top: -20,
        bottom: 25,
        width: 1.5,
        backgroundColor: '#CBD5E1',
    },
    connectorHorizontal: {
        position: 'absolute',
        left: 10,
        top: 25,
        width: 12,
        height: 1.5,
        backgroundColor: '#CBD5E1',
    },
    subtaskCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowOpacity: 0.05
    },
    deepSubtaskCard: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 7,
        fontWeight: '900',
    },
    parentTag: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxWidth: 120
    },
    parentTagText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#64748B'
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, alignSelf: 'center' },
    modalIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },

    label: { fontSize: 9, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', marginBottom: 6, marginTop: 10, letterSpacing: 1 },
    compactDropdown: { 
        height: 42, 
        backgroundColor: '#fff', 
        borderRadius: 10, 
        borderWidth: 1.5, 
        borderColor: '#3B82F633', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginBottom: 8
    },
    dropdownValue: { fontSize: 13, fontWeight: '800', color: '#1E293B' },

    formGrid: { flexDirection: 'row', gap: 12 },
    formGridStacked: { flexDirection: 'column', gap: 8 },
    descriptionInput: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 12, 
        padding: 12, 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        fontSize: 14, 
        fontWeight: '600', 
        color: '#1E293B', 
        textAlignVertical: 'top',
        minHeight: 60,
        marginBottom: 16
    },
    modalButtons: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 12,
        marginTop: 8,
        width: '100%'
    },
    modalBtnCol: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center'
    },
    modalBtnColPrimary: {
        flex: 1.4
    },
    modalButtonsStacked: {
        flexDirection: 'column'
    },

    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '82%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
    selTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase' },
    selItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
    selClose: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    selCloseText: { fontSize: 13, fontWeight: '900', color: '#64748B', textTransform: 'uppercase' }
});

export default TasksScreen;
