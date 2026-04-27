import React from 'react';
import {
    View, Text, StyleSheet, StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import WorkerHeader from '../../components/WorkerHeader';

const ClientJobsScreen = () => {
    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Objectives" hideSearch />

            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="briefcase-variant-outline" size={80} color="#E2E8F0" />
                <Text style={styles.emptyTitle}>Project Operations</Text>
                <Text style={styles.emptySubtitle}>Content is being updated by the Project Manager.</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#FFFFFF' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginTop: 8 },
});

export default ClientJobsScreen;
