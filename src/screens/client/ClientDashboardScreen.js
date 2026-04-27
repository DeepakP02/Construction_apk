import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ClientDashboardScreen = ({ navigation }) => {
    
    // Mock Data based on USER_REQUEST
    const projectInfo = {
        name: "Vishaw OakBerry",
        progress: 0,
        lastUpdate: "09/04/2026",
        updateDescription: "Coastal health inspection. Withvraj and shawn",
        siteViews: [
            "https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&w=400&q=80",
            "https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&w=400&q=80",
            "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=400&q=80",
            "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80"
        ],
        documents: [
            { id: '1', title: 'Floor Plan', category: 'architectural', version: 'v1' }
        ]
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} hideSearch={true} title="Client Dashboard" />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* SINGLE CONSOLIDATED MODERN CARD */}
                <View style={[styles.mainCard, SHADOWS.card]}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTopTitle}>Project Timeline</Text>
                    </View>

                    {/* Progress Row */}
                    <View style={styles.progressRow}>
                        <Text style={styles.bigPercent}>{projectInfo.progress}%</Text>
                        <View style={styles.progressNameBox}>
                            <Text style={styles.projectNameText}>{projectInfo.name}</Text>
                            <Text style={styles.progressLabel}>Current Progress</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarWrapper}>
                        <View style={[styles.progressBarFill, { width: `${Math.max(projectInfo.progress, 5)}%` }]} />
                    </View>

                    {/* Divider */}
                    <View style={styles.cardDivider} />

                    {/* Update Section */}
                    <View style={styles.updateSection}>
                        <View style={styles.updateMeta}>
                            <Text style={styles.updateDate}>{projectInfo.lastUpdate}</Text>
                            <View style={styles.dotSeparator} />
                            <Text style={styles.updateType}>Site Log</Text>
                        </View>
                        <Text style={styles.updateDesc} numberOfLines={2}>
                            {projectInfo.updateDescription}
                        </Text>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity 
                        style={styles.compactActionBtn}
                        onPress={() => navigation.navigate('Drawings')}
                    >
                        <LinearGradient
                            colors={[COLORS.primaryAccent, '#2563EB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.btnGradient}
                        >
                            <MaterialCommunityIcons name="floor-plan" size={18} color="#fff" />
                            <Text style={styles.btnText}>View Drawings</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Section: Latest Site Views */}
                <View style={styles.sectionHeaderCompact}>
                    <Text style={styles.sectionTitleCompact}>Latest Site Views</Text>
                    <TouchableOpacity>
                        <Text style={styles.linkText}>Gallery</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScrollCompact}>
                    {projectInfo.siteViews.map((url, index) => (
                        <View key={index} style={styles.galleryItemCompact}>
                            <Image source={{ uri: url }} style={styles.galleryImgCompact} />
                            <View style={styles.siteLabelCompact}>
                                <Text style={styles.siteLabelText}>Site</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* Section: Vault & Drawings */}
                <View style={[styles.sectionHeaderCompact, { marginTop: 25 }]}>
                    <Text style={styles.sectionTitleCompact}>Vault & Drawings</Text>
                </View>

                {projectInfo.documents.map((doc) => (
                    <TouchableOpacity 
                        key={doc.id} 
                        style={[styles.docItemCompact, SHADOWS.small]}
                        onPress={() => navigation.navigate('Drawings')}
                    >
                        <View style={styles.docIconCircle}>
                            <MaterialCommunityIcons name="file-pdf-box" size={24} color="#DC2626" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.docTitleCompact}>{doc.title}</Text>
                            <Text style={styles.docMetaCompact}>{doc.category} • {doc.version}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                ))}

                <TouchableOpacity 
                    style={styles.viewAllVaultBtnCompact}
                    onPress={() => navigation.navigate('Drawings')}
                >
                    <Text style={styles.viewAllVaultTextCompact}>View All Vault</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 14,
        paddingTop: 10,
        paddingBottom: 40,
    },
    mainCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTopTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    bigPercent: {
        fontSize: 36,
        fontWeight: '950',
        color: '#0F172A',
        letterSpacing: -1.5,
    },
    progressNameBox: {
        marginLeft: 15,
    },
    projectNameText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2,
    },
    progressBarWrapper: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        width: '100%',
        marginBottom: 20,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primaryAccent,
        borderRadius: 4,
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        width: '100%',
        marginBottom: 15,
    },
    updateSection: {
        marginBottom: 20,
    },
    updateMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    updateDate: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    dotSeparator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 8,
    },
    updateType: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primaryAccent,
    },
    updateDesc: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        fontWeight: '600',
    },
    compactActionBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: COLORS.primaryAccent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    btnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    btnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    sectionHeaderCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitleCompact: {
        fontSize: 15,
        fontWeight: '900',
        color: '#1E293B',
    },
    linkText: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primaryAccent,
    },
    galleryScrollCompact: {
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    galleryItemCompact: {
        marginRight: 12,
        width: 120,
        height: 120,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
    },
    galleryImgCompact: {
        width: '100%',
        height: '100%',
    },
    siteLabelCompact: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    siteLabelText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    docItemCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    docIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    docTitleCompact: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
    },
    docMetaCompact: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 2,
    },
    viewAllVaultBtnCompact: {
        marginTop: 8,
        width: '100%',
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    viewAllVaultTextCompact: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
    }
});

export default ClientDashboardScreen;
