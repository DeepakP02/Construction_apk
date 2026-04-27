import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Added for premium look
import { COLORS } from '../constants/theme';
import { View, Platform, ActivityIndicator, Text, TouchableOpacity, Image, Dimensions, useWindowDimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 380;

const getModernTabOptions = (insets, isSmallDevice, windowHeight) => {
    const bottomPadding = insets.bottom > 0 ? insets.bottom : (isSmallDevice ? 8 : 12);
    const barHeight = Platform.OS === 'ios' 
        ? (windowHeight > 750 ? 88 + (insets.bottom > 0 ? insets.bottom - 10 : 0) : 74) 
        : (isSmallDevice ? 65 + insets.bottom : 70 + (insets.bottom > 0 ? insets.bottom : 12));

    return {
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
            backgroundColor: '#0F172A',
            borderTopWidth: 0,
            height: barHeight,
            paddingBottom: bottomPadding,
            paddingTop: 5,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            position: 'absolute',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden'
        },
        tabBarLabelStyle: {
            fontSize: isSmallDevice ? 8 : 10,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: isSmallDevice ? 0.3 : 0.8,
            marginTop: -4,
            marginBottom: 4
        },
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
            <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={{ flex: 1 }}
            />
        ),
    };
};

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';

// Main Screens
import DashboardScreen from '../screens/shared/DashboardScreen';
import ProjectDetailsScreen from '../screens/shared/ProjectDetailsScreen';
import TasksScreen from '../screens/shared/TasksScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import EquipmentScreen from '../screens/shared/EquipmentScreen';
import RFIScreen from '../screens/shared/RFIScreen';
import RFIListScreen from '../screens/shared/RFIListScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import PurchaseOrdersScreen from '../screens/shared/PurchaseOrdersScreen';
import PurchaseOrderDetailScreen from '../screens/shared/PurchaseOrderDetailScreen';
import ReportsScreen from '../screens/shared/ReportsScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import DailyLogsScreen from '../screens/shared/DailyLogsScreen';
import ProjectChatScreen from '../screens/shared/ProjectChatScreen';
import RFIDetailScreen from '../screens/shared/RFIDetailScreen';

// Worker Specific Screens
import WorkerDashboardScreen from '../screens/worker/WorkerDashboardScreen';
import WorkerJobsScreen from '../screens/worker/WorkerJobsScreen';
import WorkerTasksScreen from '../screens/worker/WorkerTasksScreen';
import WorkerDrawingsScreen from '../screens/worker/WorkerDrawingsScreen';
import WorkerPhotosScreen from '../screens/worker/WorkerPhotosScreen';
import WorkerChatboard from '../screens/worker/WorkerChatboard';
import WorkerLogsScreen from '../screens/worker/WorkerLogsScreen';
import WorkerChatScreen from '../screens/worker/WorkerChatScreen';
import WorkerProfileScreen from '../screens/worker/WorkerProfileScreen';
import WorkerJobTasksScreen from '../screens/worker/WorkerJobTasksScreen';
import WorkerTimeClockScreen from '../screens/worker/WorkerTimeClockScreen';
import TaskDetailScreen from '../screens/worker/TaskDetailScreen';


// Foreman Specific Screens
import ForemanDashboard from '../screens/foreman/ForemanDashboard';
import TradeManagementScreen from '../screens/foreman/TradeManagementScreen';
import CrewClockScreen from '../screens/foreman/CrewClockScreen';
import ForemanPhotosScreen from '../screens/foreman/ForemanPhotosScreen';
import ForemanTasksScreen from '../screens/foreman/ForemanTasksScreen';
import RFIDashboardScreen from '../screens/foreman/RFIDashboardScreen';
import ForemanRFIListScreen from '../screens/foreman/RFIListScreen';
import ForemanIssuesScreen from '../screens/foreman/ForemanIssuesScreen';
import ForemanEquipmentScreen from '../screens/foreman/ForemanEquipmentScreen';
import ForemanJobsScreen from '../screens/foreman/ForemanJobsScreen';
import ForemanJobDetailScreen from '../screens/foreman/ForemanJobDetailScreen';

