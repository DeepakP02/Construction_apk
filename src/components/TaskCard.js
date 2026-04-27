import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import StatusBadge from './StatusBadge';

const TaskCard = ({ task, onEdit, onStatusToggle }) => {
    const isCompleted = ['completed', 'done', 'Completed', 'Done'].includes(task.status);
    const assignedName = Array.isArray(task.assignedTo)
        ? (task.assignedTo[0]?.fullName || task.assignedTo[0]?.name || 'Member')
        : (task.assignedTo?.fullName || task.assignedTo?.name || task.assignedTo || 'Unassigned');

    return (
        <View style={[styles.premiumCard, SHADOWS.card]}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.taskTitle, isCompleted && styles.textStrikethrough]} numberOfLines={2}>
                        {task.title || 'Untitled Job'}
                    </Text>
                    <View style={styles.headerMeta}>
                         <View style={styles.progressBox}>
                            <Text style={styles.progressText}>{task.progress || 0}%</Text>
                        </View>
                        <View style={styles.projectContext}>
                            <Text style={styles.projectName} numberOfLines={1}>
                                {task.projectId?.name || 'Main Site'}
                            </Text>
                        </View>
                    </View>
                </View>
                {onEdit && (
                    <TouchableOpacity onPress={() => onEdit(task)} style={styles.editBtn}>
                        <MaterialCommunityIcons name="dots-horizontal" size={22} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.cardBody}>
                <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                        <View style={styles.assigneeBox}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{assignedName.charAt(0)}</Text>
                            </View>
                            <Text style={styles.assigneeName} numberOfLines={1}>{assignedName}</Text>
                        </View>
                    </View>
                    <View style={styles.metaItem}>
                        <StatusBadge status={task.status || 'todo'} />
                    </View>
                    <View style={[styles.metaItem, { alignItems: 'flex-end' }]}>
                         <View style={[styles.priorityBadge, { backgroundColor: task.priority === 'High' ? '#FEF2F2' : '#F1F5F9' }]}>
                            <View style={[styles.priorityDot, { backgroundColor: task.priority === 'High' ? '#EF4444' : '#3B82F6' }]} />
                            <Text style={[styles.priorityText, { color: task.priority === 'High' ? '#EF4444' : '#64748B' }]}>{(task.priority || 'Medium').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.dateRow}>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-import" size={14} color="#94A3B8" />
                        <Text style={styles.dateValue}>{task.startDate ? new Date(task.startDate).toLocaleDateString() : '—'}</Text>
                    </View>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-clock" size={14} color="#94A3B8" />
                        <Text style={styles.dateValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    premiumCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    headerLeft: { flex: 1 },
    taskTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', letterSpacing: -0.5, marginBottom: 8 },
    textStrikethrough: { textDecorationLine: 'line-through', color: '#94A3B8' },
    headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    progressBox: { backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    progressText: { fontSize: 10, fontWeight: '900', color: '#2563EB' },
    projectContext: { flex: 1 },
    projectName: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    editBtn: { alignSelf: 'flex-start', marginLeft: 8 },

    cardBody: { gap: 12 },
    metaGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
    metaItem: { minWidth: '45%', flex: 1 },
    assigneeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
    assigneeName: { fontSize: 12, fontWeight: '800', color: '#475569' },

    priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },
    priorityText: { fontSize: 10, fontWeight: '900' },

    dateRow: { flexDirection: 'row', gap: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    dateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateValue: { fontSize: 11, fontWeight: '800', color: '#94A3B8' },
});

export default TaskCard;
