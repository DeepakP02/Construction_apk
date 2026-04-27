import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Animated, StyleSheet, StatusBar, Modal, TouchableOpacity, Text, Alert, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import SubcontractorDashboard from './SubcontractorDashboard';

const SubcontractorDashboardScreen = ({ navigation }) => {
    const { refreshData, isClockedIn, toggleClock, getWorkDuration, projects } = useApp();
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    // Timer Logic for Clock In
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

    useEffect(() => {
        if (projects && projects.length > 0 && !selectedProject) {
            setSelectedProject(projects[0]);
        }
    }, [projects]);

    const handleClockToggle = async (pId = null) => {
        try {
            if (!isClockedIn && !pId) {
                setClockModal(true);
                return;
            }
            const projId = pId || selectedProject?._id;
            if (!projId) {
                Alert.alert('Selection Required', 'Please select a project to clock in.');
                return;
            }
            await toggleClock(projId);
            setClockModal(false);
            refreshData();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('Attendance Error', errorMsg || 'Could not sync with server.');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Dashboard" hideSearch={false} navigation={navigation} />

            <Animated.ScrollView 
                style={[styles.scroll, { opacity: fadeAnim }]} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <SubcontractorDashboard 
                    navigation={navigation}
                    timer={timer}
                    isClockedIn={isClockedIn}
                    handleClockToggle={handleClockToggle}
                    setClockModal={setClockModal}
                    selectedProject={selectedProject}
                />
            </Animated.ScrollView>

            {/* Project Selection Modal for Clock-In */}
            <Modal visible={clockModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIndicator} />
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>Site Attendance</Text>
                            <Text style={styles.modalSub}>SELECT ACTIVE WORK PROJECT</Text>
                        </View>
                        
                        <FlatList
                            data={projects || []}
                            keyExtractor={item => item._id || item.id}
                            style={{ maxHeight: 400 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.pSelectRow}
                                    onPress={() => {
                                        setSelectedProject(item);
                                        handleClockToggle(item._id || item.id);
                                    }}
                                >
                                    <View style={styles.pSelectIcon}>
                                        <MaterialCommunityIcons name="office-building" size={20} color="#2563EB" />
                                    </View>
                                    <View>
                                        <Text style={styles.pSelectName}>{item.name}</Text>
                                        <Text style={styles.pSelectLoc}>{item.location || 'Site Location'}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>No active projects found.</Text>}
                        />

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setClockModal(false)}>
                            <Text style={styles.cancelBtnText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
    modalIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    modalSub: { fontSize: 9, fontWeight: '800', color: '#3B82F6', letterSpacing: 1 },
    
    pSelectRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    pSelectIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    pSelectName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    pSelectLoc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    
    cancelBtn: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#F1F5F9', marginTop: 20 },
    cancelBtnText: { fontWeight: '900', color: '#64748B', fontSize: 12 },
});

export default SubcontractorDashboardScreen;
