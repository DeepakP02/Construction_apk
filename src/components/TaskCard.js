import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import StatusBadge from './StatusBadge';
import { moderateScale } from '../utils/responsive';

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
                        <MaterialCommunityIcons name="dots-horizontal" size={moderateScale(22)} color={COLORS.textMuted} />
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
                         <View style={[styles.priorityBadge, { backgroundColor: task.priority === 'High' ? '#FEF2F2' : COLORS.surfaceSecondary }]}>
                            <View style={[styles.priorityDot, { backgroundColor: task.priority === 'High' ? '#EF4444' : '#3B82F6' }]} />
                            <Text style={[styles.priorityText, { color: task.priority === 'High' ? '#EF4444' : COLORS.textSecondary }]}>{(task.priority || 'Medium').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.dateRow}>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-import" size={moderateScale(14)} color={COLORS.textMuted} />
                        <Text style={styles.dateValue}>{task.startDate ? new Date(task.startDate).toLocaleDateString() : '—'}</Text>
                    </View>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-clock" size={moderateScale(14)} color={COLORS.textMuted} />
                        <Text style={styles.dateValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    premiumCard: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: SPACING.m,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.m },
    headerLeft: { flex: 1 },
    taskTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: SPACING.s },
    textStrikethrough: { textDecorationLine: 'line-through', color: COLORS.textMuted },
    headerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    progressBox: { backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: SPACING.s, paddingVertical: SPACING.xs, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    progressText: { ...TYPOGRAPHY.badge, color: '#2563EB' },
    projectContext: { flex: 1 },
    projectName: { ...TYPOGRAPHY.badge, color: COLORS.textSecondary },
    editBtn: { alignSelf: 'flex-start', marginLeft: SPACING.s },

    cardBody: { gap: SPACING.sm },
    metaGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACING.s },
    metaItem: { minWidth: '45%', flex: 1 },
    assigneeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    avatar: { width: moderateScale(32), height: moderateScale(32), borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    avatarText: { ...TYPOGRAPHY.label, color: '#2563EB' },
    assigneeName: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },

    priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: SPACING.xs, borderRadius: 8 },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },
    priorityText: { ...TYPOGRAPHY.badge },

    dateRow: { flexDirection: 'row', gap: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.separator },
    dateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateValue: { ...TYPOGRAPHY.badge, color: COLORS.textMuted },
});

export default TaskCard;

