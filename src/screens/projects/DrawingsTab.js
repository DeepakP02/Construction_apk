import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import { MOCK_DRAWINGS } from '../../mock/data';

export const DrawingsTab = () => {
    return (
        <View style={styles.container}>
            <FlatList
                data={MOCK_DRAWINGS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.drawingCard}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name="file-pdf-box" size={32} color={COLORS.danger} />
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.name}>{item.name}</Text>
                            <View style={styles.badgeRow}>
                                <View style={styles.versionBadge}>
                                    <Text style={styles.versionText}>{item.version}</Text>
                                </View>
                                <Text style={styles.date}>Updated: {item.date}</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    list: {
        padding: SPACING.m,
    },
    drawingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radius,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.border,
        borderRadius: 8,
    },
    content: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    versionBadge: {
        backgroundColor: COLORS.border,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    versionText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    date: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
});
