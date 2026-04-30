import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    Image, Dimensions, ActivityIndicator, Alert, Modal, 
    TextInput, Platform, ScrollView, Animated, SafeAreaView,
    useWindowDimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api, { getServerUrl } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const WorkerPhotosScreen = () => {
    const { projects, user, selectedProject: globalSelectedProject } = useApp();
    const { width, height } = useWindowDimensions();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // Filtering
    const [activeFilter, setActiveFilter] = useState('All');
    const [filteredPhotos, setFilteredPhotos] = useState([]);

    // For Description/Upload Modal
    const [uploadModal, setUploadModal] = useState(false);
    const [previewModal, setPreviewModal] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    
    const [tempImage, setTempImage] = useState(null);
    const [description, setDescription] = useState('');
    const [targetProjectId, setTargetProjectId] = useState(null);
    const [selVisible, setSelVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const selectedTargetProjectLabel =
        projects.find((p) => (p._id || p.id) === targetProjectId)?.name || 'Select Project';

    const fetchPhotos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/photos');
            setPhotos(res.data || []);
            setFilteredPhotos(res.data || []);
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        } catch (e) {
            console.error('Fetch photos error:', e.response?.data || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPhotos();
        if (projects && projects.length > 0) {
            setTargetProjectId(projects[0]._id || projects[0].id);
        }
    }, [projects]);

    // Sync with global selection
    useEffect(() => {
        if (globalSelectedProject) {
            setActiveFilter(globalSelectedProject._id || globalSelectedProject.id);
            setTargetProjectId(globalSelectedProject._id || globalSelectedProject.id);
        } else {
            setActiveFilter('All');
            if (projects && projects.length > 0) {
                setTargetProjectId(projects[0]._id || projects[0].id);
            }
        }
    }, [globalSelectedProject, projects]);

    useEffect(() => {
        if (activeFilter === 'All') {
            setFilteredPhotos(photos);
        } else {
            setFilteredPhotos(photos.filter(p => (p.projectId?._id || p.projectId) === activeFilter));
        }
    }, [activeFilter, photos]);

    const handlePick = async (mode) => {
        try {
            const hasPermission = mode === 'camera' 
                ? (await ImagePicker.requestCameraPermissionsAsync()).status === 'granted'
                : (await ImagePicker.requestMediaLibraryPermissionsAsync()).status === 'granted';

            if (!hasPermission) {
                Alert.alert('Permission Denied', `${mode === 'camera' ? 'Camera' : 'Gallery'} permission is required.`);
                return;
            }

            const result = mode === 'camera' 
                ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
                : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });

            if (!result.canceled) {
                setTempImage(result.assets[0].uri);
                setUploadModal(true);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to acquire image');
        }
    };

    const uploadImage = async () => {
        if (!tempImage || !targetProjectId) {
            Alert.alert('Required', 'Please select a project and image');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('image', {
                uri: Platform.OS === 'android' ? tempImage : tempImage.replace('file://', ''),
                name: `site_photo_${Date.now()}.jpg`,
                type: 'image/jpeg'
            });
            formData.append('description', description || 'Site Progress Photo');
            formData.append('projectId', targetProjectId);

            const res = await api.post('/photos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPhotos(prev => [res.data, ...prev]);
            setUploadModal(false);
            setTempImage(null);
            setDescription('');
            Alert.alert('Success', 'Photo uploaded to site gallery.');
        } catch (error) {
            Alert.alert('Upload Failed', error.response?.data?.message || 'Server connection error');
        } finally {
            setUploading(false);
        }
    };

    const numColumns = isTablet ? 3 : (width < 380 ? 1 : 2);
    const cardWidth = (width - scale(isTablet ? 64 : 48)) / numColumns;

    const renderHeader = () => (
        <View style={[styles.headerTop, { padding: scale(20) }]}>
            <View style={[styles.subHeaderRow, { marginBottom: verticalScale(15) }]}>
                <View style={styles.titleSection}>
                    <Text style={[styles.headerTitle, { fontSize: moderateScale(24) }]}>Site Photos</Text>
                    <Text style={[styles.headerLabel, { fontSize: moderateScale(10), marginTop: verticalScale(2) }]}>PROJECT DOCUMENTATION</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.pageUploadBtn, { paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderRadius: moderateScale(12), gap: scale(8) }]} 
                    onPress={() => Alert.alert('Upload Media', 'Select source', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Camera', onPress: () => handlePick('camera') },
                        { text: 'Gallery', onPress: () => handlePick('library') },
                    ])}
                >
                    <MaterialCommunityIcons name="plus-circle" size={moderateScale(18)} color="#fff" />
                    <Text style={[styles.pageUploadBtnText, { fontSize: moderateScale(13) }]}>Upload New</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterBar, { paddingVertical: verticalScale(5) }]}>
                <TouchableOpacity 
                    style={[styles.filterChip, activeFilter === 'All' && styles.filterChipActive, { paddingHorizontal: scale(16), paddingVertical: verticalScale(8), borderRadius: moderateScale(20), marginRight: scale(8) }]}
                    onPress={() => setActiveFilter('All')}
                >
                    <Text style={[styles.filterText, activeFilter === 'All' && styles.filterTextActive, { fontSize: moderateScale(13) }]}>All Projects</Text>
                </TouchableOpacity>
                {projects.map(p => (
                    <TouchableOpacity 
                        key={p._id || p.id}
                        style={[styles.filterChip, activeFilter === (p._id || p.id) && styles.filterChipActive, { paddingHorizontal: scale(16), paddingVertical: verticalScale(8), borderRadius: moderateScale(20), marginRight: scale(8) }]}
                        onPress={() => setActiveFilter(p._id || p.id)}
                    >
                        <Text style={[styles.filterText, activeFilter === (p._id || p.id) && styles.filterTextActive, { fontSize: moderateScale(13) }]}>{p.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderPhoto = ({ item }) => (
        <TouchableOpacity 
            style={[styles.photoCard, { width: cardWidth, margin: scale(8), borderRadius: moderateScale(20) }]} 
            activeOpacity={0.9}
            onPress={() => { setSelectedPhoto(item); setPreviewModal(true); }}
        >
            <Image source={{ uri: getServerUrl(item.imageUrl) }} style={[styles.photoImg, { height: cardWidth }]} />
            <View style={[styles.photoOverlay, { top: verticalScale(10), left: scale(10) }]}>
                <View style={[styles.projectTag, { paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(6) }]}>
                    <Text style={[styles.projectTagText, { fontSize: moderateScale(9) }]} numberOfLines={1}>{item.projectId?.name || 'General'}</Text>
                </View>
            </View>
            <View style={[styles.photoInfo, { padding: moderateScale(12) }]}>
                <Text style={[styles.photoDesc, { fontSize: moderateScale(13) }]} numberOfLines={1}>{item.description || 'No description'}</Text>
                <Text style={[styles.photoDate, { fontSize: moderateScale(10), marginTop: verticalScale(4) }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <WorkerHeader 
                hideSearch={true} 
                title="Site Photos" 
            />
            
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={[styles.loadingText, { marginTop: verticalScale(15), fontSize: moderateScale(13) }]}>Synchronizing Media...</Text>
                </View>
            ) : (
                <FlatList
                    key={numColumns}
                    data={filteredPhotos}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderPhoto}
                    numColumns={numColumns}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={[styles.listContainer, { paddingBottom: verticalScale(100) }]}
                    columnWrapperStyle={numColumns > 1 ? styles.row : null}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="image-off-outline" size={moderateScale(60)} color="#E2E8F0" />
                            <Text style={[styles.emptyText, { fontSize: moderateScale(14), marginTop: verticalScale(12) }]}>No photos found for this site.</Text>
                        </View>
                    }
                />
            )}

            {/* UPLOAD MODAL */}
            <Modal visible={uploadModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderTopLeftRadius: moderateScale(35), borderTopRightRadius: moderateScale(35), padding: scale(25), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                        <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Upload to Site</Text>
                            <TouchableOpacity onPress={() => setUploadModal(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Image source={{ uri: tempImage }} style={[styles.previewThumb, { height: verticalScale(180), borderRadius: moderateScale(20), marginBottom: verticalScale(20) }]} />

                        <Text style={[styles.inputLabel, { fontSize: moderateScale(10), marginBottom: verticalScale(10) }]}>SELECT PROJECT</Text>
                        <TouchableOpacity
                            style={[styles.projectDropdown, { borderRadius: moderateScale(12), paddingHorizontal: scale(14), height: verticalScale(50), marginBottom: verticalScale(20) }]}
                            onPress={() => setSelVisible(true)}
                        >
                            <View style={styles.projectDropdownLeft}>
                                <MaterialCommunityIcons name="office-building" size={moderateScale(14)} color="#64748B" />
                                <Text style={[styles.projectDropdownText, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                                    {selectedTargetProjectLabel}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-down" size={moderateScale(16)} color="#64748B" />
                        </TouchableOpacity>

                        <Text style={[styles.inputLabel, { fontSize: moderateScale(10), marginBottom: verticalScale(10) }]}>DESCRIPTION / NOTES</Text>
                        <TextInput 
                            style={[styles.input, { borderRadius: moderateScale(16), padding: scale(15), fontSize: moderateScale(15), height: verticalScale(100), marginBottom: verticalScale(20) }]}
                            placeholder="Add site context..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                        />

                        <TouchableOpacity 
                            style={[styles.mainUploadBtn, uploading && { opacity: 0.7 }, { paddingVertical: verticalScale(18), borderRadius: moderateScale(18) }]}
                            onPress={uploadImage}
                            disabled={uploading}
                        >
                            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.mainUploadBtnText, { fontSize: moderateScale(16) }]}>CONFIRM UPLOAD</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* PROJECT SELECTOR MODAL */}
            <Modal visible={selVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.selOverlayModal} activeOpacity={1} onPress={() => setSelVisible(false)}>
                    <View style={[styles.selBox, { width: isTablet ? 420 : '86%', borderRadius: moderateScale(24), padding: scale(20) }]}>
                        <Text style={[styles.selTitle, { fontSize: moderateScale(13), marginBottom: verticalScale(12) }]}>SELECT PROJECT</Text>
                        <ScrollView style={{ maxHeight: verticalScale(300) }}>
                            {projects.map((p) => {
                                const pid = p._id || p.id;
                                const selected = targetProjectId === pid;
                                return (
                                    <TouchableOpacity
                                        key={pid}
                                        style={[styles.selItem, selected && styles.selItemActive, { paddingVertical: verticalScale(12) }]}
                                        onPress={() => {
                                            setTargetProjectId(pid);
                                            setSelVisible(false);
                                        }}
                                    >
                                        <MaterialCommunityIcons name="office-building" size={moderateScale(17)} color={selected ? '#2563EB' : '#94A3B8'} style={{ marginRight: scale(12) }} />
                                        <Text style={[styles.selLabelText, selected && styles.selLabelTextActive, { fontSize: moderateScale(13) }]}>{p.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* PREVIEW MODAL */}
            <Modal visible={previewModal} transparent animationType="fade">
                <View style={styles.fullPreviewOverlay}>
                    <TouchableOpacity style={[styles.closeFull, { top: verticalScale(50), right: scale(20) }]} onPress={() => setPreviewModal(false)}>
                        <MaterialCommunityIcons name="close" size={moderateScale(30)} color="#fff" />
                    </TouchableOpacity>
                    {selectedPhoto && (
                        <View style={styles.fullContent}>
                            <Image source={{ uri: getServerUrl(selectedPhoto.imageUrl) }} style={styles.fullImage} resizeMode="contain" />
                            <View style={[styles.fullFooter, { bottom: verticalScale(40), left: scale(20), right: scale(20), padding: scale(20), borderRadius: moderateScale(20) }]}>
                                <Text style={[styles.fullProjName, { fontSize: moderateScale(12) }]}>{selectedPhoto.projectId?.name || 'General Site'}</Text>
                                <Text style={[styles.fullDesc, { fontSize: moderateScale(18), marginTop: verticalScale(5) }]}>{selectedPhoto.description}</Text>
                                <Text style={[styles.fullMeta, { fontSize: moderateScale(11), marginTop: verticalScale(10) }]}>Uploaded by {selectedPhoto.uploadedBy?.fullName || 'Worker'} on {new Date(selectedPhoto.createdAt).toLocaleDateString()}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { },
    headerTop: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    headerLabel: { fontWeight: '900', color: '#2563EB', letterSpacing: 1.5 },
    filterBar: { },
    filterChip: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    filterText: { fontWeight: '700', color: '#64748B' },
    filterTextActive: { color: '#fff' },
    row: { justifyContent: 'space-between', paddingHorizontal: 16 },
    subHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titleSection: { flex: 1 },
    pageUploadBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', ...SHADOWS.small },
    pageUploadBtnText: { color: '#fff', fontWeight: '900' },
    photoCard: { backgroundColor: '#fff', overflow: 'hidden', ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
    photoImg: { width: '100%', backgroundColor: '#F1F5F9' },
    photoOverlay: { position: 'absolute' },
    projectTag: { backgroundColor: 'rgba(15, 23, 42, 0.7)' },
    projectTagText: { color: '#fff', fontWeight: '800' },
    photoInfo: { },
    photoDesc: { fontWeight: '800', color: '#1E293B' },
    photoDate: { fontWeight: '700', color: '#94A3B8' },
    loadingText: { fontWeight: '700', color: '#64748B' },
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyText: { fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', minHeight: '60%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    previewThumb: { width: '100%' },
    inputLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
    projectDropdown: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    projectDropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    projectDropdownText: { fontWeight: '800', color: '#1E293B', flex: 1 },
    projChip: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    projChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    projChipText: { fontWeight: '700', color: '#64748B' },
    projChipActiveText: { color: '#2563EB' },
    selOverlayModal: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
    selBox: { backgroundColor: '#fff' },
    selTitle: { fontWeight: '900', color: '#0F172A', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.2 },
    selItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    selItemActive: { backgroundColor: '#EFF6FF' },
    selLabelText: { fontWeight: '700', color: '#334155' },
    selLabelTextActive: { color: '#2563EB' },
    input: { backgroundColor: '#F8FAFC', color: '#0F172A', textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 5 },
    mainUploadBtn: { backgroundColor: '#2563EB', alignItems: 'center', ...SHADOWS.small },
    mainUploadBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
    fullPreviewOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
    closeFull: { position: 'absolute', zIndex: 100 },
    fullContent: { flex: 1, justifyContent: 'center' },
    fullImage: { width: '100%', height: '70%' },
    fullFooter: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)' },
    fullProjName: { fontWeight: '900', color: '#2563EB', textTransform: 'uppercase' },
    fullDesc: { fontWeight: '800', color: '#fff' },
    fullMeta: { fontWeight: '700', color: '#94A3B8' }
});

export default WorkerPhotosScreen;
