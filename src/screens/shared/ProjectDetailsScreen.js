import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { COLORS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';

import { OverviewTab } from '../projects/OverviewTab';
import { ProjectTasksTab } from '../projects/ProjectTasksTab';
import { PhotosTab } from '../projects/PhotosTab';
import { IssuesTab } from '../projects/IssuesTab';
import { ChatTab } from '../projects/ChatTab';

const Tab = createMaterialTopTabNavigator();

import { useApp } from '../../context/AppContext';

const ProjectDetailsScreen = ({ route, navigation }) => {
    const { params } = route;
    const { projects, refreshData } = useApp();
    
    // Support both direct object pass or ID pass
    const project = params?.project || projects?.find(p => p._id === params?.projectId);

    React.useEffect(() => {
        refreshData();
    }, []);

    if (!project) {
        return (
            <View style={styles.container}>
                <AppHeader title="Project Details" showBack onBack={() => navigation.goBack()} />
                <View style={styles.center}><Text>Project not found.</Text></View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AppHeader
                title={project.name || 'Project Details'}
                showBack
                onBack={() => navigation.goBack()}
                rightIcon="dots-vertical"
            />
            <Tab.Navigator
                screenOptions={{
                    tabBarScrollEnabled: true,
                    tabBarActiveTintColor: COLORS.primary,
                    tabBarInactiveTintColor: COLORS.textSecondary,
                    tabBarIndicatorStyle: { backgroundColor: COLORS.primary, height: 3 },
                    tabBarStyle: { backgroundColor: COLORS.background },
                    tabBarItemStyle: { width: 'auto', minWidth: 90 },
                    tabBarLabelStyle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
                }}
            >
                <Tab.Screen name="Overview">
                    {() => <OverviewTab project={project} />}
                </Tab.Screen>
                <Tab.Screen name="Jobs">
                    {() => <ProjectTasksTab project={project} />}
                </Tab.Screen>
                <Tab.Screen name="Photos">
                    {() => <PhotosTab project={project} />}
                </Tab.Screen>
                <Tab.Screen name="Issues">
                    {() => <IssuesTab project={project} />}
                </Tab.Screen>
                <Tab.Screen name="Chat">
                    {() => <ChatTab project={project} />}
                </Tab.Screen>
            </Tab.Navigator>
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ProjectDetailsScreen;
