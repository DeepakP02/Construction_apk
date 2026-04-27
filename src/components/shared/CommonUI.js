import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS, SIZES, SPACING } from '../../constants/theme';
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
        borderRadius: moderateScale(SIZES.radius || 12),
        padding: moderateScale(SPACING.m || 16),
        marginBottom: verticalScale(SPACING.s || 8),
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    badge: {
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(20),
    },
    badgeText: {
        fontSize: moderateScale(10),
        fontWeight: '900',
    },
});
