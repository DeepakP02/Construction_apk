import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../constants/theme';
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

    const firstPhoto = issue.attachments && issue.attachments.length > 0 ? getAttachmentUrl(issue.attachments[0]) : null;
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
        borderRadius: SIZES.radius,
        marginBottom: SPACING.s,
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
        gap: 12,
    },
    thumbnailContainer: {
        width: 50,
        height: 50,
        borderRadius: 8,
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
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    metaText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 4,
        fontWeight: '600',
    },
});

export default IssueCard;
