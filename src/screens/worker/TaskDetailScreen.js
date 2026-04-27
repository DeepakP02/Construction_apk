import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    StatusBar, Dimensions, Animated, ActivityIndicator, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TaskDetailScreen = ({ navigation, route }) => {
    const { taskId } = route.params || {};
    const { tasks, metrics, updateTask, deleteTask, refreshData } = useApp();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [form, setForm] = useState({ title: '', status: '', priority: '', description: '' });
    
    // Find task in local stores (Global tasks OR Worker Metrics)
    const workerTasks = metrics?.workerMetrics?.assignedTasks || [];
    const task = (tasks || []).find(t => (t.taskId?._id || t.taskId || t._id || t.id) === taskId) || 
                 workerTasks.find(t => (t.taskId?._id || t.taskId || t._id || t.id) === taskId);

    // CRITICAL: Get the verified actual task ID for the backend update
    const finalTaskId = task?._id || task?.id || task?.taskId?._id || (typeof task?.taskId === 'string' ? task.taskId : null);

    if (!task || !task.title || !finalTaskId) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#94A3B8" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '700' }}>Task data missing</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#3B82F6', fontWeight: '900' }}>GO BACK</Text>
                </TouchableOpacity>
            </View>
        );
    }
    
    const isCompleted = ['completed', 'complete', 'done'].includes((task.status || '').toLowerCase());
    const progress = task.progress !== undefined ? task.progress : (isCompleted ? 100 : (task.status === 'active' || task.status === 'in_progress' ? 40 : 0));
    const priority = (task.priority || 'Medium').toLowerCase();
    const priorityColor = priority === 'high' ? '#EF4444' : (priority === 'medium' ? '#F97316' : '#3B82F6');

    const handleToggleStatus = async () => {
        const nextStatus = isCompleted ? 'todo' : 'completed';
        setLoading(true);
        await updateTask(finalTaskId, { status: nextStatus });
        setLoading(false);
    };

    const renderInfoRow = (icon, label, value, color = '#64748B') => (
        <View style={styles.infoRow}>
            <View style={[styles.iconContainer, { backgroundColor: color + '10' }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value || 'Not specified'}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Custom Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Task Details</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={() => setMenuVisible(true)}>
                    <MaterialCommunityIcons name="dots-vertical" size={24} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {/* Menu Modal */}
            <Modal visible={menuVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuContent, { top: insets.top + 60 }]}>
                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={() => { 
                                setMenuVisible(false); 
                                setForm({
                                    title: task.title,
                                    status: task.status || 'todo',
                                    priority: task.priority || 'Medium',
                                    description: task.description || ''
                                });
                                setEditModalVisible(true);
                            }}
                        >
                            <MaterialCommunityIcons name="pencil" size={20} color="#475569" />
                            <Text style={styles.menuItemText}>Edit Task</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={async () => { 
                                setMenuVisible(false); 
                                const success = await deleteTask(finalTaskId);
                                if (success) navigation.goBack();
                            }}
                        >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                            <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Task</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Title Section */}
                <View style={styles.titleSection}>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '15' }]}>
                        <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                        <Text style={[styles.priorityText, { color: priorityColor }]}>{priority.toUpperCase()} PRIORITY</Text>
                    </View>
                    <Text style={styles.mainTitle}>{task.title}</Text>
                    <View style={styles.projectIdRow}>
                        <MaterialCommunityIcons name="tag-outline" size={14} color="#94A3B8" />
                        <Text style={styles.projectIdText}>ID: {task._id ? task._id.slice(-6).toUpperCase() : 'N/A'}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.projectIdText}>{task.category || 'TASK'}</Text>
                    </View>
                </View>

                {/* Progress Section */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Current Progress</Text>
                        <Text style={styles.progressPercent}>{progress}%</Text>
                    </View>
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progress === 100 ? '#10B981' : '#3B82F6' }]} />
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Overall Status</Text>
                        <View style={[styles.statusPill, { backgroundColor: isCompleted ? '#ECFDF5' : '#EFF6FF' }]}>
                            <Text style={[styles.statusPillText, { color: isCompleted ? '#10B981' : '#3B82F6' }]}>
                                {(task.status || 'todo').toUpperCase().replace('_', ' ')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Project Details */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Project Context</Text>
                    {(task.projectId?.name || task.projectName) && renderInfoRow('office-building', 'Project Name', task.projectId?.name || task.projectName, '#3B82F6')}
                    
                    {/* Dynamic Assignee Resolution */}
                    {renderInfoRow('account-group', 'Assigned To', 
                        Array.isArray(task.assignedTo) 
                        ? task.assignedTo.map(a => a.fullName || a.name || 'User').join(', ')
                        : (task.assignedTo?.fullName || task.assignedTo?.name || 'Unassigned'), 
                        '#6366F1'
                    )}

                    {task.assignedRoleType && renderInfoRow('account-tie', 'Assigned Role', task.assignedRoleType, '#10B981')}
                    {(task.startDate || task.dueDate) && renderInfoRow('calendar-range', 'Timeline', `${task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Start'} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'End'}`, '#F59E0B')}
                </View>

                {/* Description */}
                {task.description ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Description</Text>
                        <Text style={styles.descriptionText}>{task.description}</Text>
                    </View>
                ) : null}

                {/* Action Button */}
                <TouchableOpacity 
                    style={[styles.mainActionBtn, isCompleted && styles.completedActionBtn]} 
                    onPress={handleToggleStatus}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name={isCompleted ? "close-circle-outline" : "check-circle-outline"} size={22} color="#fff" />
                            <Text style={styles.mainActionText}>
                                {isCompleted ? "MARK AS INCOMPLETE" : "MARK AS COMPLETED"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Edit Task Modal */}
            <Modal visible={editModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentFull}>
                        <View style={styles.modalIndicator} />
                        <Text style={styles.modalTitle}>Edit Task Details</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formItem}>
                                <Text style={styles.fieldLabel}>TITLE</Text>
                                <TouchableOpacity style={styles.inputWrapper}>
                                    <MaterialCommunityIcons name="format-title" size={18} color="#64748B" />
                                    <Text style={styles.inputText}>{form.title}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formItem}>
                                <Text style={styles.fieldLabel}>PRIORITY</Text>
                                <View style={styles.pillRow}>
                                    {['Low', 'Medium', 'High'].map(p => (
                                        <TouchableOpacity 
                                            key={p} 
                                            style={[styles.pill, form.priority === p && styles.pillActive]} 
                                            onPress={() => setForm({ ...form, priority: p })}
                                        >
                                            <Text style={[styles.pillText, form.priority === p && styles.pillTextActive]}>{p.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formItem}>
                                <Text style={styles.fieldLabel}>STATUS</Text>
                                <View style={styles.pillRow}>
                                    {['todo', 'in_progress', 'completed'].map(s => (
                                        <TouchableOpacity 
                                            key={s} 
                                            style={[styles.pill, form.status === s && styles.pillActive]} 
                                            onPress={() => setForm({ ...form, status: s })}
                                        >
                                            <Text style={[styles.pillText, form.status === s && styles.pillTextActive]}>{s.replace('_', ' ').toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setEditModalVisible(false)}>
                                    <Text style={[styles.modalBtnText, { color: '#64748B' }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalBtn, { backgroundColor: '#3B82F6' }]} 
                                    onPress={async () => {
                                        setLoading(true);
                                        await updateTask(finalTaskId, form);
                                        setLoading(false);
                                        setEditModalVisible(false);
                                        refreshData();
                                    }}
                                >
                                    <Text style={styles.modalBtnText}>SAVE CHANGES</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        paddingBottom: 16, 
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    shareBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20 },
    titleSection: { marginBottom: 24 },
    priorityBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        alignSelf: 'flex-start',
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 8,
        marginBottom: 12,
        gap: 6
    },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },
    priorityText: { fontSize: 9, fontWeight: '900' },
    mainTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.8 },
    projectIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    projectIdText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
    card: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 24, 
        padding: 20, 
        marginBottom: 20, 
        borderWidth: 1, 
        borderColor: '#F1F5F9',
        ...SHADOWS.small 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    cardTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
    progressPercent: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
    progressBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    statusLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    statusPillText: { fontSize: 10, fontWeight: '900' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    infoTextContainer: { flex: 1 },
    infoLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 1 },
    descriptionText: { fontSize: 14, lineHeight: 22, color: '#475569', fontWeight: '600' },
    mainActionBtn: { 
        backgroundColor: '#3B82F6', 
        height: 60, 
        borderRadius: 20, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 12,
        ...SHADOWS.medium 
    },
    completedActionBtn: { backgroundColor: '#64748B' },
    mainActionText: { color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    
    // Menu Styles
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
    menuContent: { 
        position: 'absolute', 
        right: 20, 
        backgroundColor: '#fff', 
        borderRadius: 16, 
        width: 180, 
        padding: 8,
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
    menuItemText: { fontSize: 14, fontWeight: '700', color: '#475569' },
    menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },

    // Edit Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContentFull: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
    modalIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 24 },
    formItem: { marginBottom: 20 },
    fieldLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
    inputWrapper: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    inputText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    pillRow: { flexDirection: 'row', gap: 8 },
    pill: { flex: 1, height: 40, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    pillActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    pillText: { fontSize: 10, fontWeight: '900', color: '#64748B' },
    pillTextActive: { color: '#fff' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
    modalBtn: { flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }
});

export default TaskDetailScreen;
