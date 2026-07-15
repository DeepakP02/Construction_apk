import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { getServerUrl } from '../utils/api';

const IssueCard = ({ issue }) => {
    const getPriorityColor = () => {
        const p = issue.priority || 'medium';
        switch (p.toLowerCase()) {
            case 'high': return COLORS.danger;
            case 'medium': return COLORS.primary;
            default: return COLORS.info;
        }
    };

    const priorityColor = getPriorityColor();
    const getAttachmentUrl = (att) => {
        if (!att) return null;
        if (typeof att === 'string') return att;
        return att.url || att.imageUrl || att.uri || null;
    };

    const photoArray = [
        ...(issue.attachments || []),
        ...(issue.images || []),
        ...(issue.photoIds || [])
    ];
    const firstPhoto = photoArray.length > 0 ? getAttachmentUrl(photoArray[0]) : null;
    const hasImage = !!firstPhoto;

    return (
        <View style={styles.card}>
            <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
            <View style={styles.content}>
                <View style={styles.mainRow}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <Text style={styles.title} numberOfLines={1}>{issue.title}</Text>
                            <View style={[styles.badge, { backgroundColor: priorityColor + '15' }]}>
                                <Text style={[styles.badgeText, { color: priorityColor }]}>{issue.priority}</Text>
                            </View>
                        </View>
                        <View style={styles.footer}>
                            <View style={styles.meta}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
                                <Text style={styles.metaText}>{issue.date || 'Today'}</Text>
                            </View>
                            <View style={styles.meta}>
                                <MaterialCommunityIcons name="tag-outline" size={14} color={COLORS.textSecondary} />
                                <Text style={styles.metaText}>ID: #{String(issue._id || issue.id).slice(-4)}</Text>
                            </View>
                        </View>
                    </View>

                    {hasImage && (
                        <View style={styles.thumbnailContainer}>
                            <Image 
                                source={{ uri: getServerUrl(firstPhoto) }} 
                                style={styles.thumbnail} 
                            />
                        </View>
                    )}
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    priorityIndicator: {
        width: 4,
        height: '100%',
    },
    content: {
        flex: 1,
        padding: SPACING.m,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    thumbnailContainer: {
        width: 50,
        height: 50,
        borderRadius: SPACING.s,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.s,
    },
    title: {
        ...TYPOGRAPHY.subtitle,
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: SPACING.s,
    },
    badge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        ...TYPOGRAPHY.badge,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    metaText: {
        ...TYPOGRAPHY.label,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginLeft: SPACING.xs,
    },
});

export default IssueCard;

