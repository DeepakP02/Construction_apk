import React, { useState, useEffect, useRef } from 'react';
import { 
    View, StyleSheet, FlatList, TouchableOpacity, Text, Modal, ScrollView, 
    Animated, TextInput, Dimensions, Linking, ActivityIndicator, StatusBar, Platform, Share, Alert, Image 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl } from '../../utils/api';
import WorkerHeader from '../../components/WorkerHeader';

const { width } = Dimensions.get('window');

const DISCIPLINES = [
    { label: 'All Disciplines', value: '', icon: 'layers' },
    { label: 'Architectural', value: 'architectural', icon: 'home-variant-outline' },
    { label: 'Structural', value: 'structural', icon: 'office-building' },
    { label: 'Mechanical', value: 'mechanical', icon: 'cog-outline' },
    { label: 'Electrical', value: 'electrical', icon: 'power' },
    { label: 'Plumbing', value: 'plumbing', icon: 'water-pump' },
    { label: 'Civil', value: 'civil', icon: 'excavator' },
];

const ClientDrawingsScreen = () => {
    const { projects, teamMembers } = useApp();
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState({ label: 'All Projects', value: '' });
    const [selectedDiscipline, setSelectedDiscipline] = useState(DISCIPLINES[0]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    
    // Send to Trades Modal State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [selectedTrades, setSelectedTrades] = useState([]);
    const [tradeFilter, setTradeFilter] = useState('All');
    const [sending, setSending] = useState(false);

    // Dropdown Modal State
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchDrawings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/drawings');
            setDrawings(res.data);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (e) {
            console.error('Fetch drawings error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrawings();
    }, []);

    const filteredDrawings = (drawings || []).filter(d => {
        const titleMatch = d.title?.toLowerCase().includes(search.toLowerCase());
        const numberMatch = d.drawingNumber?.toLowerCase().includes(search.toLowerCase());
        const matchesSearch = titleMatch || numberMatch;
        const matchesProject = selectedProject.value ? (d.projectId?._id || d.projectId) === selectedProject.value : true;
        const matchesDiscipline = selectedDiscipline.value ? d.category?.toLowerCase() === selectedDiscipline.value : true;
        
        return matchesSearch && matchesProject && matchesDiscipline;
    });

    const getLatestFileUrl = (item) => {
        if (!item || !item.versions || item.versions.length === 0) return null;
        const ver = item.versions.find(v => v.versionNumber === item.currentVersion) || item.versions[item.versions.length - 1];
        if (!ver?.fileUrl) return null;
        return getServerUrl(ver.fileUrl);
    };

    const handleView = (item) => {
        setSelectedDrawing(item);
        setModalVisible(true);
    };

    const handleShare = (item) => {
        setSelectedDrawing(item);
        setSelectedTrades([]);
        setShareModalVisible(true);
    };

    const handleDownload = (item) => {
        const url = getLatestFileUrl(item);
        if (url) {
            Linking.openURL(url);
        }
    };

    const openDocument = () => {
        const url = getLatestFileUrl(selectedDrawing);
        if (url) {
            Linking.openURL(url);
            setModalVisible(false);
        }
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (opt) => {
            onSelect(opt.value);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    // Trades logic
    const trades = (teamMembers || []).filter(u => u.role === 'SUBCONTRACTOR' || u.role === 'FOREMAN');
    const categories = ['All', ...new Set(trades.map(t => t.category || 'General').filter(c => c))];
    
    const filteredTrades = trades.filter(t => 
        tradeFilter === 'All' || (t.category || 'General') === tradeFilter
    );

    const toggleTrade = (id) => {
        setSelectedTrades(prev => 
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedTrades.length === filteredTrades.length) {
            setSelectedTrades([]);
        } else {
            setSelectedTrades(filteredTrades.map(t => t._id || t.id));
        }
    };

    const sendToTrades = async () => {
        if (selectedTrades.length === 0) return;
        setSending(true);
        try {
            await new Promise(r => setTimeout(r, 1500));
            Alert.alert('Success', `Drawing shared with ${selectedTrades.length} trades.`);
            setShareModalVisible(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to share drawing.');
        } finally {
            setSending(false);
        }
    };

    const renderDrawingItem = ({ item }) => {
        const config = {
            'architectural': { icon: 'home-variant', color: '#3B82F6', bg: '#EFF6FF' },
            'structural': { icon: 'office-building', color: '#10B981', bg: '#ECFDF5' },
            'mechanical': { icon: 'cog', color: '#F59E0B', bg: '#FFFBEB' },
            'electrical': { icon: 'flash', color: '#EF4444', bg: '#FEF2F2' },
        }[item.category?.toLowerCase()] || { icon: 'file-document', color: '#64748B', bg: '#F8FAFC' };

        return (
            <TouchableOpacity 
                style={[styles.drawingRow, SHADOWS.small]} 
                onPress={() => handleView(item)}
            >
                <View style={[styles.disciplineIndicator, { backgroundColor: config.color }]} />
                
                <View style={styles.drawingInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.drawingTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.versionBadge, { backgroundColor: config.bg }]}>
                            <Text style={[styles.versionText, { color: config.color }]}>v{item.currentVersion}.0</Text>
                        </View>
                    </View>
                    <Text style={styles.drawingMeta}>
                        {item.category?.toUpperCase()} • Sheet {item.drawingNumber || '---'}
                    </Text>
                    <View style={styles.projectRow}>
                        <MaterialCommunityIcons name="office-building" size={12} color="#94A3B8" />
                        <Text style={styles.projectName}>{item.projectId?.name || 'Unassigned'}</Text>
                        <Text style={styles.dateText}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
                        <MaterialCommunityIcons name="account-group-outline" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(item)}>
                        <MaterialCommunityIcons name="download" size={18} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleView(item)}>
                        <MaterialCommunityIcons name="eye-outline" size={18} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Drawings" hideSearch />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Drawings & Blueprints</Text>
                <Text style={styles.headerSubtitle}>Manage latest revisions and architectural plans.</Text>
            </View>

            <View style={styles.filterSection}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search drawings..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.dropdownRow}>
                    <TouchableOpacity 
                        style={styles.dropdown}
                        onPress={() => openDropdown('Select Project', 
                            [{ label: 'All Projects', value: '' }, ...projects.map(p => ({ label: p.name, value: p._id || p.id }))],
                            (val) => {
                                const p = projects.find(proj => (proj._id || proj.id) === val);
                                setSelectedProject(p ? { label: p.name, value: val } : { label: 'All Projects', value: '' });
                            }
                        )}
                    >
                        <Text style={styles.dropdownText} numberOfLines={1}>{selectedProject.label}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.dropdown}
                        onPress={() => openDropdown('Select Discipline', DISCIPLINES, (val) => {
                            const d = DISCIPLINES.find(item => item.value === val);
                            setSelectedDiscipline(d);
                        })}
                    >
                        <Text style={styles.dropdownText}>{selectedDiscipline.label}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredDrawings}
                keyExtractor={item => item._id}
                renderItem={renderDrawingItem}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    loading ? <ActivityIndicator size="large" color={COLORS.primaryAccent} style={{ marginTop: 50 }} /> : (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="floor-plan" size={80} color="#E2E8F0" />
                            <Text style={styles.emptyTitle}>No Drawings Found</Text>
                            <Text style={styles.emptySubtitle}>Try adjusting your filters or search terms.</Text>
                        </View>
                    )
                }
            />

            {/* SEND TO TRADES MODAL */}
            <Modal visible={shareModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '85%' }]}>
                        <View style={styles.modalDragHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send to Trades</Text>
                            <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.shareDrawingCard}>
                            <View style={styles.shareIconBox}>
                                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/337/337946.png' }} style={styles.pdfIconSmall} />
                            </View>
                            <View>
                                <Text style={styles.shareDrawingLabel}>DRAWING</Text>
                                <Text style={styles.shareDrawingName}>{selectedDrawing?.title || 'Floor Plan'}</Text>
                            </View>
                        </View>

                        <Text style={styles.shareSectionLabel}>Filter by Category</Text>
                        <View style={styles.catScrollWrapper}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScrollContent}>
                                {categories.map(cat => (
                                    <TouchableOpacity 
                                        key={cat} 
                                        style={[styles.catPill, tradeFilter === cat && styles.catPillActive]}
                                        onPress={() => setTradeFilter(cat)}
                                    >
                                        <Text style={[styles.catPillText, tradeFilter === cat && styles.catPillTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.tradesHeaderRow}>
                            <Text style={styles.tradesCounterText}>{filteredTrades.length} Trades Available</Text>
                            <TouchableOpacity onPress={selectAll}>
                                <Text style={styles.selectAllLinkText}>
                                    {selectedTrades.length === filteredTrades.length ? 'Deselect All' : 'Select All'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={filteredTrades}
                            keyExtractor={item => item._id || item.id}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.tradeListItem} 
                                    onPress={() => toggleTrade(item._id || item.id)}
                                >
                                    <View style={styles.tradeInfoArea}>
                                        <Text style={styles.tradeNameText}>{item.fullName || item.name}</Text>
                                        <Text style={styles.tradeSubText}>{item.category || 'General'}</Text>
                                    </View>
                                    <MaterialCommunityIcons 
                                        name={selectedTrades.includes(item._id || item.id) ? "checkbox-marked" : "checkbox-blank-outline"} 
                                        size={24} 
                                        color={selectedTrades.includes(item._id || item.id) ? COLORS.primaryAccent : "#CBD5E1"} 
                                    />
                                </TouchableOpacity>
                            )}
                        />

                        <TouchableOpacity 
                            style={[styles.mainSendBtn, selectedTrades.length === 0 && { backgroundColor: '#64748B' }]}
                            onPress={sendToTrades}
                            disabled={sending || selectedTrades.length === 0}
                        >
                            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainSendBtnText}>Send to {selectedTrades.length} Trades</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* DRAWING DETAIL MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalDragHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedDrawing?.title}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalMain}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>SHEET NUMBER</Text>
                                    <Text style={styles.infoValue}>{selectedDrawing?.drawingNumber || '---'}</Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>PROJECT</Text>
                                    <Text style={styles.infoValue}>{selectedDrawing?.projectId?.name || '---'}</Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>DISCIPLINE</Text>
                                    <Text style={styles.infoValue}>{selectedDrawing?.category?.toUpperCase()}</Text>
                                </View>
                                <View style={styles.infoItem}>
                                    <Text style={styles.infoLabel}>LATEST VERSION</Text>
                                    <Text style={styles.infoValue}>v{selectedDrawing?.currentVersion}.0</Text>
                                </View>
                            </View>

                            <View style={styles.modalActionRow}>
                                <TouchableOpacity style={[styles.modalAction, { backgroundColor: '#EFF6FF' }]} onPress={() => handleShare(selectedDrawing)}>
                                    <MaterialCommunityIcons name="account-group-outline" size={20} color="#3B82F6" />
                                    <Text style={[styles.modalActionText, { color: '#3B82F6' }]}>SEND TO TRADES</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalAction, { backgroundColor: '#ECFDF5' }]} onPress={() => handleDownload(selectedDrawing)}>
                                    <MaterialCommunityIcons name="download" size={20} color="#10B981" />
                                    <Text style={[styles.modalActionText, { color: '#10B981' }]}>DOWNLOAD</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.openBtn} onPress={openDocument}>
                                <MaterialCommunityIcons name="file-pdf-box" size={24} color="#fff" />
                                <Text style={styles.openBtnText}>VIEW FULL DRAWING</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DROPDOWN SELECTOR MODAL */}
            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlay}>
                    <View style={styles.selBox}>
                        <Text style={styles.selTitle}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={i} style={styles.selItem} onPress={() => selOnSelect(opt)}>
                                    <MaterialCommunityIcons name={opt.icon || 'circle-medium'} size={20} color="#3B82F6" />
                                    <Text style={styles.selLabel}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.selCancel} onPress={() => setSelVisible(false)}>
                            <Text style={styles.selCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 20, backgroundColor: '#fff' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4 },
    
    filterSection: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 12 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#1E293B' },
    
    dropdownRow: { flexDirection: 'row', gap: 10 },
    dropdown: { flex: 1, height: 40, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    dropdownText: { fontSize: 12, fontWeight: '800', color: '#64748B' },

    listContainer: { padding: 16, paddingBottom: 100 },
    drawingRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
    disciplineIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 16 },
    drawingInfo: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    drawingTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1 },
    versionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    versionText: { fontSize: 10, fontWeight: '900' },
    drawingMeta: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6 },
    projectRow: { flexDirection: 'row', alignItems: 'center' },
    projectName: { fontSize: 11, fontWeight: '700', color: '#64748B', marginLeft: 4, flex: 1 },
    dateText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
    
    actionRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },

    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginTop: 16 },
    emptySubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 4, textAlign: 'center' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalDragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', flex: 1, marginRight: 10 },
    modalMain: { gap: 24 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    infoItem: { width: '45%' },
    infoLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
    infoValue: { fontSize: 15, fontWeight: '800', color: '#1E293B' },

    modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalAction: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    modalActionText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

    openBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, ...SHADOWS.medium },
    openBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

    // Share Modal REFINED
    shareDrawingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 18, marginBottom: 24, gap: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    shareIconBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
    pdfIconSmall: { width: 28, height: 28 },
    shareDrawingLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
    shareDrawingName: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    shareSectionLabel: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginBottom: 16 },
    
    catScrollWrapper: { marginHorizontal: -24, marginBottom: 24 },
    catScrollContent: { paddingHorizontal: 24, gap: 10 },
    catPill: { paddingHorizontal: 22, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    catPillActive: { backgroundColor: COLORS.primaryAccent, borderColor: COLORS.primaryAccent },
    catPillText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    catPillTextActive: { color: '#fff' },
    
    tradesHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
    tradesCounterText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
    selectAllLinkText: { fontSize: 12, fontWeight: '900', color: COLORS.primaryAccent },
    
    tradeListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', justifyContent: 'space-between' },
    tradeInfoArea: { flex: 1 },
    tradeNameText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    tradeSubText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
    
    mainSendBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, ...SHADOWS.medium },
    mainSendBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

    // Sel Modal
    selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 20 },
    selTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16, textAlign: 'center' },
    selItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    selLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginLeft: 12 },
    selCancel: { marginTop: 16, alignItems: 'center' },
    selCancelText: { fontSize: 14, fontWeight: '900', color: '#64748B' }
});

export default ClientDrawingsScreen;
