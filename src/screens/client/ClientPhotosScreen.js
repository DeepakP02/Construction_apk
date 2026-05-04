import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    Dimensions, ActivityIndicator, Modal, StatusBar, ScrollView,
    RefreshControl, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api, { getServerUrl } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;
const CARD_GAP = 10;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / NUM_COLUMNS;

const ClientPhotosScreen = ({ navigation }) => {
    const { projects, user } = useApp();
    const insets = useSafeAreaInsets();

    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('All');
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    // Fetch photos from backend — same API as web software (/photos)
    const fetchPhotos = useCallback(async () => {
        try {
            const res = await api.get('/photos');
            setPhotos(res.data || []);
        } catch (e) {
            console.error('Fetch photos error:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchPhotos();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPhotos();
    }, [fetchPhotos]);

    // Get accessible project IDs for the client
    const clientProjectIds = (projects || []).map(p => p._id || p.id);

    // Photos that should be visible to the client (role + project + internal check)
    const visiblePhotos = photos.filter(p => {
        const pId = String(p.projectId?._id || p.projectId);
        const uploader = p.uploadedBy || p.userId;
        const uploaderRole = (uploader?.role || '').toUpperCase();
        const isInternal = p.description?.includes('[INTERNAL_ISSUE_PHOTO]');
        const isMyProject = clientProjectIds.map(id => String(id)).includes(pId);
        
        // If backend wasn't restarted, role might be empty. In that case, we show it if it's not internal.
        // Dashboard shows everything, so let's match dashboard's leniency but keep internal check.
        const isOfficialUpdate = !uploaderRole || ['PM', 'FOREMAN', 'COMPANY_OWNER', 'SUPER_ADMIN', 'PROJECT_MANAGER', 'ADMIN'].includes(uploaderRole);
        const uploaderId = uploader?._id || uploader?.id || uploader;
        const myId = user?._id || user?.id;
        const isMyOwnPhoto = String(uploaderId) === String(myId);

        return isMyProject && !isInternal && (isOfficialUpdate || isMyOwnPhoto);
    });

    // Final filtered list based on active tab
    const filteredPhotos = visiblePhotos.filter(p => {
        if (activeTab === 'All') return true;
        const pId = p.projectId?._id || p.projectId;
        return pId === activeTab;
    });

    // Count photos per project for tab badges
    const getProjectPhotoCount = (projectId) => {
        return visiblePhotos.filter(p => (p.projectId?._id || p.projectId) === projectId).length;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatFullDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Render each photo card — matching all web data fields
    const renderPhotoCard = ({ item }) => {
        const projectName = item.projectId?.name || 'General Update';
        const description = item.description || '';
        const createdAt = formatDate(item.createdAt);
        const imageUri = getServerUrl(item.imageUrl);

        return (
            <TouchableOpacity
                style={[styles.photoCardWrapper]}
                activeOpacity={0.85}
                onPress={() => setSelectedPhoto(item)}
            >
                <View style={[styles.photoCard, SHADOWS.small]}>
                    {/* Image Section */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.photoImg}
                            resizeMode="cover"
                        />
                        {/* Project Badge Overlay */}
                        <View style={styles.photoOverlay}>
                            <View style={styles.photoBadge}>
                                <Text style={styles.photoBadgeText} numberOfLines={1}>
                                    {projectName}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Footer — matching web: project name, date, description */}
                    <View style={styles.photoFooter}>
                        <Text style={styles.photoProjectTitle} numberOfLines={1}>
                            {projectName}
                        </Text>

                        <View style={styles.footerMetaRow}>
                            <View style={styles.dateRow}>
                                <MaterialCommunityIcons name="calendar" size={10} color="#3B82F6" />
                                <Text style={styles.dateText}>{createdAt}</Text>
                            </View>
                            <View style={styles.progressViewBadge}>
                                <Text style={styles.progressViewText}>PROGRESS</Text>
                            </View>
                        </View>

                        {description ? (
                            <Text style={styles.descriptionText} numberOfLines={2}>
                                "{description}"
                            </Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // LOADING STATE
    if (loading) {
        return (
            <View style={styles.screen}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <WorkerHeader title="Photos" hideSearch />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>LOADING GALLERY...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Photos" hideSearch />

            {/* Page Header */}
            <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Project Photos</Text>
                <Text style={styles.pageSubtitle}>
                    Real-time visual progress from all your active construction sites.
                </Text>
            </View>

            {/* Project Filter Tabs — matching web software exactly */}
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsScroll}
                >
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'All' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('All')}
                    >
                        <Text style={[styles.tabText, activeTab === 'All' && styles.tabTextActive]}>
                            All Photos ({visiblePhotos.length})
                        </Text>
                    </TouchableOpacity>

                    {(projects || []).map(project => (
                        <TouchableOpacity
                            key={project._id}
                            style={[styles.tabBtn, activeTab === project._id && styles.tabBtnActive]}
                            onPress={() => setActiveTab(project._id)}
                        >
                            <Text style={[styles.tabText, activeTab === project._id && styles.tabTextActive]}
                                numberOfLines={1}
                            >
                                {project.name} ({getProjectPhotoCount(project._id || project.id)})
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Photo Grid */}
            <FlatList
                data={filteredPhotos}
                numColumns={NUM_COLUMNS}
                keyExtractor={(item) => item._id || item.id}
                renderItem={renderPhotoCard}
                contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#3B82F6']}
                        tintColor="#3B82F6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={64} color="#E2E8F0" />
                        <Text style={styles.emptyTitle}>No Photos Found</Text>
                        <Text style={styles.emptySubtitle}>
                            No site photos have been uploaded for this project yet.
                        </Text>
                    </View>
                }
            />

            {/* Lightbox Modal — matching web software's rich lightbox */}
            <Modal
                visible={!!selectedPhoto}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedPhoto(null)}
            >
                <View style={styles.lightboxOverlay}>
                    {/* Close Button */}
                    <TouchableOpacity
                        style={[styles.lightboxClose, { top: Math.max(insets.top, 20) + 16 }]}
                        onPress={() => setSelectedPhoto(null)}
                    >
                        <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Full Image */}
                    <View style={styles.lightboxImageContainer}>
                        <Image
                            source={{ uri: getServerUrl(selectedPhoto?.imageUrl) }}
                            style={styles.lightboxImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Info Panel — matching web: project name, date, description */}
                    <View style={styles.lightboxInfoPanel}>
                        <View style={styles.lightboxInfoLeft}>
                            <Text style={styles.lightboxLabel}>PROJECT DOCUMENTATION</Text>
                            <Text style={styles.lightboxProjectName}>
                                {selectedPhoto?.projectId?.name || 'General Update'}
                            </Text>
                            <View style={styles.lightboxDateRow}>
                                <MaterialCommunityIcons name="calendar" size={14} color="#93C5FD" />
                                <Text style={styles.lightboxDateText}>
                                    {formatFullDate(selectedPhoto?.createdAt)}
                                </Text>
                            </View>
                        </View>

                        {selectedPhoto?.description ? (
                            <View style={styles.lightboxDescBox}>
                                <Text style={styles.lightboxDescText}>
                                    "{selectedPhoto.description}"
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#FFFFFF' },

    // Loading
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 2 },

    // Page Header
    pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    pageTitle: { fontSize: isSmallDevice ? 24 : 28, fontWeight: '950', color: '#0F172A', letterSpacing: -1.5 },
    pageSubtitle: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4, lineHeight: 18 },

    // Tabs — matching web's pill tab style
    tabsContainer: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    tabsScroll: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#F8FAFC',
        padding: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    tabBtn: {
        paddingHorizontal: isSmallDevice ? 12 : 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    tabBtnActive: {
        backgroundColor: '#3B82F6',
        elevation: 4,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    tabText: {
        fontSize: isSmallDevice ? 9 : 10,
        fontWeight: '900',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },

    // Grid
    gridContent: { paddingHorizontal: 12, paddingTop: 4 },
    photoCardWrapper: {
        width: CARD_WIDTH,
        margin: CARD_GAP / 2,
    },
    photoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    imageContainer: {
        width: '100%',
        height: isSmallDevice ? 140 : 160,
        backgroundColor: '#F1F5F9',
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
    },
    photoBadge: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    photoBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // Card Footer
    photoFooter: { padding: isSmallDevice ? 10 : 14 },
    photoProjectTitle: {
        fontSize: isSmallDevice ? 11 : 12,
        fontWeight: '900',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    footerMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    progressViewBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    progressViewText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#3B82F6',
        letterSpacing: 0.5,
    },
    descriptionText: {
        fontSize: 10,
        color: '#64748B',
        fontStyle: 'italic',
        lineHeight: 15,
        marginTop: 4,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#94A3B8',
        marginTop: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    emptySubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#CBD5E1',
        marginTop: 8,
        textAlign: 'center',
    },

    // Lightbox
    lightboxOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        justifyContent: 'center',
    },
    lightboxClose: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    lightboxImage: {
        width: SCREEN_WIDTH - 32,
        height: SCREEN_WIDTH - 32,
        borderRadius: 24,
    },
    lightboxInfoPanel: {
        paddingHorizontal: 24,
        paddingVertical: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    lightboxInfoLeft: { marginBottom: 16 },
    lightboxLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#60A5FA',
        letterSpacing: 2,
        marginBottom: 6,
    },
    lightboxProjectName: {
        fontSize: 22,
        fontWeight: '950',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: -1,
    },
    lightboxDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    lightboxDateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#93C5FD',
    },
    lightboxDescBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    lightboxDescText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: 'rgba(255, 255, 255, 0.8)',
        lineHeight: 20,
    },
});

export default ClientPhotosScreen;
