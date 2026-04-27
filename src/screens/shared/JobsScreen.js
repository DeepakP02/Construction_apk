import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import api from '../../utils/api';

const JobsScreen = ({ navigation }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/jobs');
            setJobs(res.data);
        } catch (error) {
            console.error('Error fetching jobs:', error);
            // Fallback for demo
            setJobs([
                { id: '1', name: 'Foundation Work', project: 'Skyline Residence', status: 'In Progress' },
                { id: '2', name: 'Electrical Rough-in', project: 'Commercial Plaza', status: 'Pending' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const renderJobItem = ({ item }) => (
        <TouchableOpacity style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.jobName}>{item.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'In Progress' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'In Progress' ? COLORS.success : COLORS.warning }]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>
            <Text style={styles.projectName}>{item.project}</Text>
            <View style={styles.cardFooter}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.timeText}>Updated 2h ago</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <AppHeader title="Jobs Management" />
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={jobs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderJobItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.emptyText}>No jobs found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SPACING.m,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radius,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    jobName: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textPrimary,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
    },
    projectName: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '600',
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 12,
    },
    timeText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 16,
    },
});

export default JobsScreen;
