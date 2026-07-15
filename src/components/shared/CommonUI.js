import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { scale, verticalScale, moderateScale } from '../../utils/responsive';

export const Card = ({ children, style, onPress }) => {
    const Component = onPress ? TouchableOpacity : View;
    return (
        <Component 
            onPress={onPress} 
            activeOpacity={0.8} 
            style={[styles.card, SHADOWS.card, style]}
        >
            {children}
        </Component>
    );
};

export const Badge = ({ label, color, bg }) => (
    <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: SPACING.m,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    badge: {
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: SIZES.radiusCard,
    },
    badgeText: {
        ...TYPOGRAPHY.badge,
    },
});

