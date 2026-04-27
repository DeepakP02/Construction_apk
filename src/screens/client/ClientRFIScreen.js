import React from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    Dimensions, StatusBar, Platform 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const ClientRFIScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { rfis, loading } = useApp();

    const highPriorityCount = (rfis || []).filter(r => r.priority === 'High' || r.priority === 'Critical').length;
    const overdueCount = (rfis || []).filter(r => r.status === 'Overdue' || (new Date(r.dueDate) < new Date() && r.status !== 'Closed')).length;

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="RFI CENTER" hideSearch />

            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            >
                {/* Header Titles */}
                <View style={styles.headerTitleSection}>
                    <Text style={styles.mainTitle}>RFI Dashboard</Text>
                    <Text style={styles.subTitle}>Request for Information — Overview & Summary</Text>
                </View>

                {/* Dashboard Grid */}
                <View style={styles.dashboardGrid}>
                    {/* Recent RFIs Card */}
                    <View style={[styles.dashboardCard, SHADOWS.medium]}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardHeaderTitle}>Recent RFIs</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('RFIList')}>
                                <Text style={styles.viewAllText}>View All ></Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.cardBody}>
                            {(rfis || []).length > 0 ? (
                                (rfis || []).slice(0, 3).map((r, i) => (
                                    <View key={i} style={styles.rfiMiniItem}>
                                        <View style={styles.rfiDot} />
                                        <Text style={styles.rfiTitleText} numberOfLines={1}>{r.subject}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyStateBox}>
                                    <Text style={styles.emptyText}>No RFIs yet</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* High Priority Summary Card */}
                    <View style={[styles.dashboardCard, SHADOWS.medium, { backgroundColor: '#FFF7F7' }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.titleWithIcon}>
                                <MaterialCommunityIcons name="alert" size={18} color="#EF4444" />
                                <Text style={styles.cardHeaderTitle}>High Priority</Text>
                            </View>
                            <View style={styles.countBadgeRed}>
                                <Text style={styles.badgeTextRed}>{highPriorityCount}</Text>
                            </View>
                        </View>
                        <View style={styles.cardBodyCenter}>
                            <Text style={styles.emptyStateSubtitle}>
                                {highPriorityCount > 0 ? `${highPriorityCount} critical items require review` : '🎉 No high priority RFIs'}
                            </Text>
                        </View>
                    </View>

                    {/* Overdue Summary Card */}
                    <View style={[styles.dashboardCard, SHADOWS.medium, { backgroundColor: '#FFFBF5' }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.titleWithIcon}>
                                <MaterialCommunityIcons name="clock-outline" size={18} color="#F59E0B" />
                                <Text style={styles.cardHeaderTitle}>Overdue</Text>
                            </View>
                            <View style={styles.countBadgeOrange}>
                                <Text style={styles.badgeTextOrange}>{overdueCount}</Text>
                            </View>
                        </View>
                        <View style={styles.cardBodyCenter}>
                            <Text style={styles.emptyStateSubtitle}>
                                {overdueCount > 0 ? `${overdueCount} items are behind schedule` : '✅ No overdue RFIs'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Main Action Button */}
                <TouchableOpacity 
                    style={[styles.mainActionBtn, SHADOWS.medium]}
                    onPress={() => navigation.navigate('RFIList')}
                >
                    <View>
                        <Text style={styles.btnMainLabel}>View All RFIs</Text>
                        <Text style={styles.btnSubLabel}>Filter, search and manage all requests</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#FFFFFF" />
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 16 },
    
    headerTitleSection: { marginBottom: 24, paddingHorizontal: 4 },
    mainTitle: { fontSize: 32, fontWeight: '950', color: '#0F172A', letterSpacing: -1.5 },
    subTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 4 },

    dashboardGrid: { gap: 16, marginBottom: 24 },
    dashboardCard: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 24, 
        padding: 24, 
        minHeight: isSmallDevice ? 150 : 170,
        justifyContent: 'space-between'
    },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', letterSpacing: -0.5 },
    viewAllText: { fontSize: 12, fontWeight: '900', color: '#3B82F6' },
    
    countBadgeRed: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgeTextRed: { fontSize: 12, fontWeight: '900', color: '#EF4444' },
    countBadgeOrange: { backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgeTextOrange: { fontSize: 12, fontWeight: '900', color: '#F59E0B' },

    cardBody: { flex: 1 },
    cardBodyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    rfiMiniItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
    rfiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
    rfiTitleText: { fontSize: 13, fontWeight: '700', color: '#475569' },

    emptyStateBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '800' },
    emptyStateSubtitle: { fontSize: 13, fontWeight: '800', color: '#64748B', textAlign: 'center' },

    mainActionBtn: { 
        backgroundColor: '#3B82F6', 
        borderRadius: 24, 
        padding: 24, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: 10
    },
    btnMainLabel: { fontSize: 19, fontWeight: '950', color: '#FFFFFF', letterSpacing: -0.5 },
    btnSubLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 2 }
});

export default ClientRFIScreen;
