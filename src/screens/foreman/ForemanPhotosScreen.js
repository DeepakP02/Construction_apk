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

function idKey(raw) {
    if (raw == null || raw === '') return '';
    return String(raw);
}
function projectIdFromDoc(p) {
    if (!p) return '';
    return idKey(p._id ?? p.id);
}

const ForemanPhotosScreen = () => {
    const { projects, selectedProject: globalSelectedProject } = useApp();
    const { width } = useWindowDimensions();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('all');

    const [uploadModal, setUploadModal] = useState(false);
    const [tempImage, setTempImage] = useState(null);
    const [externalUrl, setExternalUrl] = useState('');
    const [description, setDescription] = useState('');
    const [uploadProjectId, setUploadProjectId] = useState('none');
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const [selVisible, setSelVisible] = useState(false);
    const [selTitle, setSelTitle] = useState('');
    const [selOptions, setSelOptions] = useState([]);
    const [selOnSelect, setSelOnSelect] = useState(() => () => {});

    const selectedProjectLabel =
        selectedProjectId === 'all'
            ? 'All Sites'
            : projects.find((p) => projectIdFromDoc(p) === idKey(selectedProjectId))?.name || 'Select Site';

    const uploadTargetLabel =
        uploadProjectId === 'none'
            ? null
            : projects.find((p) => projectIdFromDoc(p) === idKey(uploadProjectId))?.name;

    const fetchPhotos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/photos');
            setPhotos((res.data || []).map((p) => enrichPhotoWithProject(p, projects)));
        } catch (e) {
            console.error('Fetch error:', e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPhotos(); }, [projects]);

    // Sync with global selection
    useEffect(() => {
        if (globalSelectedProject) {
            setSelectedProjectId(idKey(globalSelectedProject._id || globalSelectedProject.id));
        } else {
            setSelectedProjectId('all');
        }
    }, [globalSelectedProject]);

    const filteredPhotos = (photos || []).filter((p) => {
        const matchesProject = selectedProjectId === 'all' || idKey(p.projectId?._id || p.projectId) === idKey(selectedProjectId);
        const matchesSearch = (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.projectId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesProject && matchesSearch;
    });

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied'); return; }
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
        if (!result.canceled && result.assets?.[0]) {
            setTempImage(result.assets[0].uri);
            setExternalUrl('');
        }
    };

    const uploadImage = async () => {
        if (!tempImage && !externalUrl?.trim()) {
            Alert.alert('Required', 'Choose a photo from your library or paste an image URL.');
            return;
        }
        try {
            setUploading(true);
            const formData = new FormData();
            if (tempImage) {
                formData.append('image', { uri: Platform.OS === 'android' ? tempImage : tempImage.replace('file://', ''), name: 'photo.jpg', type: 'image/jpeg' });
            } else {
                formData.append('imageUrl', externalUrl.trim());
            }
            formData.append('description', description || 'Site Update');
            if (uploadProjectId !== 'none') formData.append('projectId', idKey(uploadProjectId));

            const res = await api.post('/photos/upload', formData);
            setPhotos(prev => [enrichPhotoWithProject(res.data, projects), ...prev]);
            setUploadModal(false);
        } catch (e) { Alert.alert('Error', 'Sync failed.'); } finally {
            setUploading(false);
            setTempImage(null);
            setExternalUrl('');
            setDescription('');
            setUploadProjectId('none');
        }
    };

    const confirmDeletePhoto = (item) => {
        const id = item._id || item.id;
        Alert.alert('Delete photo?', 'Remove from site gallery?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                setDeletingId(id);
                try { await api.delete(`/photos/${id}`); setPhotos(prev => prev.filter(p => (p._id || p.id) !== id)); }
                catch (e) { Alert.alert('Error', 'Delete failed.'); } finally { setDeletingId(null); }
            }}
        ]);
    };

    const openDropdown = (title, options, onSelect) => {
        setSelTitle(title); setSelOptions(options); setSelOnSelect(() => (val) => { onSelect(val); setSelVisible(false); }); setSelVisible(true);
    };

    const handleExternalUrlChange = (text) => {
        setExternalUrl(text);
        if (text.trim()) setTempImage(null);
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Photos" />

            <View style={[styles.pageHeader, { paddingHorizontal: isTablet ? '10%' : scale(24), paddingTop: verticalScale(16) }]}>
                <Text style={[styles.pageTitle, { fontSize: moderateScale(28) }]}>Site Gallery</Text>
                <Text style={[styles.pageSubtitle, { fontSize: moderateScale(13), marginTop: verticalScale(4), marginBottom: verticalScale(24) }]}>Document progress & material deliveries.</Text>

                <View style={[styles.actionRow, { gap: scale(12) }]}>
                    <TouchableOpacity 
                        style={[styles.customDropdownBtn, { height: verticalScale(48), borderRadius: moderateScale(14), paddingHorizontal: scale(16) }]}
                        onPress={() => openDropdown('Filter By Site', [{ label: 'All Sites', value: 'all', icon: 'layers' }, ...projects.map(p => ({ label: p.name, value: projectIdFromDoc(p), icon: 'office-building' }))], (opt) => setSelectedProjectId(opt.value === 'all' ? 'all' : idKey(opt.value)))}
                    >
                        <View style={[styles.dropdownLeft, { gap: scale(10) }]}>
                            <MaterialCommunityIcons name="filter-variant" size={moderateScale(14)} color="#64748B" />
                            <Text style={[styles.dropdownValueText, { fontSize: moderateScale(13) }]}>{selectedProjectLabel}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(14)} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.uploadBtnNew, { height: verticalScale(48), borderRadius: moderateScale(14), paddingHorizontal: scale(20), gap: scale(8) }]} onPress={openUploadModal}>
                        <MaterialCommunityIcons name="plus" size={moderateScale(16)} color="#fff" />
                        <Text style={[styles.uploadBtnText, { fontSize: moderateScale(13) }]}>Add Photo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? <ActivityIndicator style={{ marginTop: verticalScale(40) }} color={COLORS.primary} size="large" /> : (
                <FlatList
                    data={filteredPhotos}
                    numColumns={isTablet ? 3 : 2}
                    key={isTablet ? 'tablet' : 'phone'}
                    keyExtractor={(item) => item._id || item.id}
                    contentContainerStyle={[styles.list, { paddingHorizontal: isTablet ? '10%' : scale(16), paddingBottom: verticalScale(120) }]}
                    showsVerticalScrollIndicator={false}
                    onRefresh={fetchPhotos}
                    refreshing={loading}
                    renderItem={({ item }) => (
                        <View style={[styles.photoCardWrapper, { width: isTablet ? '33.3%' : '50%', padding: scale(8) }]}>
                            <View style={[styles.photoCard, SHADOWS.small, { borderRadius: moderateScale(20) }]}>
                                <View style={[styles.imageContainer, { height: verticalScale(160) }]}>
                                    <Image source={{ uri: getServerUrl(item.imageUrl) || item.imageUrl }} style={styles.photoImg} resizeMode="cover" />
                                    <View style={[styles.photoBadge, { top: scale(10), left: scale(10), paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(8) }]}>
                                        <Text style={[styles.photoBadgeText, { fontSize: moderateScale(9) }]} numberOfLines={1}>{item.projectId?.name || 'General'}</Text>
                                    </View>
                                </View>
                                <View style={[styles.photoFooter, { padding: moderateScale(12) }]}>
                                    <View style={[styles.photoTitleRow, { gap: scale(8), marginBottom: verticalScale(8) }]}>
                                        <Text style={[styles.photoDesc, { fontSize: moderateScale(13) }]} numberOfLines={1}>{item.description || 'Verified Update'}</Text>
                                        <TouchableOpacity onPress={() => confirmDeletePhoto(item)} disabled={deletingId === (item._id || item.id)}>
                                            {deletingId === (item._id || item.id) ? <ActivityIndicator size="small" color="#DC2626" /> : <MaterialCommunityIcons name="trash-can-outline" size={moderateScale(18)} color="#DC2626" />}
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.metaRow, { gap: scale(6) }]}>
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
                    <View style={[styles.modalScroll, { height: isTablet ? '70%' : '90%', maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', borderTopLeftRadius: moderateScale(30), borderTopRightRadius: moderateScale(30) }]}>
                        <View style={[styles.modalHeaderRow, { padding: scale(20) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(22) }]}>New Site Photo</Text>
                            <TouchableOpacity onPress={() => !uploading && setUploadModal(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: scale(24) }}>
                            <TouchableOpacity style={[styles.dropZone, { height: verticalScale(220), borderRadius: moderateScale(20), marginBottom: verticalScale(20) }]} onPress={pickImage} disabled={uploading}>
                                {tempImage ? <Image source={{ uri: tempImage }} style={styles.previewImage} resizeMode="contain" /> : (
                                    <View style={{ alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="camera-plus" size={moderateScale(40)} color="#94A3B8" />
                                        <Text style={[styles.dropZoneTitle, { fontSize: moderateScale(16), marginTop: verticalScale(10) }]}>Snap or Choose Photo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={[styles.fieldLabel, { fontSize: moderateScale(10), marginBottom: verticalScale(8) }]}>Or Image URL (External)</Text>
                            <TextInput
                                style={[styles.inputField, { height: verticalScale(50), borderRadius: moderateScale(12), paddingHorizontal: scale(16), marginBottom: verticalScale(20), fontSize: moderateScale(14) }]}
                                placeholder="https://images.unsplash.com/..."
                                placeholderTextColor="#94A3B8"
                                value={externalUrl}
                                onChangeText={handleExternalUrlChange}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                            />

                            <Text style={[styles.fieldLabel, { fontSize: moderateScale(10), marginBottom: verticalScale(8) }]}>Brief Note / Activity</Text>
                            <TextInput style={[styles.inputField, { height: verticalScale(50), borderRadius: moderateScale(12), paddingHorizontal: scale(16), marginBottom: verticalScale(20) }]} placeholder="e.g. Scaffolding complete" value={description} onChangeText={setDescription} />

                            <Text style={[styles.fieldLabel, { fontSize: moderateScale(10), marginBottom: verticalScale(8) }]}>Select Site</Text>
                            <TouchableOpacity
                                style={[styles.customDropdownBtn, { height: verticalScale(50), borderRadius: moderateScale(12), paddingHorizontal: scale(14), marginBottom: verticalScale(20) }]}
                                onPress={() => openDropdown(
                                    'Select Upload Site',
                                    [
                                        { label: 'General / None', value: 'none', icon: 'link-off' },
                                        ...projects.map((p) => ({ label: p.name, value: projectIdFromDoc(p), icon: 'office-building' }))
                                    ],
                                    (opt) => setUploadProjectId(opt.value === 'none' ? 'none' : idKey(opt.value))
                                )}
                            >
                                <View style={[styles.dropdownLeft, { gap: scale(10) }]}>
                                    <MaterialCommunityIcons name="office-building" size={moderateScale(14)} color="#64748B" />
                                    <Text style={[styles.dropdownValueText, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                                        {uploadProjectId === 'none' ? 'General / None' : (uploadTargetLabel || 'Select Site')}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-down" size={moderateScale(14)} color="#64748B" />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.submitBtn, { height: verticalScale(56), borderRadius: moderateScale(16) }]} onPress={uploadImage} disabled={uploading}>
                                {uploading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.submitBtnText, { fontSize: moderateScale(16) }]}>SYNC WITH DASHBOARD</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={selVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.selOverlayModal} activeOpacity={1} onPress={() => setSelVisible(false)}>
                    <View style={[styles.selBox, { width: isTablet ? 400 : '85%', borderRadius: moderateScale(24), padding: scale(20) }]}>
                        <Text style={[styles.selTitle, { fontSize: moderateScale(14), marginBottom: verticalScale(15) }]}>{selTitle}</Text>
                        <ScrollView style={{ maxHeight: verticalScale(300) }}>
                            {selOptions.map((opt, i) => (
                                <TouchableOpacity key={i} style={[styles.selItem, { paddingVertical: verticalScale(12) }]} onPress={() => selOnSelect(opt)}>
                                    <MaterialCommunityIcons name={opt.icon || 'circle-small'} size={moderateScale(18)} color="#2563EB" style={{ marginRight: scale(12) }} />
                                    <Text style={[styles.selLabelText, { fontSize: moderateScale(14) }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    pageHeader: { },
    pageTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    pageSubtitle: { fontWeight: '600', color: '#64748B' },
    actionRow: { flexDirection: 'row', alignItems: 'center' },
    customDropdownBtn: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dropdownLeft: { flexDirection: 'row', alignItems: 'center' },
    dropdownValueText: { fontWeight: '800', color: '#1E293B' },
    uploadBtnNew: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 10 },
    uploadBtnText: { color: '#fff', fontWeight: '900' },
    selOverlayModal: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
    selBox: { backgroundColor: '#fff' },
    selTitle: { fontWeight: '900', color: '#0F172A', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.5 },
    selItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    selLabelText: { fontWeight: '700', color: '#334155' },
    list: { },
    photoCardWrapper: { },
    photoCard: { backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    imageContainer: { width: '100%', backgroundColor: '#F1F5F9' },
    photoImg: { width: '100%', height: '100%' },
    photoBadge: { position: 'absolute', backgroundColor: 'rgba(15, 23, 42, 0.8)' },
    photoBadgeText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
    photoFooter: { },
    photoTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    photoDesc: { flex: 1, fontWeight: '800', color: '#1E293B' },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaText: { color: '#94A3B8', fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
    modalScroll: { backgroundColor: '#fff', width: '100%' },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    dropZone: { width: '100%', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    dropZoneTitle: { fontWeight: '900', color: '#1E293B' },
    previewImage: { width: '100%', height: '100%' },
    fieldLabel: { fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5 },
    inputField: { width: '100%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontWeight: '800' },
    submitBtn: { width: '100%', backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 12 },
    submitBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1 }
});

export default ForemanPhotosScreen;
