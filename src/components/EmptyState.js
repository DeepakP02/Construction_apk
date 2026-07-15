import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { moderateScale } from '../utils/responsive';

const EmptyState = ({ title, message, icon = 'tray' }) => {
    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name={icon} size={moderateScale(60)} color={COLORS.border} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    title: {
        ...TYPOGRAPHY.cardTitle,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
        textAlign: 'center',
    },
    message: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.s,
    },
});

export default EmptyState;

