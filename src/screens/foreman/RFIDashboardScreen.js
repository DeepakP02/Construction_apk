import React from 'react';
import {
    View, Text, StyleSheet, StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';

const RFIDashboardScreen = () => {
    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="RFI Portal" hideSearch />

            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="file-question-outline" size={80} color="#E2E8F0" />
                <Text style={styles.emptyTitle}>RFI Portal</Text>
                <Text style={styles.emptySubtitle}>Content is being updated by the Project Manager.</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.surface },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, marginTop: SPACING.m },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
});

export default RFIDashboardScreen;
