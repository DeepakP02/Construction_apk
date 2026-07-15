import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { moderateScale } from '../utils/responsive';

const StatsCard = ({ label, value, icon, color = COLORS.primary }) => {
    return (
        <View style={styles.card}>
            <View style={styles.top}>
                {/* Colored icon badge - exact KAAL design */}
                <View style={[styles.badge, { backgroundColor: color }]}>
                    <MaterialCommunityIcons name={icon} size={moderateScale(18)} color="#FFFFFF" />
                </View>
                <Text style={styles.label}>{label.toUpperCase()}</Text>
            </View>
            <Text style={styles.value}>{value}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: SPACING.m,
        width: '48%',
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginBottom: SPACING.sm,
    },
    badge: {
        width: moderateScale(32),
        height: moderateScale(32),
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textSecondary,
        flex: 1,
    },
    value: {
        fontSize: moderateScale(34),
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: -1,
    },
});

export default StatsCard;

