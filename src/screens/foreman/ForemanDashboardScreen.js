import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, Animated, Modal, TouchableOpacity, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
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
                        
                        <ScrollView style={{ marginBottom: 20 }}>
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
                                            <Text style={[styles.projectName, (selectedProject?._id || selectedProject?.id) === (p._id || p.id) && { color: '#fff' }]}>{p.name}</Text>
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
                                            <Text style={[styles.projectName, { fontSize: 13 }, !selectedTask && { color: '#fff' }]}>General Attendance</Text>
                                            {!selectedTask && <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />}
                                        </TouchableOpacity>
                                        
                                        {projectTasks.map(t => (
                                            <TouchableOpacity
                                                key={t._id || t.id}
                                                style={[styles.projectItem, (selectedTask?._id || selectedTask?.id) === (t._id || t.id) && styles.projectItemActive, { height: 50, padding: 10 }]}
                                                onPress={() => setSelectedTask(t)}
                                            >
                                                <Text style={[styles.projectName, { fontSize: 13 }, (selectedTask?._id || selectedTask?.id) === (t._id || t.id) && { color: '#fff' }]}>{t.title}</Text>
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 16, paddingBottom: 100 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 32, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', letterSpacing: -0.5 },
    modalSub: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 20 },
    projectList: { marginBottom: 20 },
    projectItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    projectItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    projectIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    projectName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
    projectLoc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    confirmBtn: { width: '100%', padding: 20, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginTop: 16 },
    emptySubtitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginTop: 8 }
});

export default ForemanDashboardScreen;
