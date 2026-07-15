import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../constants/theme';
import { moderateScale } from '../utils/responsive';

const StatusBadge = ({ status }) => {
    const getStatusConfig = () => {
        switch (status.toLowerCase()) {
            case 'active':
            case 'on track':
            case 'completed':
                return { color: COLORS.success, label: status };
            case 'at risk':
            case 'delayed':
                return { color: COLORS.danger, label: status };
            case 'pending':
                return { color: COLORS.primary, label: status };
            default:
                return { color: COLORS.textSecondary, label: status };
        }
    };

    const config = getStatusConfig();

    return (
        <View style={[styles.container, { backgroundColor: config.color + '15', borderColor: config.color + '30' }]}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    dot: {
        width: moderateScale(6),
        height: moderateScale(6),
        borderRadius: moderateScale(3),
        marginRight: 6,
    },
    text: {
        ...TYPOGRAPHY.badge,
    },
});

export default StatusBadge;

