import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Animated, ActivityIndicator, Dimensions, 
    ScrollView, Share, Linking, Modal, Pressable, Alert, StatusBar, useWindowDimensions 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api, { getServerUrl } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const WorkerDrawingsScreen = () => {
    const { projects, selectedProject: globalSelectedProject } = useApp();
    const { width, height } = useWindowDimensions();
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filtering
    const [search, setSearch] = useState('');
    const [activeProject, setActiveProject] = useState('All');
    const [activeCategory, setActiveCategory] = useState('All');
    
    // Details Modal
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const categories = ['All', 'Architecture', 'Structural', 'Plumbing', 'Electrical', 'HVAC'];

    const fetchDrawings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/drawings');
            setDrawings(res.data);
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        } catch (e) {
            console.error('Fetch drawings error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrawings();
    }, []);

    // Sync with global selection
    useEffect(() => {
        if (globalSelectedProject) {
            setActiveProject(globalSelectedProject._id || globalSelectedProject.id);
        } else {
            setActiveProject('All');
        }
    }, [globalSelectedProject]);

    const filteredDrawings = (drawings || []).filter(d => {
        const matchesSearch = (d.title || '').toLowerCase().includes(search.toLowerCase()) || 
                             (d.drawingNumber || '').toLowerCase().includes(search.toLowerCase());
        const matchesProject = activeProject === 'All' || d.projectId?._id === activeProject || d.projectId === activeProject;
        const matchesCategory = activeCategory === 'All' || (d.category || '').toLowerCase() === activeCategory.toLowerCase();
        
        return matchesSearch && matchesProject && matchesCategory;
    });

    const getLatestFileUrl = (item) => {
        if (!item || !item.versions || item.versions.length === 0) return null;
        const ver = item.versions.find(v => String(v.versionNumber) === String(item.currentVersion)) 
                    || item.versions[item.versions.length - 1];
        if (!ver?.fileUrl) return null;
        return getServerUrl(ver.fileUrl);
    };

    const handleView = (item) => {
        setSelectedDrawing(item);
        setModalVisible(true);
    };

    const handleShare = async (item) => {
        const url = getLatestFileUrl(item);
        if (!url) {
            Alert.alert('Error', 'No file link available for this drawing.');
            return;
        }
        try {
            await Share.share({
                message: `Project Drawing: ${item.title}\nProject: ${item.projectId?.name || 'Site'}\nURL: ${url}`,
                title: item.title,
            });
        } catch (error) {
            console.error(error.message);
        }
    };

    // Selection Logic
    const [selectorVisible, setSelectorVisible] = useState(false);
    const [selectorType, setSelectorType] = useState(null);

    const openSelector = (type) => {
        setSelectorType(type);
        setSelectorVisible(true);
    };

    const handleSelect = (value) => {
        if (selectorType === 'project') setActiveProject(value);
        else setActiveCategory(value);
        setSelectorVisible(false);
    };

    const renderHeader = () => (
        <View style={styles.headerArea}>
            <View style={styles.titleInfo}>
                <Text style={[styles.mainTitle, { fontSize: moderateScale(26) }]}>Drawings & Blueprints</Text>
                <Text style={[styles.subTitle, { fontSize: moderateScale(13) }]}>Manage latest revisions and architectural plans.</Text>
            </View>

            <View style={styles.controlPanel}>
                <View style={[styles.searchBar, { height: verticalScale(52) }]}>
                    <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                    <TextInput 
                        style={[styles.searchInput, { fontSize: moderateScale(14) }]}
                        placeholder="Search drawings..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                <View style={styles.filtersRow}>
                    <TouchableOpacity 
                        style={[styles.dropdown, { height: verticalScale(44) }]} 
                        onPress={() => openSelector('project')}
                    >
                        <Text style={[styles.dropdownLabel, { fontSize: moderateScale(12) }]} numberOfLines={1}>
                            {activeProject === 'All' ? 'All Projects' : (projects.find(p => p._id === activeProject || p.id === activeProject)?.name || 'Project')}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(16)} color="#475569" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.dropdown, { height: verticalScale(44) }]} 
                        onPress={() => openSelector('discipline')}
                    >
                        <Text style={[styles.dropdownLabel, { fontSize: moderateScale(12) }]}>{activeCategory === 'All' ? 'All Disciplines' : activeCategory}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(16)} color="#475569" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tableHead}>
                <Text style={[styles.headCol, { flex: 2.5, fontSize: moderateScale(10) }]}>DRAWING NAME</Text>
                <Text style={[styles.headCol, { flex: 1.5, fontSize: moderateScale(10) }]}>PROJECT</Text>
                <Text style={[styles.headCol, { flex: 1, fontSize: moderateScale(10), textAlign: 'center' }]}>VERSION</Text>
                <Text style={[styles.headCol, { flex: 1, fontSize: moderateScale(10), textAlign: 'right' }]}>DATE</Text>
            </View>
        </View>
    );

    const renderDrawingItem = ({ item }) => (
        <TouchableOpacity style={styles.tableRow} activeOpacity={0.7} onPress={() => handleView(item)}>
            <View style={{ flex: 2.5 }}>
                <Text style={[styles.rowName, { fontSize: moderateScale(15) }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.rowSubName, { fontSize: moderateScale(11) }]}>{item.drawingNumber || 'A-XX'}</Text>
            </View>
            <View style={{ flex: 1.5 }}>
                <Text style={[styles.rowProject, { fontSize: moderateScale(12) }]} numberOfLines={1}>{item.projectId?.name || '---'}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={styles.vBadge}>
                    <Text style={[styles.vText, { fontSize: moderateScale(10) }]}>v{item.currentVersion}.0</Text>
                </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.rowDate, { fontSize: moderateScale(11) }]}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: '2-digit' }) : '--'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader hideSearch={true} title="Drawing Management" />
            
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={[styles.loadingInfo, { fontSize: moderateScale(13) }]}>Syncing Blueprints...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDrawings}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderDrawingItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={[styles.listContent, { paddingHorizontal: isTablet ? '10%' : 0 }]}
                    ListEmptyComponent={
                        <View style={styles.emptyContent}>
                            <MaterialCommunityIcons name="file-search-outline" size={moderateScale(64)} color="#E2E8F0" />
                            <Text style={[styles.emptyMainText, { fontSize: moderateScale(18) }]}>No blueprints found</Text>
                            <Text style={[styles.emptySubText, { fontSize: moderateScale(14) }]}>Try adjusting your search or filters.</Text>
                        </View>
                    }
                />
            )}

            {/* SELECTION MODAL */}
            <Modal transparent visible={selectorVisible} animationType="fade">
                <Pressable style={styles.selectorOverlay} onPress={() => setSelectorVisible(false)}>
                    <View style={[styles.selectorContent, { maxWidth: scale(400), alignSelf: 'center' }]}>
                        <View style={styles.selectorHeader}>
                            <Text style={[styles.selectorTitle, { fontSize: moderateScale(18) }]}>Select {selectorType === 'project' ? 'Project' : 'Discipline'}</Text>
                            <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TouchableOpacity 
                                style={[styles.selectorItem, (selectorType === 'project' ? activeProject : activeCategory) === 'All' && styles.selectorItemActive]}
                                onPress={() => handleSelect('All')}
                            >
                                <Text style={[styles.selectorText, (selectorType === 'project' ? activeProject : activeCategory) === 'All' && styles.selectorTextActive, { fontSize: moderateScale(15) }]}>
                                    All {selectorType === 'project' ? 'Projects' : 'Disciplines'}
                                </Text>
                            </TouchableOpacity>
                            {(selectorType === 'project' ? projects : categories.slice(1)).map((option) => (
                                <TouchableOpacity 
                                    key={option._id || option.id || option}
                                    style={[styles.selectorItem, (selectorType === 'project' ? activeProject : activeCategory) === (option._id || option.id || option) && styles.selectorItemActive]}
                                    onPress={() => handleSelect(option._id || option.id || option)}
                                >
                                    <Text style={[styles.selectorText, (selectorType === 'project' ? activeProject : activeCategory) === (option._id || option.id || option) && styles.selectorTextActive, { fontSize: moderateScale(15) }]}>
                                        {option.name || option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* DETAILS MODAL */}
            <Modal transparent visible={modalVisible} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalPanel, { maxWidth: 600, alignSelf: 'center', width: '100%', borderTopLeftRadius: moderateScale(36), borderTopRightRadius: moderateScale(36) }]}>
                        <View style={styles.modalTopRow}>
                            <Text style={[styles.modalHeaderTitle, { fontSize: moderateScale(20) }]}>Blueprint Overview</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {selectedDrawing && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={[styles.docBanner, { padding: moderateScale(20), borderRadius: moderateScale(24) }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.pdfIconBox, { width: scale(64), height: scale(64), borderRadius: moderateScale(16) }]}>
                                            <MaterialCommunityIcons name="file-pdf-box" size={moderateScale(40)} color="#EF4444" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: scale(15) }}>
                                            <Text style={[styles.bannerTitle, { fontSize: moderateScale(18) }]}>{selectedDrawing.title}</Text>
                                            <Text style={[styles.bannerMeta, { fontSize: moderateScale(13) }]}>{selectedDrawing.drawingNumber} • {selectedDrawing.category?.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.gridContainer}>
                                    <View style={styles.gridItem}>
                                        <Text style={[styles.gridLabel, { fontSize: moderateScale(9) }]}>PROJECT SITE</Text>
                                        <Text style={[styles.gridValue, { fontSize: moderateScale(14) }]}>{selectedDrawing.projectId?.name || '---'}</Text>
                                    </View>
                                    <View style={styles.gridItem}>
                                        <Text style={[styles.gridLabel, { fontSize: moderateScale(9) }]}>LATEST VERSION</Text>
                                        <Text style={[styles.gridValue, { fontSize: moderateScale(14) }]}>v{selectedDrawing.currentVersion}.0</Text>
                                    </View>
                                    <View style={styles.gridItem}>
                                        <Text style={[styles.gridLabel, { fontSize: moderateScale(9) }]}>RELEASE DATE</Text>
                                        <Text style={[styles.gridValue, { fontSize: moderateScale(14) }]}>{selectedDrawing.createdAt ? new Date(selectedDrawing.createdAt).toLocaleDateString() : '--'}</Text>
                                    </View>
                                    <View style={styles.gridItem}>
                                        <Text style={[styles.gridLabel, { fontSize: moderateScale(9) }]}>STATUS</Text>
                                        <Text style={[styles.gridValue, { color: '#059669', fontSize: moderateScale(14) }]}>{selectedDrawing.status?.toUpperCase() || 'ACTIVE'}</Text>
                                    </View>
                                </View>

                                <View style={styles.actionRow}>
                                    <TouchableOpacity style={[styles.btnAlt, { height: verticalScale(56), borderRadius: moderateScale(18) }]} onPress={() => handleShare(selectedDrawing)}>
                                        <MaterialCommunityIcons name="share-variant" size={moderateScale(20)} color="#1E293B" />
                                        <Text style={[styles.btnAltText, { fontSize: moderateScale(15) }]}>Share</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnMain, { height: verticalScale(56), borderRadius: moderateScale(18) }]} onPress={() => { setModalVisible(false); Linking.openURL(getLatestFileUrl(selectedDrawing)); }}>
                                        <MaterialCommunityIcons name="eye" size={moderateScale(20)} color="#fff" />
                                        <Text style={[styles.btnMainText, { fontSize: moderateScale(15) }]}>Open Blueprint</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: 100, paddingHorizontal: SPACING.m },

    headerArea: { padding: SPACING.m, backgroundColor: COLORS.surface },
    titleInfo: { marginBottom: SPACING.md },
    mainTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.textPrimary },
    subTitle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },

    controlPanel: { paddingHorizontal: SPACING.m, marginBottom: SPACING.m },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: SIZES.radiusInput, height: 48, paddingHorizontal: SPACING.m, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
    searchInput: { flex: 1, marginLeft: 10, fontWeight: '700', color: COLORS.textPrimary, fontSize: moderateScale(14) },

    filtersRow: { flexDirection: 'row', gap: SPACING.sm },
    dropdown: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: SIZES.radiusInput, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
    dropdownLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, flex: 1 },

    tableHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: 10 },
    headCol: { ...TYPOGRAPHY.label, color: COLORS.textMuted },

    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceSecondary, paddingHorizontal: 4 },
    rowName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '800' },
    rowSubName: { ...TYPOGRAPHY.badge, color: COLORS.textMuted, marginTop: 1 },
    rowProject: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '700' },
    vBadge: { backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    vText: { ...TYPOGRAPHY.badge, color: COLORS.textSecondary },
    rowDate: { ...TYPOGRAPHY.badge, color: COLORS.textMuted },

    loadingInfo: { marginTop: 15, ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
    emptyContent: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyMainText: { marginTop: SPACING.m, ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
    emptySubText: { marginTop: 4, ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },

    selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
    selectorContent: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusModal, padding: SPACING.m, width: '100%', maxHeight: '70%' },
    selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    selectorTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.textPrimary },
    selectorItem: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: SIZES.radiusCard, marginBottom: 4 },
    selectorItemActive: { backgroundColor: '#EFF6FF' },
    selectorText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
    selectorTextActive: { color: '#2563EB', fontWeight: '900' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
    modalPanel: { backgroundColor: COLORS.card, borderTopLeftRadius: SIZES.radiusModal, borderTopRightRadius: SIZES.radiusModal, padding: SPACING.md, minHeight: '55%' },
    modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    modalHeaderTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.textPrimary },
    docBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, borderRadius: SIZES.radiusCard, padding: SPACING.sm, marginBottom: SPACING.md },
    pdfIconBox: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: SPACING.s, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
    bannerTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
    bannerMeta: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.m, marginBottom: SPACING.md },
    gridItem: { width: '46%' },
    gridLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 4 },
    gridValue: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    btnAlt: { flex: 1, height: 52, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusBtn, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.s },
    btnAltText: { ...TYPOGRAPHY.body, fontWeight: '900', color: COLORS.textPrimary },
    btnMain: { flex: 2, height: 52, backgroundColor: '#2563EB', borderRadius: SIZES.radiusBtn, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.s, ...SHADOWS.medium },
    btnMainText: { ...TYPOGRAPHY.body, fontWeight: '900', color: COLORS.white }
});

export default WorkerDrawingsScreen;