// Client Specific Screens
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import ClientJobsScreen from '../screens/client/ClientJobsScreen';
import ClientInvoicesScreen from '../screens/client/ClientInvoicesScreen';
import ClientRFIScreen from '../screens/client/ClientRFIScreen';
import ClientPhotosScreen from '../screens/client/ClientPhotosScreen';
import ClientDrawingsScreen from '../screens/client/ClientDrawingsScreen';
import ClientProjectsScreen from '../screens/client/ClientProjectsScreen';

// Subcontractor Specific Screens
import SubcontractorDashboardScreen from '../screens/subcontractor/SubcontractorDashboardScreen';
import SubcontractorProjectsScreen from '../screens/subcontractor/SubcontractorProjectsScreen';
import SubcontractorTasksScreen from '../screens/subcontractor/SubcontractorTasksScreen';
import SubcontractorJobDetailsScreen from '../screens/subcontractor/SubcontractorJobDetailsScreen';
import SubcontractorRFIScreen from '../screens/subcontractor/SubcontractorRFIScreen';

// PM Specific Screens
import ProjectManagerDashboardScreen from '../screens/project-manager/ProjectManagerDashboardScreen';
import ProjectManagerJobsScreen from '../screens/project-manager/ProjectManagerJobsScreen';
import ProjectManagerProfileScreen from '../screens/project-manager/ProjectManagerProfileScreen';
import ProjectManagerDrawingsScreen from '../screens/project-manager/ProjectManagerDrawingsScreen';
import ProjectManagerPhotosScreen from '../screens/project-manager/ProjectManagerPhotosScreen';
import PMCrewControlScreen from '../screens/project-manager/PMCrewControlScreen';
import PMGPSTrackingScreen from '../screens/project-manager/PMGPSTrackingScreen';
import PMProjectDetailScreen from '../screens/project-manager/PMProjectDetailScreen';
import ClientProgressScreen from '../screens/client/ClientProgressScreen';



const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const ProjectStack = createStackNavigator();

// Projects Stack
const ProjectsStack = () => (
    <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
        <ProjectStack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
    </ProjectStack.Navigator>
);

