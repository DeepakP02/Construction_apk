import React from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    StatusBar, useWindowDimensions 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const ClientProgressScreen = ({ route, navigation }) => {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isCompact = width < 380;
    const isTablet = width >= 768;
    const { project } = route.params;
    const { user } = useApp();

    const progress = project.progressPercentage || 0;
    const currentPhase = project.currentPhase || 'Structure';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Header Section */}
            <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: isCompact ? 12 : 20 }]}>
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
                    </TouchableOpacity>
                    <View style={[styles.projectHeaderInfo, { flexWrap: 'wrap' }]}>
                        <Text style={[styles.projectName, { fontSize: isCompact ? 22 : 28 }]} numberOfLines={1}>{project.name}</Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{(project.status || 'PLANNING').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.breadcrumbRow}>
                   <MaterialCommunityIcons name="pulse" size={16} color="#3B82F6" />
                   <Text style={styles.breadcrumbText}>LIVE WORK PROGRESS VIEW</Text>
                </View>
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isCompact ? 12 : 16, maxWidth: isTablet ? 980 : undefined, alignSelf: 'center', width: '100%' }]}
            >
                {/* Main Dashboard Grid */}
                <View style={styles.topDashboardRow}>
                    {/* Overall Progress Card */}
                    <View style={[styles.progressCard, SHADOWS.medium, { padding: isCompact ? 18 : 30 }]}>
                        <View style={[styles.circularContainer, { width: isCompact ? 150 : 180, height: isCompact ? 150 : 180 }]}>
                            <View style={[styles.outerCircle, { width: isCompact ? 132 : 160, height: isCompact ? 132 : 160, borderRadius: isCompact ? 66 : 80 }]}>
                                <View style={[styles.innerCircle, { width: isCompact ? 106 : 130, height: isCompact ? 106 : 130, borderRadius: isCompact ? 53 : 65 }]}>
                                    <Text style={[styles.percentText, { fontSize: isCompact ? 34 : 44 }]}>{progress}%</Text>
                                    <Text style={styles.overallLabel}>OVERALL</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.datesRow}>
                           <View>
                               <Text style={styles.dateLabel}>STARTED: 1/1/1970</Text>
                           </View>
                           <View style={styles.dateSpacer} />
                           <View>
                               <Text style={styles.dateLabel}>EST. FINISH: 1/1/1970</Text>
                           </View>
                        </View>
                    </View>

                    {/* Current Phase Card */}
                    <View style={[styles.phaseCard, SHADOWS.medium, { padding: isCompact ? 18 : 30 }]}>
                        <Text style={styles.phaseHeaderLabel}>CURRENT PHASE</Text>
                        <Text style={[styles.phaseTitle, { fontSize: isCompact ? 24 : 32 }]}>{currentPhase}</Text>
                        
                        <View style={styles.inProgressBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.inProgressText}>IN PROGRESS</Text>
                        </View>

                        <Text style={styles.phaseDesc}>
                            Our team is currently focused on <Text style={{fontWeight: '900'}}>{currentPhase}</Text>. Everything is following the schedule.
                        </Text>
                    </View>
                </View>

                {/* Secondary Grid */}
                <View style={styles.secondaryRow}>
                    {/* Completed Milestones */}
                    <View style={[styles.milestoneCard, SHADOWS.small, { minHeight: isCompact ? 180 : 220, height: isCompact ? undefined : 220 }]}>
                        <View style={styles.cardIconHeader}>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#10B981" />
                            <Text style={styles.cardHeading}>Completed Milestones</Text>
                        </View>
                        <View style={styles.milestoneEmptyState}>
                            <Text style={styles.emptyNoteText}>No milestones completed yet.</Text>
                            <MaterialCommunityIcons name="shield-check-outline" size={60} color="#F1F5F9" style={styles.shieldDecoration} />
                        </View>
                    </View>

                    {/* Next Steps */}
                    <View style={[styles.nextStepsCard, SHADOWS.small, { minHeight: isCompact ? 180 : 220, height: isCompact ? undefined : 220 }]}>
                        <View style={styles.cardIconHeader}>
                            <MaterialCommunityIcons name="clock-outline" size={20} color="#3B82F6" />
                            <Text style={styles.cardHeading}>Next Steps</Text>
                        </View>
                        <View style={styles.stepsList}>
                            <View style={styles.stepItem}>
                                <View style={styles.dotContainer}>
                                    <View style={[styles.blueDot, { opacity: 0.8 }]} />
                                </View>
                                <Text style={styles.stepText}>Millwork / Cabinet work</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <View style={styles.dotContainer}>
                                    <View style={[styles.blueDot, { opacity: 0.5 }]} />
                                </View>
                                <Text style={styles.stepText}>Finishing / door / paint</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <View style={styles.dotContainer}>
                                    <View style={[styles.blueDot, { opacity: 0.3 }]} />
                                </View>
                                <Text style={styles.stepText}>Signage/Graphics</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="format-list-bulleted" size={60} color="#F8FAFC" style={styles.listDecoration} />
                    </View>
                </View>

                {/* Recent Activity Section */}
                <View style={styles.activityHeader}>
                    <MaterialCommunityIcons name="comment-outline" size={18} color="#3B82F6" />
                    <Text style={styles.activitySectionTitle}>Recent Site Activity</Text>
                </View>

                <View style={styles.emptyActivityBox}>
                     <MaterialCommunityIcons name="loading" size={32} color="#E2E8F0" style={{ marginBottom: 16 }} />
                     <Text style={styles.emptyActivityText}>NO UPDATES POSTED YET.</Text>
                </View>

                <View style={{ height: Math.max(insets.bottom + 60, 100) }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { paddingHorizontal: 20, backgroundColor: '#FFFFFF', paddingBottom: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'left' },
    projectHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    projectName: { fontSize: 28, fontWeight: '950', color: '#0F172A', letterSpacing: -1.5 },
    statusBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 10, fontWeight: '900', color: '#1D4ED8', letterSpacing: 0.5 },
    breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, opacity: 0.8 },
    breadcrumbText: { fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1 },

    scrollContent: { padding: 16 },
    
    topDashboardRow: { flexDirection: 'column', gap: 16, marginBottom: 16 },
    
    // Progress Card
    progressCard: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 30, alignItems: 'center', flex: 1 },
    circularContainer: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center' },
    outerCircle: { 
        width: 160, 
        height: 160, 
        borderRadius: 80, 
        borderWidth: 12, 
        borderColor: '#F8FAFC', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    innerCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
    percentText: { fontSize: 44, fontWeight: '950', color: '#0F172A', letterSpacing: -2 },
    overallLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginTop: -4 },
    datesRow: { flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 20, marginTop: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
    dateLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    dateSpacer: { width: 1, height: 12, backgroundColor: '#E2E8F0' },

    // Phase Card
    phaseCard: { backgroundColor: '#1E293B', borderRadius: 32, padding: 30, flex: 1 },
    phaseHeaderLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
    phaseTitle: { fontSize: 32, fontWeight: '950', color: '#FFFFFF', letterSpacing: -1, marginBottom: 16 },
    inProgressBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        backgroundColor: 'rgba(16, 185, 129, 0.15)', 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 30
    },
    greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    inProgressText: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
    phaseDesc: { fontSize: 12, color: '#94A3B8', lineHeight: 18, fontWeight: '500' },

    // Secondary Row
    secondaryRow: { flexDirection: 'column', gap: 16, marginBottom: 24 },
    milestoneCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, flex: 1, height: 220 },
    nextStepsCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, flex: 1, height: 220, position: 'relative', overflow: 'hidden' },
    cardIconHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    cardHeading: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    
    milestoneEmptyState: { flex: 1, justifyContent: 'center', position: 'relative' },
    emptyNoteText: { fontSize: 11, fontStyle: 'italic', color: '#94A3B8', fontWeight: '500' },
    shieldDecoration: { position: 'absolute', right: -10, bottom: -10, opacity: 0.5 },

    stepsList: { gap: 16 },
    stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dotContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    blueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
    stepText: { fontSize: 12, fontWeight: '800', color: '#475569' },
    listDecoration: { position: 'absolute', right: -10, top: 20, opacity: 0.2 },

    // Activity Section
    activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 16 },
    activitySectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    emptyActivityBox: { 
        height: 180, 
        borderRadius: 32, 
        borderWidth: 1.5, 
        borderColor: '#F1F5F9', 
        borderStyle: 'dashed', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    emptyActivityText: { fontSize: 10, fontWeight: '900', color: '#CBD5E1', letterSpacing: 1 }
});

export default ClientProgressScreen;
