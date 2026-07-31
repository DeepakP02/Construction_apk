import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

export const navigationRef = React.createRef();
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Added for premium look
import { COLORS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { View, Platform, ActivityIndicator, Text, TouchableOpacity, Image, Dimensions, useWindowDimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 380;


const getModernTabOptions = (insets, isSmallDevice, windowHeight) => {
    const bottomPadding = Math.max(insets.bottom, 16);
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
            ...TYPOGRAPHY.badge,
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
import TaskHierarchyDetailScreen from '../screens/shared/TaskHierarchyDetailScreen';
import TaskCreateScreen from '../screens/shared/TaskCreateScreen';
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
import ForemanIssuesScreen from '../screens/foreman/ForemanIssuesScreen';
import ForemanJobsScreen from '../screens/foreman/ForemanJobsScreen';
import ForemanJobDetailScreen from '../screens/foreman/ForemanJobDetailScreen';

// Client Specific Screens
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import ClientJobsScreen from '../screens/client/ClientJobsScreen';
import ClientInvoicesScreen from '../screens/client/ClientInvoicesScreen';
import ClientPhotosScreen from '../screens/client/ClientPhotosScreen';
import ClientDrawingsScreen from '../screens/client/ClientDrawingsScreen';
import ClientProjectsScreen from '../screens/client/ClientProjectsScreen';

// Subcontractor Specific Screens
import SubcontractorDashboardScreen from '../screens/subcontractor/SubcontractorDashboardScreen';
import SubcontractorPhotosScreen from '../screens/subcontractor/SubcontractorPhotosScreen';
import SubcontractorProjectsScreen from '../screens/subcontractor/SubcontractorProjectsScreen';
import SubcontractorJobDetailsScreen from '../screens/subcontractor/SubcontractorJobDetailsScreen';

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
                name="Clock"
                component={WorkerTimeClockScreen}
                options={{
                    tabBarLabel: 'Clock',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons name={focused ? 'clock-check' : 'clock-check-outline'} color={color} size={24} />
                    ),
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

// ── REUSABLE WEB-MATCHING SIDEBAR DRAWER COMPONENTS ──────────────────────────
const DrawerHeader = ({ title, subtitle }) => {
    const insets = useSafeAreaInsets();
    return (
        <View style={{ 
            paddingHorizontal: 16, 
            paddingVertical: 18,
            paddingTop: Math.max(insets.top + 8, 20),
            borderBottomWidth: 1, 
            borderBottomColor: '#1e293b', 
            backgroundColor: '#0f172a',
            alignItems: 'center'
        }}>
            <View style={{ 
                width: scale(46), 
                height: scale(46), 
                borderRadius: 23, 
                backgroundColor: '#0f172a', 
                borderWidth: 1.5, 
                borderColor: '#155dff', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: 8,
                shadowColor: '#155dff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 4
            }}>
                <Image 
                    source={require('../../assets/logo.webp')} 
                    style={{ width: scale(28), height: scale(28) }} 
                    resizeMode="contain" 
                />
            </View>
            <View style={{ width: 24, height: 2, backgroundColor: '#155dff', borderRadius: 1, marginBottom: 4 }} />
            <Text style={{ fontSize: moderateScale(13), fontWeight: '900', color: '#ffffff', letterSpacing: 1 }}>{title}</Text>
            <Text style={{ fontSize: moderateScale(9), color: '#64748b', fontWeight: '800', marginTop: 2, letterSpacing: 1.5, textTransform: 'uppercase' }}>{subtitle}</Text>
        </View>
    );
};

const DrawerSection = ({ title }) => (
    <Text style={{ 
        fontSize: moderateScale(10),
        fontWeight: '800',
        color: '#64748b', 
        marginTop: 18, 
        marginBottom: 6, 
        paddingHorizontal: 12,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
    }}>{title}</Text>
);

const WebCustomDrawerItem = ({ label, iconName, active, onPress, badge }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            marginBottom: 4,
            backgroundColor: active ? '#155dff' : 'transparent',
            position: 'relative'
        }}
    >
        <View style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            borderWidth: active ? 0 : 1,
            borderColor: 'rgba(255, 255, 255, 0.06)'
        }}>
            <MaterialCommunityIcons name={iconName} size={16} color={active ? '#ffffff' : '#94a3b8'} />
        </View>
        <Text style={{ flex: 1, fontSize: moderateScale(12.5), fontWeight: active ? '700' : '600', color: active ? '#ffffff' : '#94a3b8' }}>
            {label}
        </Text>
        {badge ? (
            <View style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: active ? '#ffffff' : 'rgba(21, 93, 255, 0.15)',
                borderWidth: active ? 0 : 1,
                borderColor: 'rgba(21, 93, 255, 0.3)'
            }}>
                <Text style={{ fontSize: moderateScale(9), fontWeight: '800', color: active ? '#155dff' : '#60a5fa' }}>{badge}</Text>
            </View>
        ) : null}
        {active && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff', marginLeft: 6 }} />
        )}
    </TouchableOpacity>
);

