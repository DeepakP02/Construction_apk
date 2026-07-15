import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, Animated, Modal, TouchableOpacity, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import ForemanDashboard from './ForemanDashboard';
import api from '../../utils/api';

const ForemanDashboardScreen = ({ navigation }) => {
    const { user, isClockedIn, toggleClock, getWorkDuration, refreshData, projects, tasks } = useApp();
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        let interval;
        if (isClockedIn) {
            interval = setInterval(() => {
                setTimer(getWorkDuration() || '00:00:00');
            }, 1000);
        } else {
            setTimer('00:00:00');
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isClockedIn]);

    const handleClockToggle = async (pId = null, tId = null) => {
        try {
            if (!isClockedIn && !pId) {
                setClockModal(true);
                return;
            }
            await toggleClock(pId, tId);
            setClockModal(false);
            refreshData();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('Attendance Error', errorMsg || 'Could not sync with server.');
        }
    };

    const projectTasks = tasks.filter(t => 
        (t.projectId?._id || t.projectId) === (selectedProject?._id || selectedProject?.id)
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} />
            
            <ForemanDashboard navigation={navigation} />

            <Modal visible={clockModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, SHADOWS.large]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Attendance & Timer</Text>
                            <TouchableOpacity onPress={() => setClockModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={{ marginBottom: SPACING.m }}>
                            <Text style={styles.modalSub}>1. Select working site (Required)</Text>
                            <View style={styles.projectList}>
                                {projects.map(p => (
                                    <TouchableOpacity
                                        key={p._id || p.id}
                                        style={[styles.projectItem, (selectedProject?._id || selectedProject?.id) === (p._id || p.id) && styles.projectItemActive]}
                                        onPress={() => {
                                            setSelectedProject(p);
                                            setSelectedTask(null);
                                        }}
                                    >
                                        <View style={styles.projectIcon}>
                                            <MaterialCommunityIcons name="office-building" size={20} color={(selectedProject?._id || selectedProject?.id) === (p._id || p.id) ? '#fff' : COLORS.primary} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.projectName, (selectedProject?._id || selectedProject?.id) === (p._id || p.id) && { color: COLORS.white }]}>{p.name}</Text>
                                        </View>
                                        {(selectedProject?._id || selectedProject?.id) === (p._id || p.id) && <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {selectedProject && (
                                <>
                                    <Text style={styles.modalSub}>2. Select active task (Optional)</Text>
                                    <View style={styles.projectList}>
                                        <TouchableOpacity
                                            style={[styles.projectItem, !selectedTask && styles.projectItemActive, { height: 50, padding: 10 }]}
                                            onPress={() => setSelectedTask(null)}
                                        >
                                            <Text style={[styles.projectName, { fontSize: 13 }, !selectedTask && { color: COLORS.white }]}>General Attendance</Text>
                                            {!selectedTask && <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />}
                                        </TouchableOpacity>
                                        
                                        {projectTasks.map(t => (
                                            <TouchableOpacity
                                                key={t._id || t.id}
                                                style={[styles.projectItem, (selectedTask?._id || selectedTask?.id) === (t._id || t.id) && styles.projectItemActive, { height: 50, padding: 10 }]}
                                                onPress={() => setSelectedTask(t)}
                                            >
                                                <Text style={[styles.projectName, { fontSize: 13 }, (selectedTask?._id || selectedTask?.id) === (t._id || t.id) && { color: COLORS.white }]}>{t.title}</Text>
                                                {(selectedTask?._id || selectedTask?.id) === (t._id || t.id) && <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.confirmBtn, !selectedProject && { opacity: 0.5 }]}
                            disabled={!selectedProject}
                            onPress={() => handleClockToggle(selectedProject?._id || selectedProject?.id, selectedTask?._id || selectedTask?.id)}
                        >
                            <Text style={styles.confirmBtnText}>
                                {selectedTask ? 'START TASK TIMER' : 'CLOCK IN TO SITE'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: SPACING.m, paddingBottom: 100 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', padding: SPACING.m },
    modalContent: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusModal, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5 },
    modalSub: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700', marginBottom: SPACING.m },
    projectList: { marginBottom: SPACING.m },
    projectItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderRadius: 18, marginBottom: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    projectItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    projectIcon: { width: 40, height: 40, borderRadius: SIZES.radiusBtn, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    projectName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
    projectLoc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    confirmBtn: { width: '100%', padding: SPACING.m, borderRadius: SIZES.radiusCard, backgroundColor: COLORS.primary, alignItems: 'center' },
    confirmBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    confirmBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, marginTop: SPACING.m },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', marginTop: 8 }
});

export default ForemanDashboardScreen;
