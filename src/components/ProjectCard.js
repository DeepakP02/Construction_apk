import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import StatusBadge from './StatusBadge';

const ProjectCard = ({ project, onPress, onEdit, index = 0 }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                delay: index * 100,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                delay: index * 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [index]);

    const budgetFormatted = project.budget ? `$${(project.budget / 1000).toFixed(0)}k` : '$0';
    const pmName = project.pmId?.fullName || project.projectManager || 'Unassigned';
    const clientName = project.clientId?.fullName || project.client || 'General';
    const velocity = project.progress || 0;

    // Premium Color Palette mapping
    const velocityColor = velocity > 75 ? '#10B981' : velocity > 40 ? '#F59E0B' : '#3B82F6';
    const velocityBg = velocity > 75 ? '#ECFDF5' : velocity > 40 ? '#FFFBEB' : '#EFF6FF';

    return (
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.card, SHADOWS.medium]}>
                {/* 🏷️ TYPE CHIP */}
                <View style={[styles.typeChip, { backgroundColor: velocityBg }]}>
                    <Text style={[styles.typeText, { color: velocityColor }]}>{(project.type || 'Commercial').toUpperCase()}</Text>
                </View>

                <View style={styles.header}>
                    <View style={styles.titleSection}>
                        <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
                        <View style={styles.locationRow}>
                            <MaterialCommunityIcons name="earth" size={12} color="#64748B" />
                            <Text style={styles.locationText} numberOfLines={1}>{(typeof project.location === 'object' ? project.location?.address : project.location) || 'Site Address TBD'}</Text>
                        </View>
                    </View>
                    <StatusBadge status={project.status || 'Planning'} />
                </View>

                {/* 👥 STAKEHOLDERS */}
                <View style={styles.stakeholderSection}>
                    <View style={styles.stakeholder}>
                        <View style={styles.stakeholderIconBox}>
                            <MaterialCommunityIcons name="account-tie" size={14} color={COLORS.primary} />
                        </View>
                        <View>
                            <Text style={styles.sLabel}>PROJECT MANAGER</Text>
                            <Text style={styles.sVal}>{pmName}</Text>
                        </View>
                    </View>
                    <View style={styles.sDivider} />
                    <View style={styles.stakeholder}>
                        <View style={styles.stakeholderIconBox}>
                            <MaterialCommunityIcons name="briefcase-variant-outline" size={14} color="#6366F1" />
                        </View>
                        <View>
                            <Text style={styles.sLabel}>CLIENT / OWNER</Text>
                            <Text style={styles.sVal}>{clientName}</Text>
                        </View>
                    </View>
                </View>

                {/* 📈 PROGRESS INSIGHTS */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressTitle}>COMPLETION PROGRESS</Text>
                        <View style={[styles.progBadge, { backgroundColor: velocityColor }]}>
                            <Text style={styles.progBadgeText}>{velocity}%</Text>
                        </View>
                    </View>
                    <ProgressBar progress={velocity / 100} color={velocityColor} style={styles.progressBarPremium} />
                </View>

                <View style={styles.footerPremium}>
                    <View style={styles.fMetric}>
                        <MaterialCommunityIcons name="currency-usd" size={14} color="#64748B" />
                        <Text style={styles.fMetricVal}>{budgetFormatted}</Text>
                        <Text style={styles.fMetricLabel}>BUDGET</Text>
                    </View>
                    <View style={styles.fDivider} />
                    <View style={styles.fMetric}>
                        <MaterialCommunityIcons name="calendar-range" size={14} color="#64748B" />
                        <Text style={styles.fMetricVal}>Q1 2026</Text>
                        <Text style={styles.fMetricLabel}>DEADLINE</Text>
                    </View>
                </View>

                <View style={styles.actionRowPremium}>
                    {onEdit && (
                        <TouchableOpacity style={styles.secondaryBtn} onPress={(e) => { e.stopPropagation(); onEdit(project); }}>
                            <MaterialCommunityIcons name="pencil" size={16} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.primaryBtn}>
                        <Text style={styles.primaryBtnText}>VIEW CONSTRUCTION JOBS</Text>
                        <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard + 4,
        padding: SPACING.l,
        marginBottom: SPACING.md,
        marginHorizontal: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    typeChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: SPACING.xs,
        borderRadius: 8,
        marginBottom: SPACING.m,
    },
    typeText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    titleSection: {
        flex: 1,
        marginRight: SPACING.sm,
    },
    name: {
        ...TYPOGRAPHY.sectionTitle,
        color: COLORS.textPrimary,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: SPACING.xs,
    },
    locationText: {
        ...TYPOGRAPHY.label,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    stakeholderSection: {
        flexDirection: 'row',
        backgroundColor: COLORS.surfaceSecondary,
        padding: SPACING.m,
        borderRadius: SIZES.radiusCard,
        marginBottom: SPACING.md,
        alignItems: 'center',
    },
    stakeholder: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stakeholderIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: COLORS.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },
    sVal: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textPrimary,
        marginTop: 1,
    },
    sDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.sm,
    },
    progressContainer: {
        marginBottom: SPACING.l,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    progressTitle: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textSecondary,
        letterSpacing: 1,
    },
    progBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 3,
        borderRadius: 6,
    },
    progBadgeText: {
        ...TYPOGRAPHY.badge,
        color: COLORS.white,
    },
    progressBarPremium: {
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.separator,
    },
    footerPremium: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.separator,
        marginBottom: SPACING.md,
    },
    fMetric: {
        flex: 1,
        alignItems: 'center',
    },
    fMetricVal: {
        ...TYPOGRAPHY.body,
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginTop: 2,
    },
    fMetricLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        marginTop: 2,
    },
    fDivider: {
        width: 1,
        height: 20,
        backgroundColor: COLORS.separator,
    },
    actionRowPremium: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    secondaryBtn: {
        width: 48,
        height: 48,
        borderRadius: SIZES.radiusCard,
        backgroundColor: COLORS.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    primaryBtn: {
        flex: 1,
        height: 48,
        borderRadius: SIZES.radiusBtn,
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.s,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    primaryBtnText: {
        ...TYPOGRAPHY.badge,
        color: COLORS.white,
    },
});

export default ProjectCard;