const DrawerFooter = ({ user, logout }) => (
    <View style={{
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        backgroundColor: '#0f172a'
    }}>
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: 10,
            marginBottom: 12
        }}>
            <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(21, 93, 255, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(21, 93, 255, 0.3)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                overflow: 'hidden'
            }}>
                {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <Text style={{ color: '#155dff', fontWeight: '900', fontSize: moderateScale(14) }}>
                        {(user?.fullName || user?.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: moderateScale(12) }} numberOfLines={1}>
                    {user?.fullName || user?.name || 'User'}
                </Text>
                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: moderateScale(9), textTransform: 'uppercase', marginTop: 1 }}>
                    {user?.role?.replace(/_/g, ' ') || 'Platform Root'}
                </Text>
            </View>
        </View>

        <TouchableOpacity
            onPress={logout}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                paddingVertical: 10,
                borderRadius: 12,
                gap: 8
            }}
        >
            <MaterialCommunityIcons name="logout" size={16} color="#f87171" />
            <Text style={{ color: '#f87171', fontWeight: '800', fontSize: moderateScale(11), letterSpacing: 0.8 }}>
                LOG OUT
            </Text>
        </TouchableOpacity>
    </View>
);

const WorkerDrawerContent = (props) => {
    const { logout, user } = useApp();
    const activeRoute = props.state?.routes[props.state?.index]?.name;
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerHeader title="KAAL WORKER" subtitle={user?.fullName || 'VERIFIED FIELD STAFF'} />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#0f172a' }} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 12 }}>
                <DrawerSection title="CORE MANAGEMENT" />
                <WebCustomDrawerItem
                    label="Dashboard"
                    iconName="view-dashboard-outline"
                    active={activeRoute === 'MainTabs'}
                    onPress={() => props.navigation.navigate('MainTabs')}
                />
                <DrawerSection title="FIELD OPERATIONS" />
                <WebCustomDrawerItem
                    label="My Clock (Site Check-In)"
                    iconName="clock-outline"
                    active={activeRoute === 'TimeClock'}
                    onPress={() => props.navigation.navigate('MainTabs', { screen: 'Clock' })}
                />
                <WebCustomDrawerItem
                    label="My Hours (Attendance)"
                    iconName="clock-time-four-outline"
                    active={activeRoute === 'WorkerLogs'}
                    onPress={() => props.navigation.navigate('WorkerLogs')}
                />
                <WebCustomDrawerItem
                    label="Daily Site Logs"
                    iconName="file-document-edit-outline"
                    active={activeRoute === 'DailyLogs'}
                    onPress={() => props.navigation.navigate('DailyLogs')}
                />
                <WebCustomDrawerItem
                    label="Site Discussions"
                    iconName="message-text-outline"
                    active={activeRoute === 'Chatboard'}
                    onPress={() => props.navigation.navigate('Chatboard')}
                />
            </DrawerContentScrollView>
            <DrawerFooter user={user} logout={logout} />
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
                drawerType: 'front',
                drawerStyle: { backgroundColor: '#0f172a', width: Math.min(width * 0.68, 245) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={WorkerTabs} />
            <Drawer.Screen name="WorkerLogs" component={WorkerLogsScreen} options={{ title: 'Time & Attendance' }} />
            <Drawer.Screen name="DailyLogs" component={DailyLogsScreen} />
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
                component={TasksScreen}
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
    const { logout, user } = useApp();
    const activeRoute = props.state?.routes[props.state?.index]?.name;
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerHeader title="KAAL FOREMAN" subtitle="SITE OPERATIONS HUB" />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#0f172a' }} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 12 }}>
                <DrawerSection title="CORE MANAGEMENT" />
                <WebCustomDrawerItem
                    label="Home Dashboard"
                    iconName="view-dashboard-outline"
                    active={activeRoute === 'MainTabs'}
                    onPress={() => props.navigation.navigate('MainTabs')}
                />
                <DrawerSection title="FIELD OPERATIONS" />
                <WebCustomDrawerItem
                    label="My Clock (Site Check-In)"
                    iconName="clock-outline"
                    active={activeRoute === 'TimeClock'}
                    onPress={() => props.navigation.navigate('TimeClock')}
                />
                <WebCustomDrawerItem
                    label="Clock In Crew"
                    iconName="account-group-outline"
                    active={activeRoute === 'CrewClock'}
                    onPress={() => props.navigation.navigate('CrewClock')}
                />
                <WebCustomDrawerItem
                    label="Daily Logs"
                    iconName="file-document-edit-outline"
                    active={activeRoute === 'DailyLogs'}
                    onPress={() => props.navigation.navigate('DailyLogs')}
                />
                <WebCustomDrawerItem
                    label="Issues"
                    iconName="alert-circle-outline"
                    active={activeRoute === 'ForemanIssues'}
                    onPress={() => props.navigation.navigate('ForemanIssues')}
                />
                <WebCustomDrawerItem
                    label="Purchase Orders"
                    iconName="clipboard-text-outline"
                    active={activeRoute === 'PurchaseOrders'}
                    onPress={() => props.navigation.navigate('PurchaseOrders')}
                />
                <WebCustomDrawerItem
                    label="Site Discussions"
                    iconName="message-text-outline"
                    active={activeRoute === 'Chatboard'}
                    onPress={() => props.navigation.navigate('Chatboard')}
                />
            </DrawerContentScrollView>
            <DrawerFooter user={user} logout={logout} />
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
                drawerType: 'front',
                drawerStyle: { backgroundColor: '#0f172a', width: Math.min(width * 0.68, 245) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={ForemanTabs} />
            <Drawer.Screen name="TimeClock" component={WorkerTimeClockScreen} />
            <Drawer.Screen name="CrewClock" component={CrewClockScreen} />
            <Drawer.Screen name="DailyLogs" component={DailyLogsScreen} />
            <Drawer.Screen name="TradeManagement" component={TradeManagementScreen} />
            <Drawer.Screen name="Tasks" component={TasksScreen} />
            <Drawer.Screen name="ForemanTasks" component={ForemanTasksScreen} />
            <Drawer.Screen name="RFIDashboard" component={RFIScreen} />
            <Drawer.Screen name="RFIList" component={RFIListScreen} />
            <Drawer.Screen name="ForemanIssues" component={ForemanIssuesScreen} />
            <Drawer.Screen name="ForemanJobDetail" component={ForemanJobDetailScreen} />
            <Drawer.Screen name="Photos" component={ForemanPhotosScreen} />
            <Drawer.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
            <Drawer.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
        </Drawer.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Client
const ClientDrawerContent = (props) => {
    const { logout, user } = useApp();
    const activeRoute = props.state?.routes[props.state?.index]?.name;
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerHeader title="KAAL CLIENT" subtitle={user?.companyName || 'PREMIUM PORTAL'} />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#0f172a' }} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 12 }}>
                <DrawerSection title="CORE MANAGEMENT" />
                <WebCustomDrawerItem
                    label="Home Dashboard"
                    iconName="view-dashboard-outline"
                    active={activeRoute === 'MainTabs'}
                    onPress={() => props.navigation.navigate('MainTabs')}
                />
                <DrawerSection title="FINANCIALS & RFIS" />
                <WebCustomDrawerItem
                    label="Project Invoices"
                    iconName="file-document-outline"
                    active={activeRoute === 'ClientInvoices'}
                    onPress={() => props.navigation.navigate('ClientInvoices')}
                />
                <WebCustomDrawerItem
                    label="RFI Center"
                    iconName="file-question-outline"
                    active={activeRoute === 'ClientRFI'}
                    onPress={() => props.navigation.navigate('ClientRFI')}
                />
                <WebCustomDrawerItem
                    label="Site Discussions"
                    iconName="message-text-outline"
                    active={activeRoute === 'Chatboard'}
                    onPress={() => props.navigation.navigate('Chatboard')}
                />
                <DrawerSection title="ACCOUNT" />
                <WebCustomDrawerItem
                    label="Settings"
                    iconName="cog-outline"
                    active={activeRoute === 'Settings'}
                    onPress={() => props.navigation.navigate('Settings')}
                />
            </DrawerContentScrollView>
            <DrawerFooter user={user} logout={logout} />
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
                drawerType: 'front',
                drawerStyle: { backgroundColor: '#0f172a', width: Math.min(width * 0.68, 245) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={ClientTabs} />
            <Drawer.Screen name="ClientInvoices" component={ClientInvoicesScreen} />
            <Drawer.Screen name="ClientRFI" component={RFIScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
        </Drawer.Navigator>
    );
};

// High-Fidelity Custom Drawer Content for Project Manager
const ProjectManagerDrawerContent = (props) => {
    const { logout, user } = useApp();
    const activeRoute = props.state?.routes[props.state?.index]?.name;
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerHeader title="KAAL PM CONTROL" subtitle="PROJECT MANAGEMENT OPS" />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#0f172a' }} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 12 }}>
                <DrawerSection title="CORE MANAGEMENT" />
                <WebCustomDrawerItem
                    label="Home Dashboard"
                    iconName="view-dashboard-outline"
                    active={activeRoute === 'MainTabs'}
                    onPress={() => props.navigation.navigate('MainTabs')}
                />
                <DrawerSection title="FIELD OPERATIONS" />
                <WebCustomDrawerItem
                    label="Clock In Crew"
                    iconName="account-group-outline"
                    active={activeRoute === 'CrewClock'}
                    onPress={() => props.navigation.navigate('CrewClock')}
                />
                <WebCustomDrawerItem
                    label="Daily Logs"
                    iconName="file-document-edit-outline"
                    active={activeRoute === 'DailyLogs'}
                    onPress={() => props.navigation.navigate('DailyLogs')}
                />
                <WebCustomDrawerItem
                    label="Issues"
                    iconName="alert-circle-outline"
                    active={activeRoute === 'ForemanIssues'}
                    onPress={() => props.navigation.navigate('ForemanIssues')}
                />
                <WebCustomDrawerItem
                    label="GPS Tracking"
                    iconName="crosshairs-gps"
                    active={activeRoute === 'PMGPSTracking'}
                    onPress={() => props.navigation.navigate('PMGPSTracking')}
                />
                <DrawerSection title="SITE DOCUMENTATION" />
                <WebCustomDrawerItem
                    label="Equipment"
                    iconName="wrench-outline"
                    active={activeRoute === 'Equipment'}
                    onPress={() => props.navigation.navigate('Equipment')}
                />
                <WebCustomDrawerItem
                    label="Purchase Orders"
                    iconName="clipboard-text-outline"
                    active={activeRoute === 'PurchaseOrders'}
                    onPress={() => props.navigation.navigate('PurchaseOrders')}
                />
                <DrawerSection title="COMMUNICATIONS" />
                <WebCustomDrawerItem
                    label="RFI Center"
                    iconName="file-question-outline"
                    active={activeRoute === 'RFI'}
                    onPress={() => props.navigation.navigate('RFI')}
                />
                <WebCustomDrawerItem
                    label="Report Logs"
                    iconName="chart-bar"
                    active={activeRoute === 'Reports'}
                    onPress={() => props.navigation.navigate('Reports')}
                />
                <WebCustomDrawerItem
                    label="Site Discussions"
                    iconName="message-text-outline"
                    active={activeRoute === 'Chatboard'}
                    onPress={() => props.navigation.navigate('Chatboard')}
                />
            </DrawerContentScrollView>
            <DrawerFooter user={user} logout={logout} />
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
                drawerType: 'front',
                drawerStyle: { backgroundColor: '#0f172a', width: Math.min(width * 0.68, 245) }
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
    const activeRoute = props.state?.routes[props.state?.index]?.name;
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerHeader title="KAAL SUBCONTRACTOR" subtitle={user?.fullName || 'VERIFIED PARTNER'} />
            <DrawerContentScrollView {...props} style={{ backgroundColor: '#0f172a' }} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 12 }}>
                <DrawerSection title="CORE MANAGEMENT" />
                <WebCustomDrawerItem
                    label="Home Dashboard"
                    iconName="view-dashboard-outline"
                    active={activeRoute === 'MainTabs'}
                    onPress={() => props.navigation.navigate('MainTabs')}
                />
                <DrawerSection title="FIELD OPERATIONS" />
                <WebCustomDrawerItem
                    label="My Clock (Site Check-In)"
                    iconName="clock-outline"
                    active={activeRoute === 'TimeClock'}
                    onPress={() => props.navigation.navigate('TimeClock')}
                />
                <WebCustomDrawerItem
                    label="Equipment"
                    iconName="wrench-outline"
                    active={activeRoute === 'Equipment'}
                    onPress={() => props.navigation.navigate('Equipment')}
                />
                <DrawerSection title="COMMUNICATIONS" />
                <WebCustomDrawerItem
                    label="RFI Center"
                    iconName="file-question-outline"
                    active={activeRoute === 'RFI'}
                    onPress={() => props.navigation.navigate('RFI')}
                />
                <WebCustomDrawerItem
                    label="Site Discussions"
                    iconName="message-text-outline"
                    active={activeRoute === 'Chatboard'}
                    onPress={() => props.navigation.navigate('Chatboard')}
                />
            </DrawerContentScrollView>
            <DrawerFooter user={user} logout={logout} />
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
                component={TasksScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "calendar-check" : "calendar-check-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="Photos"
                component={SubcontractorPhotosScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <MaterialCommunityIcons name={focused ? "camera" : "camera-outline"} color={color} size={24} />
                }}
            />
            <Tab.Screen
                name="RFI"
                component={RFIScreen}
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
                drawerType: 'front',
                drawerActiveBackgroundColor: '#EFF6FF',
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#64748B',
                drawerLabelStyle: { fontWeight: '800', fontSize: moderateScale(13), marginLeft: -4 },
                drawerStyle: { backgroundColor: '#0f172a', width: Math.min(width * 0.68, 245) }
            }}
        >
            <Drawer.Screen name="MainTabs" component={SubcontractorTabs} />
            <Drawer.Screen name="TimeClock" component={WorkerTimeClockScreen} />
            <Drawer.Screen name="Chatboard" component={WorkerChatboard} />
            <Drawer.Screen name="Equipment" component={EquipmentScreen} />
            <Drawer.Screen name="RFI" component={RFIScreen} />
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
    const { user, loading, syncStatus, dismissSyncStatus } = useApp();

    React.useEffect(() => {
        if (user) {
            try {
                const { setupNotificationListeners } = require('../utils/pushNotifications');
                const unsubscribe = setupNotificationListeners(navigationRef);
                return () => unsubscribe();
            } catch (err) {
                console.log('[FCM setupNotificationListeners Error]', err.message);
            }
        }
    }, [user]);

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
                    <Text style={{ color: '#fff', fontSize: moderateScale(13), fontWeight: '900', letterSpacing: 1.5, opacity: 0.8 }}>
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
        <NavigationContainer ref={navigationRef}>
            <View style={{ flex: 1 }}>
                {user && syncStatus?.level === 'warn' ? (
                    <View style={styles.syncBanner}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.syncTitle}>Sync Warning</Text>
                            <Text style={styles.syncMessage}>{syncStatus?.message || 'Data sync delayed.'}</Text>
                            {syncStatus?.roleScope ? <Text style={styles.syncScope}>{syncStatus.roleScope}</Text> : null}
                        </View>
                        <TouchableOpacity onPress={dismissSyncStatus} style={styles.syncClose}>
                            <MaterialCommunityIcons name="close" size={16} color="#FDE68A" />
                        </TouchableOpacity>
                    </View>
                ) : null}

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
                            <Stack.Screen name="TaskHierarchyDetail" component={TaskHierarchyDetailScreen} />
                            <Stack.Screen name="TaskCreate" component={TaskCreateScreen} />
                            <Stack.Screen name="ClientJobs" component={ClientJobsScreen} />
                            <Stack.Screen name="Drawings" component={WorkerDrawingsScreen} />
                            <Stack.Screen name="ForemanTasks" component={ForemanTasksScreen} />
                            <Stack.Screen name="CrewClock" component={CrewClockScreen} />
                            <Stack.Screen name="Photos" component={ForemanPhotosScreen} />
                            <Stack.Screen name="DailyLogs" component={DailyLogsScreen} />
                            <Stack.Screen name="WorkerLogs" component={WorkerLogsScreen} />
                            <Stack.Screen name="SubcontractorPhotos" component={SubcontractorPhotosScreen} />
                        </>
                    )}
                </Stack.Navigator>
            </View>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    syncBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#7C2D12',
        borderBottomWidth: 1,
        borderBottomColor: '#9A3412',
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    syncTitle: { color: '#FDE68A', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
    syncMessage: { color: '#FFF7ED', fontWeight: '700', fontSize: 12, marginTop: 2 },
    syncScope: { color: '#FED7AA', fontSize: 11, marginTop: 4, fontWeight: '700' },
    syncClose: { padding: 4, marginTop: 2 }
});

export default AppNavigation;