// Subcontractor Projects Stack
const SubcontractorProjectsStack = () => (
    <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
        <ProjectStack.Screen name="ProjectsList" component={SubcontractorProjectsScreen} />
        <ProjectStack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
        <ProjectStack.Screen name="SubcontractorJobDetails" component={SubcontractorJobDetailsScreen} />
    </ProjectStack.Navigator>
);
// Worker Dedicated Tabs
const WorkerTabs = () => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    return (
        <Tab.Navigator
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="Dashboard"
                component={WorkerDashboardScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Jobs"
                component={WorkerJobsScreen}
                options={{
                    tabBarLabel: 'Jobs',
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "office-building" : "office-building-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Tasks"
                component={WorkerTasksScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "calendar-check" : "calendar-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Drawings"
                component={WorkerDrawingsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "floor-plan" : "floor-plan"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={WorkerPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera-iris" : "camera-outline"} color={color} size={24} />
                }}
            />
        </Tab.Navigator>
    );
};

// ── REUSABLE DRAWER COMPONENTS ──────────────────────────
const DrawerHeader = ({ title, subtitle, color = '#2563EB', isWorker = false }) => {
    const insets = useSafeAreaInsets();
    return (
        <View style={{ 
            paddingHorizontal: 8, paddingVertical: 14,            paddingTop: Math.max(insets.top, 16),
            borderBottomWidth: 1, 
            borderBottomColor: '#F1F5F9', 
            marginBottom: 8,
            backgroundColor: '#fff' 
        }}>
            <Image 
                source={require('../../assets/logo.webp')} 
                style={{ width: 32, height: 32, marginBottom: 6 }} 
                resizeMode="contain" 
            />
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>{title}</Text>
            <Text style={{ fontSize: 8.5, color: color, fontWeight: '900', marginTop: 1, letterSpacing: 0.8 }}>{subtitle}</Text>
        </View>
    );
};

const DrawerSection = ({ title }) => (
    <Text style={{ 
        fontSize: 8.5, 
        fontWeight: '900', 
        color: '#94A3B8', 
        letterSpacing: 1.0, 
        marginTop: 12, 
        marginBottom: 6, 
        marginLeft: 4,        textTransform: 'uppercase'
    }}>{title}</Text>
);

const WorkerDrawerContent = (props) => {
    const { logout, user } = useApp();
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <DrawerHeader 
                title="WORKER PANEL" 
                subtitle={user?.fullName || 'VERIFIED FIELD STAFF'} 
                color="#10B981" 
                isWorker 
            />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#fff' }} contentContainerStyle={{ paddingTop: 0 }}>
                <View style={{ paddingHorizontal: 0 }}>
                    <DrawerItem
                        label="Home Dashboard"
                        icon={({ color }) => <MaterialCommunityIcons name="view-dashboard" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('MainTabs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Check-In (My Clock)"
                        icon={({ color }) => <MaterialCommunityIcons name="clock-check" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('TimeClock')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="My Hours (Attendance)"
                        icon={({ color }) => <MaterialCommunityIcons name="timetable" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('WorkerLogs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Discussions"
                        icon={({ color }) => <MaterialCommunityIcons name="message-text" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Chatboard')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <TouchableOpacity
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: '#FEF2F2', 
                            padding: 14, 
                            borderRadius: 12, 
                            marginTop: 30,
                            marginHorizontal: 8,
                            marginBottom: 30 
                        }}
                        onPress={logout}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </DrawerContentScrollView>
        </View>
    );
};

const WorkerDrawer = () => {
    const { width } = useWindowDimensions();
    return (
        <Drawer.Navigator
            backBehavior="history"
            drawerContent={(props) => <WorkerDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: 13, marginLeft: -4 },
                drawerStyle: { width: Math.min(width * 0.70, 275) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={WorkerTabs} />
            <Drawer.Screen name="TimeClock" component={WorkerTimeClockScreen} />
            <Drawer.Screen name="WorkerLogs" component={WorkerLogsScreen} options={{ title: 'Time & Attendance' }} />
            <Drawer.Screen name="RFI" component={RFIScreen} />
            <Drawer.Screen name="Profile" component={ProfileScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
        </Drawer.Navigator>
    );
};

// Foreman Dedicated Tabs
const ForemanTabs = () => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    return (
        <Tab.Navigator
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="Dashboard"
                component={ForemanDashboard}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Tasks"
                component={ForemanTasksScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "calendar-check" : "calendar-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Jobs"
                component={ForemanJobsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "office-building" : "office-building-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Drawings"
                component={WorkerDrawingsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "floor-plan" : "floor-plan"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={ForemanPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera-iris" : "camera-outline"} color={color} size={24} />
                }}
            />
        </Tab.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Foreman
const ForemanDrawerContent = (props) => {
    const { logout } = useApp();
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <DrawerHeader title="FOREMAN CONTROL" subtitle="SITE OPERATIONS HUB" color="#3B82F6" />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#fff' }} contentContainerStyle={{ paddingTop: 0 }}>
                <View style={{ paddingHorizontal: 0 }}>
                    <DrawerSection title="FIELD OPERATIONS" />
                    <DrawerItem
                        label="Home Dashboard"
                        icon={({ color }) => <MaterialCommunityIcons name="view-dashboard" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('MainTabs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Clock In Crew"
                        icon={({ color }) => <MaterialCommunityIcons name="account-group" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('CrewClock')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Daily Logs"
                        icon={({ color }) => <MaterialCommunityIcons name="file-document-edit" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('DailyLogs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Issues"
                        icon={({ color }) => <MaterialCommunityIcons name="alert-circle" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('ForemanIssues')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Equipment Tracking"
                        icon={({ color }) => <MaterialCommunityIcons name="hammer-wrench" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Equipment')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Photos"
                        icon={({ color }) => <MaterialCommunityIcons name="camera-image" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Photos')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Purchase Orders"
                        icon={({ color }) => <MaterialCommunityIcons name="receipt" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('PurchaseOrders')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Discussions"
                        icon={({ color }) => <MaterialCommunityIcons name="message-text" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Chatboard')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <TouchableOpacity
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: '#FEF2F2', 
                            padding: 14, 
                            borderRadius: 12, 
                            marginTop: 30,
                            marginHorizontal: 8,
                            marginBottom: 30 
                        }}
                        onPress={logout}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </DrawerContentScrollView>
        </View>
    );
};

const ForemanDrawer = () => {
    const { width } = useWindowDimensions();
    return (
        <Drawer.Navigator
            backBehavior="history"
            drawerContent={(props) => <ForemanDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: 13, marginLeft: -4 },
                drawerStyle: { width: Math.min(width * 0.70, 275) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={ForemanTabs} />
            <Drawer.Screen name="TimeClock" component={WorkerTimeClockScreen} />
            <Drawer.Screen name="CrewClock" component={CrewClockScreen} />
            <Drawer.Screen name="DailyLogs" component={DailyLogsScreen} />
            <Drawer.Screen name="TradeManagement" component={TradeManagementScreen} />
            <Drawer.Screen name="Tasks" component={TasksScreen} />
            <Drawer.Screen name="ForemanTasks" component={ForemanTasksScreen} />
            <Drawer.Screen name="RFIDashboard" component={RFIDashboardScreen} />
            <Drawer.Screen name="RFIList" component={ForemanRFIListScreen} />
            <Drawer.Screen name="ForemanIssues" component={ForemanIssuesScreen} />
            <Drawer.Screen name="ForemanJobDetail" component={ForemanJobDetailScreen} />
            <Drawer.Screen name="Photos" component={ForemanPhotosScreen} />
            <Drawer.Screen name="Equipment" component={EquipmentScreen} />
            <Drawer.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
            <Drawer.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
        </Drawer.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Client
const ClientDrawerContent = (props) => {
    const { logout, user } = useApp();
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <DrawerHeader title="CLIENT HUB" subtitle={user?.companyName || 'PREMIUM ACCESS'} color="#6366F1" />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#fff' }} contentContainerStyle={{ paddingTop: 0 }}>
                <View style={{ paddingHorizontal: 0 }}>
                    <DrawerSection title="PORTFOLIO CONTROL" />
                    <DrawerItem
                        label="Home Dashboard"
                        icon={({ color }) => <MaterialCommunityIcons name="view-dashboard" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('MainTabs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <DrawerSection title="FINANCIALS & RFIS" />
                    <DrawerItem
                        label="Project Invoices"
                        icon={({ color }) => <MaterialCommunityIcons name="file-document-outline" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('ClientInvoices')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="RFI Center"
                        icon={({ color }) => <MaterialCommunityIcons name="frequently-asked-questions" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('ClientRFI')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Discussions"
                        icon={({ color }) => <MaterialCommunityIcons name="message-text" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Chatboard')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <DrawerSection title="ACCOUNT" />
                    <DrawerItem
                        label="Settings"
                        icon={({ color }) => <MaterialCommunityIcons name="cog" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Settings')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <TouchableOpacity
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: '#FEF2F2', 
                            padding: 14, 
                            borderRadius: 12, 
                            marginTop: 30,
                            marginHorizontal: 8,
                            marginBottom: 30 
                        }}
                        onPress={logout}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </DrawerContentScrollView>
        </View>
    );
};

// Client Dedicated Tabs
const ClientTabs = () => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    return (
        <Tab.Navigator
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="Dashboard"
                component={ClientDashboardScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Projects"
                component={ClientProjectsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "briefcase" : "briefcase-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={ClientPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera-iris" : "camera-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Drawings"
                component={ClientDrawingsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "floor-plan" : "floor-plan"} color={color} size={24} />
                }}
            />
        </Tab.Navigator>
    );
};

const ClientDrawer = () => {
    const { width } = useWindowDimensions();
    return (
        <Drawer.Navigator
            backBehavior="history"
            drawerContent={(props) => <ClientDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: 13, marginLeft: -4 },
                drawerStyle: { width: Math.min(width * 0.70, 275) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={ClientTabs} />
            <Drawer.Screen name="ClientInvoices" component={ClientInvoicesScreen} />
            <Drawer.Screen name="ClientRFI" component={ClientRFIScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
        </Drawer.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Project Manager
const ProjectManagerDrawerContent = (props) => {
    const { logout } = useApp();
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <DrawerHeader title="KAAL CONTROL" subtitle="PROJECT MANAGEMENT OPS" color="#10B981" />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#fff' }} contentContainerStyle={{ paddingTop: 0 }}>
                <View style={{ paddingHorizontal: 0 }}>
                    <DrawerSection title="DASHBOARD OVERVIEW" />
                    <DrawerItem
                        label="Home Dashboard"
                        icon={({ color }) => <MaterialCommunityIcons name="view-dashboard" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('MainTabs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <DrawerSection title="FIELD OPERATIONS" />
                    <DrawerItem
                        label="Clock In Crew"
                        icon={({ color }) => <MaterialCommunityIcons name="account-group" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('CrewClock')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Daily Logs"
                        icon={({ color }) => <MaterialCommunityIcons name="file-document-edit" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('DailyLogs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Issues"
                        icon={({ color }) => <MaterialCommunityIcons name="alert-circle" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('ForemanIssues')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="GPS Tracking"
                        icon={({ color }) => <MaterialCommunityIcons name="crosshairs-gps" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('PMGPSTracking')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <DrawerSection title="SITE DOCUMENTATION" />
                    <DrawerItem
                        label="Equipment"
                        icon={({ color }) => <MaterialCommunityIcons name="hammer-wrench" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Equipment')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Purchase Orders"
                        icon={({ color }) => <MaterialCommunityIcons name="receipt" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('PurchaseOrders')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <DrawerSection title="COMMUNICATIONS" />
                    <DrawerItem
                        label="RFI Center"
                        icon={({ color }) => <MaterialCommunityIcons name="frequently-asked-questions" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('RFI')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Report Logs"
                        icon={({ color }) => <MaterialCommunityIcons name="chart-box" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Reports')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />
                    <DrawerItem
                        label="Site Discussions"
                        icon={({ color }) => <MaterialCommunityIcons name="message-text" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('Chatboard')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <TouchableOpacity
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: '#FEF2F2', 
                            padding: 14, 
                            borderRadius: 12, 
                            marginTop: 30,
                            marginHorizontal: 8,
                            marginBottom: 30 
                        }}
                        onPress={logout}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </DrawerContentScrollView>
        </View>
    );
};


// Project Manager Dedicated Tabs (5 Items as requested)
const ProjectManagerTabs = () => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    return (
        <Tab.Navigator
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="ProjectManagerHome"
                component={ProjectManagerDashboardScreen}
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Jobs"
                component={ProjectManagerJobsScreen}
                options={{
                    tabBarLabel: 'Jobs',
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "office-building" : "office-building-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Tasks"
                component={TasksScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "calendar-check" : "calendar-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Drawings"
                component={ProjectManagerDrawingsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "floor-plan" : "floor-plan"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={ProjectManagerPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera-iris" : "camera-outline"} color={color} size={24} />
                }}
            />
        </Tab.Navigator>
    );
};

const ProjectManagerDrawer = () => {
    const { width } = useWindowDimensions();
    return (
        <Drawer.Navigator
            backBehavior="history"
            drawerContent={(props) => <ProjectManagerDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: 13, marginLeft: -4 },
                drawerType: 'front',
                drawerStyle: { width: Math.min(width * 0.70, 275) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={ProjectManagerTabs} />
            <Drawer.Screen name="TimeClock" component={WorkerTimeClockScreen} />
            <Drawer.Screen name="CrewClock" component={PMCrewControlScreen} />
            <Drawer.Screen name="PMGPSTracking" component={PMGPSTrackingScreen} />
            <Drawer.Screen name="DailyLogs" component={DailyLogsScreen} />
            <Drawer.Screen name="RFI" component={RFIScreen} />
            <Drawer.Screen name="RFIList" component={RFIListScreen} />
            <Drawer.Screen name="Reports" component={ReportsScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
            <Drawer.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
            <Drawer.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
            <Drawer.Screen name="Equipment" component={EquipmentScreen} />
            <Drawer.Screen name="TradeManagement" component={TradeManagementScreen} />
            <Drawer.Screen name="ForemanIssues" component={ForemanIssuesScreen} />
            <Drawer.Screen name="WorkerLogs" component={WorkerLogsScreen} />
            <Drawer.Screen name="ProjectManagerDrawings" component={WorkerDrawingsScreen} />
            <Drawer.Screen name="ProjectManagerPhotos" component={ProjectManagerPhotosScreen} />
            <Drawer.Screen name="ProjectManagerProfile" component={ProjectManagerProfileScreen} />
            <Drawer.Screen name="PMProjectDetail" component={PMProjectDetailScreen} />
            <Drawer.Screen name="ForemanDashboard" component={ForemanDashboard} />
        </Drawer.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Subcontractor
const SubcontractorDrawerContent = (props) => {
    const { logout, user } = useApp();
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <DrawerHeader title="CONTRACTOR PORTAL" subtitle={user?.fullName || 'VERIFIED PARTNER'} color={COLORS.primary} />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#fff' }} contentContainerStyle={{ paddingTop: 0 }}>
                <View style={{ paddingHorizontal: 0 }}>
                    <DrawerItem
                        label="Home Dashboard"
                        icon={({ color }) => <MaterialCommunityIcons name="view-dashboard" size={20} color={color} />}
                        onPress={() => props.navigation.navigate('MainTabs')}
                        labelStyle={{ fontWeight: '800', fontSize: 13, marginLeft: -4 }}
                    />

                    <TouchableOpacity
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: '#FEF2F2', 
                            padding: 14, 
                            borderRadius: 12, 
                            marginTop: 40,
                            marginHorizontal: 8,
                            marginBottom: 30 
                        }}
                        onPress={logout}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '900', marginLeft: 10, fontSize: 13 }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </DrawerContentScrollView>
        </View>
    );
};

// Subcontractor Dedicated Tabs
const SubcontractorTabs = () => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    return (
        <Tab.Navigator
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="Dashboard"
                component={SubcontractorDashboardScreen}
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Projects"
                component={SubcontractorProjectsStack}
                options={{
                    tabBarLabel: 'Projects',
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "briefcase-check" : "briefcase-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Tasks"
                component={SubcontractorTasksScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "calendar-check" : "calendar-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={ForemanPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera" : "camera-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="RFI"
                component={SubcontractorRFIScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "file-document-alert" : "file-document-alert-outline"} color={color} size={24} />
                }}
            />
        </Tab.Navigator>
    );
};

const SubcontractorDrawer = () => {
    const { width } = useWindowDimensions();
    return (
        <Drawer.Navigator
            backBehavior="history"
            drawerContent={(props) => <SubcontractorDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: COLORS.primary,
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: 13, marginLeft: -4 },
                drawerStyle: { width: Math.min(width * 0.70, 275) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={SubcontractorTabs} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
            <Drawer.Screen name="Equipment" component={EquipmentScreen} />
            <Drawer.Screen name="RFI" component={SubcontractorRFIScreen} />
            <Drawer.Screen name="Reports" component={ReportsScreen} />
            <Drawer.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
            <Drawer.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
        </Drawer.Navigator>
    );
};


// Main Bottom Tabs
const MainTabs = () => {
    const { user } = useApp();
    const role = user?.role || 'WORKER';

    if (role === 'WORKER') return <WorkerDrawer />;
    if (role === 'FOREMAN') return <ForemanDrawer />;
    if (role === 'PM') return <ProjectManagerDrawer />;
    if (role === 'CLIENT') return <ClientDrawer />;
    if (role === 'SUBCONTRACTOR') return <SubcontractorDrawer />;


    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();

    return (
        <Tab.Navigator
            key={role}
            backBehavior="history"
            sceneContainerStyle={{ backgroundColor: '#0F172A' }}
            screenOptions={getModernTabOptions(insets, isSmallDevice, windowHeight)}
        >
            <Tab.Screen
                name="Home"
                component={DashboardScreen}
                options={{
                    tabBarLabel: role === 'SUBCONTRACTOR' ? 'Subcontractor' : 'Dashboard',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'view-dashboard' : 'view-dashboard'}
                            color={color}
                            size={24}
                        />
                    )
                }}
            />

            {(role === 'PM' || role === 'FOREMAN' || role === 'SUBCONTRACTOR' || role === 'CLIENT') && (
                <Tab.Screen
                    name="Projects"
                    component={ProjectsStack}
                    options={{
                        tabBarLabel: role === 'CLIENT' ? 'My Projects' : 'Projects',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons
                                name={focused ? 'briefcase' : 'briefcase-outline'}
                                color={color}
                                size={24}
                            />
                        )
                    }}
                />
            )}

            {(role !== 'CLIENT' && role !== 'WORKER') && (
                <Tab.Screen
                    name="Execution"
                    component={TasksScreen}
                    options={{
                        tabBarLabel: 'Jobs',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons
                                name={focused ? 'checkbox-marked-circle' : 'checkbox-marked-circle-outline'}
                                color={color}
                                size={24}
                            />
                        )
                    }}
                />
            )}

            {(role === 'PM' || role === 'FOREMAN' || role === 'SUBCONTRACTOR') && (
                <Tab.Screen
                    name="Timesheets"
                    component={DailyLogsScreen}
                    options={{
                        tabBarLabel: 'Daily Log',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons
                                name={focused ? 'clock-time-five' : 'clock-time-five-outline'}
                                color={color}
                                size={24}
                            />
                        )
                    }}
                />
            )}

            <Tab.Screen
                name="Chat"
                component={ChatScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'message-text' : 'message-text-outline'}
                            color={color}
                            size={24}
                        />
                    )
                }}
            />
        </Tab.Navigator>
    );
};


// Root Navigator
const AppNavigation = () => {
    const { user, loading } = useApp();

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.primaryDark, justifyContent: 'center', alignItems: 'center' }}>
                <Image 
                    source={require('../../assets/logo.webp')} 
                    style={{ width: 80, height: 80, marginBottom: 24 }} 
                    resizeMode="contain" 
                />
                <ActivityIndicator size="large" color={COLORS.primaryAccent} />
                <View style={{ marginTop: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, opacity: 0.8 }}>
                        SECURING YOUR SESSION
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                        KAAL ERP PRO • ASIA PACIFIC
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen name="ClientProgress" component={ClientProgressScreen} />
                        <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
                        <Stack.Screen name="Equipment" component={EquipmentScreen} />
                        <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
                        <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
                        <Stack.Screen name="Invoices" component={ClientInvoicesScreen} />
                        <Stack.Screen name="Reports" component={ReportsScreen} />
                        <Stack.Screen name="RFI" component={RFIScreen} />
                        <Stack.Screen name="RFIList" component={RFIListScreen} />
                        <Stack.Screen name="RFIDetail" component={RFIDetailScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                        <Stack.Screen name="ProjectChat" component={ProjectChatScreen} />
                        <Stack.Screen name="WorkerChat" component={WorkerChatScreen} />
                        <Stack.Screen name="Chatboard" component={WorkerChatboard} />
                        <Stack.Screen name="JobTasks" component={WorkerJobTasksScreen} />
                        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
                        <Stack.Screen name="ClientJobs" component={ClientJobsScreen} />
                        <Stack.Screen name="Drawings" component={WorkerDrawingsScreen} />
                        <Stack.Screen name="ForemanTasks" component={ForemanTasksScreen} />
                        <Stack.Screen name="CrewClock" component={CrewClockScreen} />
                        <Stack.Screen name="Photos" component={ForemanPhotosScreen} />
                        <Stack.Screen name="DailyLogs" component={DailyLogsScreen} />
                        <Stack.Screen name="WorkerLogs" component={WorkerLogsScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigation;
