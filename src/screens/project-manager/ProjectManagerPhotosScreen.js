import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, ActivityIndicator, Alert, Modal, TextInput, StatusBar, ScrollView, Platform, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api, { getServerUrl } from '../../utils/api';
import { enrichPhotoWithProject } from '../../utils/enrichPhotoWithProject';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

/** Compare project ids reliably (Mongo ObjectId vs string from API/state). */
function idKey(raw) {
    if (raw == null || raw === '') return '';
    return String(raw);
}
function projectIdFromDoc(p) {
    if (!p) return '';
    return idKey(p._id ?? p.id);
}

const ProjectManagerPhotosScreen = () => {
    const { projects, selectedProject: globalSelectedProject } = useApp();
    const { width, height } = useWindowDimensions();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('all');

    // For Upload Modal
    const [uploadModal, setUploadModal] = useState(false);
    const [tempImage, setTempImage] = useState(null);
    const [externalUrl, setExternalUrl] = useState('');
    const [description, setDescription] = useState('');
    const [uploadProjectId, setUploadProjectId] = useState('none');
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Custom Selector State
    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});

    const selectedProjectLabel =
        selectedProjectId === 'all'
            ? 'All Projects'
            : projects.find((p) => projectIdFromDoc(p) === idKey(selectedProjectId))?.name || 'Select Project';

    const uploadTargetLabel =
        uploadProjectId === 'none'
            ? null
            : projects.find((p) => projectIdFromDoc(p) === idKey(uploadProjectId))?.name;

    const fetchPhotos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/photos');
            const list = res.data || [];
            setPhotos(list.map((p) => enrichPhotoWithProject(p, projects)));
        } catch (e) {
            console.error('Fetch photos error:', e.response?.data || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPhotos();
    }, [projects]);

    // Sync with global selection
    useEffect(() => {
        if (globalSelectedProject) {
            setSelectedProjectId(idKey(globalSelectedProject._id || globalSelectedProject.id));
        } else {
            setSelectedProjectId('all');
        }
    }, [globalSelectedProject]);

    const filteredPhotos = (photos || []).filter(p => {
        const matchesProject =
            selectedProjectId === 'all' ||
            idKey(p.projectId?._id || p.projectId) === idKey(selectedProjectId);
        const matchesSearch = (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (p.projectId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesProject && matchesSearch;
    });

    const getPhotoCount = (pid) => {
        if (pid === 'all') return photos.length;
        return photos.filter((p) => idKey(p.projectId?._id || p.projectId) === idKey(pid)).length;
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Gallery permission is required!');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setTempImage(result.assets[0].uri);
                setExternalUrl(''); // reset external url if local file selected
            }
        } catch (error) {
            console.error('Gallery error:', error);
            Alert.alert('Error', 'There was an issue opening the gallery.');
        }
    };

    const uploadImage = async () => {
        if (!tempImage && !externalUrl) {
            Alert.alert('Required', 'Please select a file or provide an Image URL.');
            return;
        }

        const note = description || 'Site Progress Photo';

        try {
            setUploading(true);
            
            const formData = new FormData();
            if (tempImage) {
                formData.append('image', {
                    uri: Platform.OS === 'android' ? tempImage : tempImage.replace('file://', ''),
                    name: tempImage.split('/').pop() || 'photo.jpg',
                    type: 'image/jpeg'
                });
            } else if (externalUrl) {
                formData.append('imageUrl', externalUrl);
            }

            formData.append('description', note);
            if (uploadProjectId !== 'none') {
                formData.append('projectId', idKey(uploadProjectId));
            }

            const res = await api.post('/photos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPhotos((prev) => [enrichPhotoWithProject(res.data, projects), ...prev]);
            Alert.alert('Success', 'Photo uploaded successfully!');
            setUploadModal(false);
        } catch (error) {
            Alert.alert('Upload Failed', 'Check connection or retry');
        } finally {
            setUploading(false);
            setTempImage(null);
            setExternalUrl('');
            setDescription('');
            setUploadProjectId('none');
        }
    };

    const handleExternalUrlChange = (text) => {
        setExternalUrl(text);
        if (text) setTempImage(null); // clear local file if url typed
    };

    const openUploadModal = () => {
        setTempImage(null);
        setExternalUrl('');
        setDescription('');
        if (selectedProjectId !== 'all') {
            setUploadProjectId(idKey(selectedProjectId));
        } else {
            setUploadProjectId('none');
        }
        setUploadModal(true);
    };

    const confirmDeletePhoto = (item) => {
        const id = item._id || item.id;
        if (!id) return;
        const label = item.description || item.projectId?.name || 'this photo';
        Alert.alert(
            'Delete photo',
            `Remove "${label.length > 60 ? `${label.slice(0, 60)}…` : label}" from the gallery?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingId(id);
                            await api.delete(`/photos/${id}`);
                            setPhotos((prev) => prev.filter((p) => (p._id || p.id) !== id));
                        } catch (e) {
                            Alert.alert('Error', e.response?.data?.message || 'Could not delete photo.');
                        } finally {
                            setDeletingId(null);
                        }
                    }
                }
            ]
        );
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title);
        setSelOptions(options);
        setSelOnSelect(() => (val) => {
            onSelect(val);
            setSelVisible(false);
        });
        setSelVisible(true);
    };

    const numColumns = isTablet ? 3 : (width < 380 ? 1 : 2);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Photos" />

            <View style={[styles.pageHeader, { paddingHorizontal: scale(20), paddingTop: verticalScale(16) }]}>
                <Text style={[styles.pageTitle, { fontSize: moderateScale(24) }]}>Site Photos</Text>
                <Text style={[styles.pageSubtitle, { fontSize: moderateScale(13) }]}>Centralized gallery for all project documentation.</Text>

                <View style={[styles.actionRow, { gap: scale(10) }]}>
                    <TouchableOpacity 
                        style={[styles.customDropdownBtn, { height: verticalScale(40), borderRadius: moderateScale(10), paddingHorizontal: scale(12) }]}
                        onPress={() => openDropdown(
                            'Filter By Project',
                            [
                                { label: 'All Projects', value: 'all', icon: 'layers' },
                                ...projects.map((p) => ({
                                    label: p.name,
                                    value: projectIdFromDoc(p),
                                    icon: 'office-building'
                                }))
                            ],
                            (opt) => setSelectedProjectId(opt.value === 'all' ? 'all' : idKey(opt.value))
                        )}
                    >
                        <View style={styles.dropdownLeft}>
                            <MaterialCommunityIcons name="filter-variant" size={moderateScale(14)} color="#64748B" />
                            <Text style={[styles.dropdownValueText, { fontSize: moderateScale(12) }]}>{selectedProjectLabel}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(14)} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.uploadBtnNew, { height: verticalScale(40), borderRadius: moderateScale(10), paddingHorizontal: scale(16), gap: scale(6) }]} onPress={openUploadModal}>
                        <MaterialCommunityIcons name="plus" size={moderateScale(16)} color="#fff" />
                        <Text style={[styles.uploadBtnText, { fontSize: moderateScale(13) }]}>Upload New</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? <ActivityIndicator style={{ marginTop: verticalScale(40) }} color={COLORS.primary} size="large" /> : (
                <FlatList
                    key={numColumns}
                    data={filteredPhotos}
                    numColumns={numColumns}
                    keyExtractor={(item) => item._id || item.id}
                    contentContainerStyle={[styles.list, { paddingHorizontal: scale(12), paddingBottom: verticalScale(120) }]}
                    showsVerticalScrollIndicator={false}
                    refreshing={loading}
                    onRefresh={fetchPhotos}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="image-multiple-outline" size={moderateScale(64)} color="#CBD5E1" />
                            <Text style={[styles.emptyText, { fontSize: moderateScale(15) }]}>No photos found in this gallery.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[styles.photoCardWrapper, { width: `${100 / numColumns}%`, padding: scale(6) }]}>
                            <View style={[styles.photoCard, SHADOWS.small, { borderRadius: moderateScale(20) }]}>
                                <View style={[styles.imageContainer, { height: verticalScale(150) }]}>
                                    <Image
                                        source={{ uri: getServerUrl(item.imageUrl) || item.imageUrl }}
                                        style={styles.photoImg}
                                        resizeMode="cover"
                                    />
                                    <View style={[styles.photoOverlay, { top: verticalScale(8), left: scale(8), right: scale(8) }]}>
                                        <View style={[styles.photoBadge, { paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(6) }]}>
                                            <Text style={[styles.photoBadgeText, { fontSize: moderateScale(8) }]} numberOfLines={1}>
                                                {item.projectId?.name || 'General'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={[styles.photoFooter, { padding: moderateScale(12) }]}>
                                    <View style={[styles.photoTitleRow, { gap: scale(8), marginBottom: verticalScale(6) }]}>
                                        <Text style={[styles.photoDesc, { fontSize: moderateScale(13) }]} numberOfLines={1}>{item.description || 'Verified Site Update'}</Text>
                                        <TouchableOpacity
                                            style={styles.deleteIconBtn}
                                            onPress={() => confirmDeletePhoto(item)}
                                            disabled={deletingId === (item._id || item.id)}
                                            accessibilityLabel="Delete photo"
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            {deletingId === (item._id || item.id) ? (
                                                <ActivityIndicator size="small" color="#DC2626" />
                                            ) : (
                                                <MaterialCommunityIcons name="trash-can-outline" size={moderateScale(18)} color="#DC2626" />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.metaRow, { gap: scale(4) }]}>
                                        <MaterialCommunityIcons name="calendar" size={moderateScale(10)} color="#94A3B8" />
                                        <Text style={[styles.metaText, { fontSize: moderateScale(10) }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}

            <Modal visible={uploadModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalScroll, { borderRadius: moderateScale(24), maxWidth: 600, alignSelf: 'center' }]}>
                        <View style={[styles.modalHeaderRow, { padding: scale(24) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Upload Photo</Text>
                            <TouchableOpacity onPress={() => !uploading && setUploadModal(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
                            <View style={[styles.modalBody, { paddingHorizontal: scale(24), paddingVertical: verticalScale(20) }]}>
                                <TouchableOpacity style={[styles.dropZone, { height: verticalScale(250), borderRadius: moderateScale(20), marginBottom: verticalScale(20) }]} onPress={pickImage} disabled={uploading}>
                                    {tempImage ? (
                                        <Image source={{ uri: tempImage }} style={styles.previewImage} resizeMode="cover" />
                                    ) : (
                                        <View style={[styles.dropZoneContent, { padding: scale(20) }]}>
                                            <MaterialCommunityIcons name="cloud-upload" size={moderateScale(40)} color="#94A3B8" />
                                            <Text style={[styles.dropZoneTitle, { fontSize: moderateScale(15), marginTop: verticalScale(12) }]}>No file chosen</Text>
                                            <Text style={[styles.dropZoneSubtitle, { fontSize: moderateScale(13), marginTop: verticalScale(4) }]}>Click to upload or drag and drop</Text>
                                            <Text style={[styles.dropZoneMeta, { fontSize: moderateScale(11), marginTop: verticalScale(8) }]}>SVG, PNG, JPG or GIF (max. 5MB)</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <Text style={[styles.fieldLabel, { fontSize: moderateScale(11), marginBottom: verticalScale(8) }]}>Or Image URL (External)</Text>
                                <TextInput
                                    style={[styles.inputField, { height: verticalScale(44), borderRadius: moderateScale(12), paddingHorizontal: scale(16), fontSize: moderateScale(14), marginBottom: verticalScale(20) }]}
                                    placeholder="https://images.unsplash.com/..."
                                    placeholderTextColor="#94A3B8"
                                    value={externalUrl}
                                    onChangeText={handleExternalUrlChange}
                                    autoCapitalize="none"
                                />

                                <Text style={[styles.fieldLabel, { fontSize: moderateScale(11), marginBottom: verticalScale(8) }]}>Description</Text>
                                <TextInput
                                    style={[styles.inputField, { height: verticalScale(44), borderRadius: moderateScale(12), paddingHorizontal: scale(16), fontSize: moderateScale(14), marginBottom: verticalScale(20) }]}
                                    placeholder="e.g. Site Visit Day 1"
                                    placeholderTextColor="#94A3B8"
                                    value={description}
                                    onChangeText={setDescription}
                                />

                                <Text style={[styles.fieldLabel, { fontSize: moderateScale(11), marginBottom: verticalScale(8) }]}>Project</Text>
                                <View style={[styles.uploadProjectSummary, { borderRadius: moderateScale(12), paddingHorizontal: scale(12), paddingVertical: verticalScale(10), marginBottom: verticalScale(12) }]}>
                                    <MaterialCommunityIcons name="link-variant" size={moderateScale(16)} color="#2563EB" />
                                    <Text style={[styles.uploadProjectSummaryText, { fontSize: moderateScale(13) }]} numberOfLines={2}>
                                        {uploadProjectId === 'none'
                                            ? 'Not linked — photo is company-wide until you pick a project below.'
                                            : `Will save under: ${uploadTargetLabel || 'project'}`}
                                    </Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.projectScroll, { marginBottom: verticalScale(24) }]}>
                                    <TouchableOpacity
                                        style={[styles.projectItem, uploadProjectId === 'none' && styles.projectItemActive, { paddingHorizontal: scale(16), paddingVertical: verticalScale(10), borderRadius: moderateScale(12), marginRight: scale(8) }]}
                                        onPress={() => setUploadProjectId('none')}
                                    >
                                        <Text style={[styles.projectItemText, uploadProjectId === 'none' && styles.projectItemTextActive, { fontSize: moderateScale(13) }]}>General / None</Text>
                                    </TouchableOpacity>
                                    {projects?.map((p) => {
                                        const pid = projectIdFromDoc(p);
                                        const selected = uploadProjectId !== 'none' && idKey(uploadProjectId) === pid;
                                        return (
                                            <TouchableOpacity
                                                key={pid}
                                                style={[styles.projectItem, selected && styles.projectItemActive, { paddingHorizontal: scale(16), paddingVertical: verticalScale(10), borderRadius: moderateScale(12), marginRight: scale(8) }]}
                                                onPress={() => setUploadProjectId(pid)}
                                            >
                                                <Text style={[styles.projectItemText, selected && styles.projectItemTextActive, { fontSize: moderateScale(13) }]}>{p.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <TouchableOpacity 
                                    style={[styles.submitBtn, uploading && { opacity: 0.7 }, { height: verticalScale(52), borderRadius: moderateScale(14) }]} 
                                    onPress={uploadImage} 
                                    disabled={uploading}
                                >
                                    {uploading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.submitBtnText, { fontSize: moderateScale(15) }]}>Upload Photo</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* SELECTOR MODAL */}
            <Modal visible={selVisible} transparent animationType="fade">
                <View style={styles.selOverlayModal}>
                    <View style={[styles.selBox, { borderRadius: moderateScale(24), padding: scale(24), maxWidth: 500 }]}>
                        <Text style={[styles.selTitle, { fontSize: moderateScale(14), marginBottom: verticalScale(16) }]}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: verticalScale(300) }}>
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={i} style={[styles.selItem, { paddingVertical: verticalScale(12) }]} onPress={() => selOnSelect(opt)}>
                                    <View style={[styles.selIconBox, { width: scale(32), height: scale(32), borderRadius: moderateScale(10), marginRight: scale(12) }]}>
                                        <MaterialCommunityIcons name={opt.icon || 'circle-small'} size={moderateScale(18)} color="#3B82F6" />
                                    </View>
                                    <Text style={[styles.selLabelText, { fontSize: moderateScale(14) }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={[styles.selClose, { marginTop: verticalScale(16) }]} onPress={() => setSelVisible(false)}>
                            <Text style={[styles.selCloseText, { fontSize: moderateScale(13) }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    pageHeader: { marginBottom: 20 },
    pageTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    pageSubtitle: { fontWeight: '600', color: '#64748B', marginTop: 2, marginBottom: 20 },
    actionRow: { flexDirection: 'row', alignItems: 'center' },
    customDropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dropdownValueText: { fontWeight: '800', color: '#1E293B' },
    uploadBtnNew: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 4 },
    uploadBtnText: { color: '#fff', fontWeight: '900' },
    selOverlayModal: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
    selBox: { width: '85%', backgroundColor: '#fff', elevation: 20 },
    selTitle: { fontWeight: '900', color: '#0F172A', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
    selItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    selIconBox: { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    selLabelText: { fontWeight: '700', color: '#334155' },
    selClose: { alignItems: 'center' },
    selCloseText: { fontWeight: '900', color: '#64748B' },
    list: { },
    photoCardWrapper: { },
    photoCard: { backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    imageContainer: { width: '100%', backgroundColor: '#F1F5F9' },
    photoImg: { width: '100%', height: '100%' },
    deleteIconBtn: { padding: 2, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    photoOverlay: { position: 'absolute' },
    photoBadge: { backgroundColor: 'rgba(15, 23, 42, 0.65)', alignSelf: 'flex-start' },
    photoBadgeText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
    photoFooter: { },
    photoTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    photoDesc: { flex: 1, fontWeight: '800', color: '#1E293B', minWidth: 0 },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaText: { color: '#94A3B8', fontWeight: '800' },
    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 20 },
    emptyText: { fontWeight: '800', color: '#0F172A', marginTop: 16, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalScroll: { backgroundColor: '#fff', paddingBottom: 24, width: '100%', maxHeight: '90%', elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    modalBodyScroll: { maxHeight: '100%' },
    modalBody: { },
    dropZone: { width: '100%', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    dropZoneContent: { alignItems: 'center' },
    dropZoneTitle: { fontWeight: '800', color: '#1E293B' },
    dropZoneSubtitle: { color: '#64748B', fontWeight: '600' },
    dropZoneMeta: { color: '#94A3B8', fontWeight: '500' },
    previewImage: { width: '100%', height: '100%' },
    fieldLabel: { fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    uploadProjectSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    uploadProjectSummaryText: { flex: 1, color: '#1E3A8A', lineHeight: 18, fontWeight: '600' },
    inputField: { width: '100%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontWeight: '600' },
    projectScroll: { flexGrow: 0 },
    projectItem: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    projectItemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    projectItemText: { fontWeight: '700', color: '#475569' },
    projectItemTextActive: { color: '#ffffff' },
    submitBtn: { width: '100%', backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    submitBtnText: { color: '#fff', fontWeight: '800' }
});

export default ProjectManagerPhotosScreen;
