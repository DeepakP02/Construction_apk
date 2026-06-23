import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Animated, ActivityIndicator, Dimensions, 
    ScrollView, Share, Linking, Modal, Pressable, Alert, SafeAreaView, StatusBar, useWindowDimensions 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api, { getServerUrl } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

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
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: 100 },

    headerArea: { padding: 20, backgroundColor: '#FFFFFF' },
    titleInfo: { marginBottom: 25 },
    mainTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    subTitle: { fontWeight: '600', color: '#64748B', marginTop: 4 },

    controlPanel: { marginBottom: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
    searchInput: { flex: 1, marginLeft: 10, fontWeight: '700', color: '#1E293B' },

    filtersRow: { flexDirection: 'row', gap: 12 },
    dropdown: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    dropdownLabel: { fontWeight: '800', color: '#475569', flex: 1 },

    tableHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginTop: 10 },
    headCol: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },

    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingHorizontal: 4 },
    rowName: { fontWeight: '900', color: '#0F172A' },
    rowSubName: { fontWeight: '700', color: '#94A3B8', marginTop: 1 },
    rowProject: { fontWeight: '800', color: '#444' },
    vBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    vText: { fontWeight: '900', color: '#64748B' },
    rowDate: { fontWeight: '700', color: '#94A3B8' },

    loadingInfo: { marginTop: 15, fontWeight: '700', color: '#64748B' },
    emptyContent: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyMainText: { marginTop: 16, fontWeight: '900', color: '#1E293B' },
    emptySubText: { marginTop: 4, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },

    selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    selectorContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '100%', maxHeight: '70%' },
    selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selectorTitle: { fontWeight: '900', color: '#0F172A' },
    selectorItem: { paddingVertical: 15, paddingHorizontal: 15, borderRadius: 12, marginBottom: 5 },
    selectorItemActive: { backgroundColor: '#EFF6FF' },
    selectorText: { fontWeight: '700', color: '#475569' },
    selectorTextActive: { color: '#2563EB', fontWeight: '900' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end',  },
    modalPanel: { backgroundColor: '#fff', padding: 25, minHeight: '55%' },
    modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalHeaderTitle: { fontWeight: '900', color: '#0F172A' },
    docBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', marginBottom: 25 },
    pdfIconBox: { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
    bannerTitle: { fontWeight: '900', color: '#1E293B' },
    bannerMeta: { fontWeight: '700', color: '#94A3B8', marginTop: 4 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 35 },
    gridItem: { width: '46%' },
    gridLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 4 },
    gridValue: { fontWeight: '800', color: '#1E293B' },
    actionRow: { flexDirection: 'row', gap: 15 },
    btnAlt: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    btnAltText: { fontWeight: '900', color: '#1E293B' },
    btnMain: { flex: 2, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...SHADOWS.small },
    btnMainText: { fontWeight: '900', color: '#fff' }
});

export default WorkerDrawingsScreen;
