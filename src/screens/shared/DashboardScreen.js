import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import SubcontractorDashboard from '../subcontractor/SubcontractorDashboard';

const DashboardScreen = ({ navigation }) => {
    const { 
        user, refreshData, 
        isClockedIn, toggleClock, getWorkDuration,
        projects 
    } = useApp();
    
    const [refreshing, setRefreshing] = useState(false);
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [isClocking, setIsClocking] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);

    useEffect(() => {
        let interval;
        if (isClockedIn) {
            interval = setInterval(() => {
                setTimer(getWorkDuration());
            }, 1000);
        } else {
            setTimer('00:00:00');
        }
        return () => clearInterval(interval);
    }, [isClockedIn]);

    useEffect(() => {
        if (projects && projects.length > 0 && !selectedProject) {
            setSelectedProject(projects[0]);
        }
    }, [projects]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const handleClockToggle = async (pId) => {
        try {
            setIsClocking(true);
            await toggleClock(pId || selectedProject?._id);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsClocking(false);
        }
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </View>
        );
    }

    const role = user?.role || 'WORKER';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" transparent backgroundColor="transparent" />
            <WorkerHeader showBranding={true} hideSearch={role === 'WORKER'} />

            {role === 'SUBCONTRACTOR' ? (
                <ScrollView 
                    style={{ flex: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                >
                    <SubcontractorDashboard
                        navigation={navigation}
                        timer={timer}
                        isClockedIn={isClockedIn}
                        isClocking={isClocking}
                        handleClockToggle={handleClockToggle}
                        setClockModal={setClockModal}
                        selectedProject={selectedProject}
                    />
                </ScrollView>
            ) : (
                <View style={styles.center}>
                    <Text>Standard Dashboard for {role}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DashboardScreen;
