import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, Animated, Modal, TouchableOpacity, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY, contentBottomForTabBar } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import ProjectManagerDashboard from './ProjectManagerDashboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ProjectManagerDashboardScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { user, isClockedIn, toggleClock, getWorkDuration, refreshData, projects } = useApp();
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

    const handleClockToggle = async (pId = null) => {
        try {
            if (!isClockedIn && !pId) {
                setClockModal(true);
                return;
            }
            await toggleClock(pId);
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
            <WorkerHeader showBranding={true} />

            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: contentBottomForTabBar(insets.bottom) }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    <ProjectManagerDashboard
                        navigation={navigation}
                    />
                </Animated.View>
            </ScrollView>


            <Modal visible={clockModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, SHADOWS.large]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Project Site</Text>
                            <TouchableOpacity onPress={() => setClockModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>Select a project to start your site management shift.</Text>

                        <ScrollView style={styles.projectList}>
                            {projects.map(p => (
                                <TouchableOpacity
                                    key={p._id || p.id}
                                    style={[styles.projectItem, selectedProject?._id === (p._id || p.id) && styles.projectItemActive]}
                                    onPress={() => setSelectedProject(p)}
                                >
                                    <View style={styles.projectIcon}>
                                        <MaterialCommunityIcons name="office-building" size={20} color={selectedProject?._id === (p._id || p.id) ? '#fff' : COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.projectName, selectedProject?._id === (p._id || p.id) && { color: COLORS.white }]}>{p.name}</Text>
                                        <Text style={[styles.projectLoc, selectedProject?._id === (p._id || p.id) && { color: 'rgba(255,255,255,0.7)' }]}>{(typeof p.location === 'object' ? p.location?.address : p.location) || 'Site Location'}</Text>
                                    </View>
                                    {selectedProject?._id === (p._id || p.id) && <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.confirmBtn, !selectedProject && { opacity: 0.5 }]}
                            disabled={!selectedProject}
                            onPress={() => handleClockToggle(selectedProject._id || selectedProject.id)}
                        >
                            <Text style={styles.confirmBtnText}>CLOCK IN TO {selectedProject?.name?.toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 14 },
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
    floatingActionRow: {
        position: 'absolute',
        bottom: 24,
        right: 16,
        left: 16,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        zIndex: 99
    },
    floatingActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: SIZES.radiusCard,
        elevation: 10,
    },
    floatingIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatTextWrap: { marginLeft: 10, marginRight: 4 },
    chatTopText: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
    chatBottomText: { fontSize: 13, fontWeight: '900', color: COLORS.white, marginTop: -2 }
});

export default ProjectManagerDashboardScreen;
