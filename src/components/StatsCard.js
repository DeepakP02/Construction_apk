import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const StatsCard = ({ label, value, icon, color = COLORS.primary }) => {
    return (
        <View style={styles.card}>
            <View style={styles.top}>
                {/* Colored icon badge - exact KAAL design */}
                <View style={[styles.badge, { backgroundColor: color }]}>
                    <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
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
        borderRadius: 14,
        padding: 14,
        width: '48%',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    badge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '700',
        letterSpacing: 0.5,
        flex: 1,
    },
    value: {
        fontSize: 36,
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: -1,
    },
});

export default StatsCard;
