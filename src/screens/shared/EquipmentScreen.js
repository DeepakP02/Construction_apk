import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, ScrollView, StatusBar, SafeAreaView, Image, Platform, KeyboardAvoidingView, useWindowDimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl, uploadMultipart } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EquipmentScreen = ({ navigation }) => {
    const { user } = useApp();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isCompact = width < 390;
    const modalMaxWidth = Math.min(width - 16, 900);
    const modalMaxHeight = Math.min(height * 0.9, 780);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');
    
    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [imageUri, setImageUri] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: 'Heavy Equipment',
        type: 'Excavator',
        serialNumber: '',
        status: 'operational',
        location: 'Warehouse',
        costPerHour: '0',
        lastServiceDate: ''
    });

    const canManage = user?.role === 'COMPANY_OWNER' || user?.role === 'PM';

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/equipment');
            setData(res.data || []);
        } catch (e) {
            console.error('Fetch equipment error:', e);
            Alert.alert('Error', 'Failed to load fleet data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
            const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [data, searchQuery, selectedCategory, selectedStatus]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setForm({
                name: item.name,
                category: item.category || 'Heavy Equipment',
                type: item.type || 'Excavator',
                serialNumber: item.serialNumber || '',
                status: item.status || 'operational',
                location: item.location || 'Warehouse',
                costPerHour: (item.costPerHour || 0).toString(),
                lastServiceDate: item.lastServiceDate ? new Date(item.lastServiceDate).toISOString().split('T')[0] : ''
            });
            setImageUri(item.imageUrl ? getServerUrl(item.imageUrl) : '');
        } else {
            setEditingItem(null);
            setForm({
                name: '',
                category: 'Heavy Equipment',
                type: 'Excavator',
                serialNumber: '',
                status: 'operational',
                location: 'Warehouse',
                costPerHour: '0',
                lastServiceDate: ''
            });
            setImageUri('');
        }
        setModalVisible(true);
    };

    const categoryTypes = useMemo(() => (
        form.category === 'Heavy Equipment'
            ? ['Excavator', 'Crane', 'Truck', 'Bulldozer', 'Generator', 'Compactor', 'Other']
            : ['Power Drill', 'Circular Saw', 'Scaffolding', 'Ladder', 'Concrete Mixer', 'Hand Tool', 'Other']
    ), [form.category]);

    const openPicker = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library permission is required to select equipment image.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setImageUri(result.assets[0].uri);
        }
    };

    const openLastServiceDatePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: form.lastServiceDate ? new Date(form.lastServiceDate) : new Date(),
                mode: 'date',
                is24Hour: true,
                onChange: (event, selectedDate) => {
                    if (event.type !== 'set' || !selectedDate) return;
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const d = String(selectedDate.getDate()).padStart(2, '0');
                    setForm(prev => ({ ...prev, lastServiceDate: `${y}-${m}-${d}` }));
                }
            });
            return;
        }
        setDatePickerVisible(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.category) {
            Alert.alert('Required', 'Please fill in Name and Category');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...form,
                costPerHour: parseFloat(form.costPerHour) || 0,
                lastServiceDate: form.lastServiceDate || undefined
            };

            let savedId = '';
            if (editingItem) {
                const updated = await api.patch(`/equipment/${editingItem._id || editingItem.id}`, payload);
                savedId = updated?.data?._id || editingItem._id || editingItem.id;
            } else {
                const created = await api.post('/equipment', payload);
                savedId = created?.data?._id;
            }

            const shouldUploadNewImage = imageUri && imageUri.startsWith('file://');
            if (savedId && shouldUploadNewImage) {
                setIsUploadingImage(true);
                const fd = new FormData();
                fd.append('image', {
                    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                    name: `equipment_${Date.now()}.jpg`,
                    type: 'image/jpeg'
                });
                await uploadMultipart(`/equipment/${savedId}/upload-image`, fd);
            }
            
            setModalVisible(false);
            fetchData();
            Alert.alert('Success', `Asset ${editingItem ? 'updated' : 'added'} successfully`);
        } catch (e) {
            Alert.alert('Error', 'Failed to save asset details');
        } finally {
            setSubmitting(false);
            setIsUploadingImage(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Decommission Asset', 'Are you sure you want to remove this equipment from fleet? This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decommission', style: 'destructive', onPress: async () => {
                    try {
                        await api.delete(`/equipment/${id}`);
                        fetchData();
                    } catch (e) {
                        Alert.alert('Error', 'Deletion failed');
                    }
                }
            }
        ]);
    };

    const getStatusStyles = (status) => {
        switch (status?.toLowerCase()) {
            case 'operational': 
            case 'active':
                return { bg: '#F0FDF4', text: '#10B981', dot: '#10B981', label: 'In Use' };
            case 'maintenance': 
            case 'out_of_service':
                return { bg: '#FEF2F2', text: '#EF4444', dot: '#EF4444', label: 'Maintenance' };
            case 'idle': 
                return { bg: '#F8FAFC', text: '#64748B', dot: '#64748B', label: 'Idle' };
            default: 
                return { bg: '#F1F5F9', text: '#94A3B8', dot: '#94A3B8', label: status || 'Unknown' };
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Inventory & Fleet" showBranding={true} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scroll,
                    {
                        paddingBottom: Math.max(insets.bottom + 30, 40),
                        maxWidth: width >= 900 ? 980 : undefined,
                        alignSelf: 'center',
                        width: '100%'
                    }
                ]}
            >
                {/* Header Branding */}
                <View style={[styles.pageHeader, { paddingHorizontal: isCompact ? 14 : 20 }]}>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.mainTitle, { fontSize: isCompact ? 22 : 26 }]}>Inventory & Fleet</Text>
                        <Text style={[styles.mainSubtitle, { fontSize: isCompact ? 12 : 13 }]}>Equipment tracking</Text>
                    </View>
                    {canManage && (
                        <TouchableOpacity style={[styles.addBtn, { paddingHorizontal: isCompact ? 10 : 12 }]} onPress={() => handleOpenModal()}>
                            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                            <Text style={[styles.addBtnText, { fontSize: isCompact ? 11 : 12 }]}>Add Item</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters Section */}
                <View style={[styles.filterSection, { paddingHorizontal: isCompact ? 14 : 20 }]}>
                    <View style={[styles.searchBar, { height: isCompact ? 48 : 52, borderRadius: isCompact ? 12 : 16 }]}>
                        <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                        <TextInput 
                            placeholder="Search by name, type, or serial..."
                            placeholderTextColor="#94A3B8"
                            style={[styles.searchInput, { fontSize: isCompact ? 13 : 14 }]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                        {['All', 'Heavy Equipment', 'Small Tools'].map(cat => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[styles.catBtnText, selectedCategory === cat && styles.catBtnTextActive]}>
                                    {cat === 'All' ? 'All Assets' : cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Asset List */}
                <View style={[styles.listContainer, { paddingHorizontal: isCompact ? 14 : 20 }]}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 40 }} />
                    ) : filteredData.length === 0 ? (
                        <View style={styles.emptyView}>
                            <MaterialCommunityIcons name="truck-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No equipment found matching criteria</Text>
                        </View>
                    ) : (
                        filteredData.map((item, index) => {
                            const st = getStatusStyles(item.status);
                            return (
                                <TouchableOpacity 
                                    key={item._id || index} 
                                    style={[styles.assetCard, SHADOWS.small]}
                                    onPress={() => canManage && handleOpenModal(item)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.assetImageWrap}>
                                        {item.imageUrl ? (
                                            <Image source={{ uri: getServerUrl(item.imageUrl) }} style={styles.assetImage} />
                                        ) : (
                                            <View style={styles.assetImagePlaceholder}>
                                                <MaterialCommunityIcons
                                                    name={item.category === 'Small Tools' ? 'tools' : 'excavator'}
                                                    size={24}
                                                    color="#64748B"
                                                />
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.assetHeader}>
                                        <View style={styles.assetMain}>
                                            <Text style={styles.assetName} numberOfLines={2} ellipsizeMode="tail">{item.name}</Text>
                                            <View style={styles.assetTypeRow}>
                                                <View style={styles.assetTypeWrap}>
                                                    <Text style={styles.assetType} numberOfLines={1} ellipsizeMode="tail">{item.type || 'Standard Unit'}</Text>
                                                </View>
                                                <Text style={styles.assetDivider}>•</Text>
                                                <Text style={styles.assetId} numberOfLines={1}>#{item.serialNumber || 'SN-NA'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.headerActions}>
                                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                                <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
                                                <Text style={[styles.statusLabel, { color: st.text }]} numberOfLines={1}>{st.label}</Text>
                                            </View>
                                            {canManage && (
                                                <TouchableOpacity
                                                    style={styles.deleteBtn}
                                                    onPress={() => handleDelete(item._id)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View style={styles.assetDividerLine} />
                                    
                                    <View style={styles.assetInfoGrid}>
                                        <View style={styles.infoBox}>
                                            <Text style={styles.infoLabel}>LOCATION</Text>
                                            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
                                                {(typeof item.location === 'object' ? item.location?.address : item.location) || 'Warehouse'}
                                            </Text>
                                        </View>
                                        <View style={styles.infoBox}>
                                            <Text style={styles.infoLabel}>ASSIGNED JOB</Text>
                                            <Text
                                                style={[
                                                    styles.infoValue,
                                                    item.assignedJob ? { color: '#2563EB' } : { color: '#94A3B8' },
                                                ]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {item.assignedJob?.name || 'Idle / Not Set'}
                                            </Text>
                                        </View>
                                        <View style={styles.infoBox}>
                                            <Text style={styles.infoLabel}>HOURLY RATE</Text>
                                            <Text style={styles.infoValue} numberOfLines={1}>
                                                ${item.costPerHour || 0}/h
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                <View style={{ height: 8 }} />
            </ScrollView>

            {/* NEW/EDIT MODAL */}
            <Modal visible={modalVisible} animationType="fade" transparent statusBarTranslucent presentationStyle="overFullScreen">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                    <View style={[styles.modalCard, SHADOWS.large, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isCompact ? 16 : 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingItem ? 'Edit Equipment' : 'Add New Item'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                            contentContainerStyle={styles.modalScroll}
                        >
                            <Text style={styles.inputLabel}>Equipment Photo</Text>
                            <TouchableOpacity style={styles.imageDropzone} onPress={openPicker}>
                                {imageUri ? (
                                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <MaterialCommunityIcons name="image-outline" size={36} color="#3B82F6" />
                                        <Text style={styles.imagePlaceholderTitle}>Click to Upload Photo</Text>
                                        <Text style={styles.imagePlaceholderSub}>JPG, PNG up to 5MB</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Asset Name</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. Caterpillar D9" 
                                value={form.name} 
                                onChangeText={t => setForm({...form, name: t})} 
                            />

                            <View style={[styles.inputRow, isCompact && styles.inputRowStack]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Category</Text>
                                    <View style={styles.selectorRow}>
                                        {['Heavy Equipment', 'Small Tools'].map(c => (
                                            <TouchableOpacity
                                                key={c}
                                                style={[styles.miniBtn, form.category === c && styles.miniBtnActive]}
                                                onPress={() => setForm(prev => ({ ...prev, category: c, type: c === 'Heavy Equipment' ? 'Excavator' : 'Power Drill' }))}
                                            >
                                                <Text style={[styles.miniBtnText, form.category === c && styles.miniBtnTextActive]}>{c}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={{ flex: 1, marginLeft: isCompact ? 0 : 12 }}>
                                    <Text style={styles.inputLabel}>Type</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                        {categoryTypes.map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.miniBtn, form.type === type && styles.miniBtnActive, { minWidth: 120 }]}
                                                onPress={() => setForm(prev => ({ ...prev, type }))}
                                            >
                                                <Text style={[styles.miniBtnText, form.type === type && styles.miniBtnTextActive]}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={[styles.inputRow, isCompact && styles.inputRowStack]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Serial Number</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="#SN-XXXXX"
                                        value={form.serialNumber}
                                        onChangeText={t => setForm({ ...form, serialNumber: t })}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: isCompact ? 0 : 12 }}>
                                    <Text style={styles.inputLabel}>Location</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Warehouse"
                                        value={form.location}
                                        onChangeText={t => setForm({ ...form, location: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.inputRow, isCompact && styles.inputRowStack]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Last Maint. Date</Text>
                                    <TouchableOpacity style={[styles.input, styles.dateField]} onPress={openLastServiceDatePicker}>
                                        <Text style={[styles.dateText, !form.lastServiceDate && { color: '#94A3B8' }]}>
                                            {form.lastServiceDate || 'dd/mm/yyyy'}
                                        </Text>
                                        <MaterialCommunityIcons name="calendar" size={20} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1, marginLeft: isCompact ? 0 : 12 }}>
                                    <Text style={styles.inputLabel}>Hourly Cost ($)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={form.costPerHour}
                                        onChangeText={t => setForm({ ...form, costPerHour: t })}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Initial Status</Text>
                            <View style={styles.selectorRow}>
                                {[
                                    { value: 'operational', label: 'Operational' },
                                    { value: 'maintenance', label: 'Maintenance' },
                                    { value: 'idle', label: 'Idle' },
                                    { value: 'out_of_service', label: 'Out of Service' }
                                ].map(s => (
                                    <TouchableOpacity
                                        key={s.value}
                                        style={[styles.miniBtn, form.status === s.value && styles.miniBtnActive]}
                                        onPress={() => setForm({ ...form, status: s.value })}
                                    >
                                        <Text style={[styles.miniBtnText, form.status === s.value && styles.miniBtnTextActive]}>{s.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={submitting || isUploadingImage}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, (submitting || isUploadingImage) && { opacity: 0.7 }]}
                                    onPress={handleSave}
                                    disabled={submitting || isUploadingImage}
                                >
                                    {submitting || isUploadingImage ? <ActivityIndicator color="#fff" /> : (
                                        <Text style={styles.saveBtnText}>{editingItem ? 'Save Changes' : 'Add Item'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>
            {Platform.OS === 'ios' && datePickerVisible ? (
                <View style={styles.iosDatePickerWrap}>
                    <DateTimePicker
                        value={form.lastServiceDate ? new Date(form.lastServiceDate) : new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                            if (!selectedDate) return;
                            const y = selectedDate.getFullYear();
                            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const d = String(selectedDate.getDate()).padStart(2, '0');
                            setForm(prev => ({ ...prev, lastServiceDate: `${y}-${m}-${d}` }));
                        }}
                    />
                    <TouchableOpacity style={styles.iosDateDoneBtn} onPress={() => setDatePickerVisible(false)}>
                        <Text style={styles.iosDateDoneText}>Done</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scroll: { paddingTop: 20 },
    pageHeader: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 4 },
    headerTextContainer: { flex: 1, marginRight: 12 },
    mainTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '800', marginTop: 4 },
    addBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    addBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    filterSection: { paddingHorizontal: 20, marginBottom: 24 },
    searchBar: { height: 52, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1E293B' },
    categoryRow: { gap: 10 },
    catBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    catBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    catBtnText: { fontSize: 12, fontWeight: '900', color: '#64748B' },
    catBtnTextActive: { color: '#fff' },

    listContainer: { paddingHorizontal: 20 },
    assetCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' },
    assetImageWrap: { width: '100%', height: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8FAFC', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    assetImage: { width: '100%', height: '100%' },
    assetImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
    assetMain: { flex: 1, minWidth: 0, paddingRight: 6 },
    headerActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexShrink: 0, paddingTop: 1 },
    deleteBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
    assetName: { fontSize: 15, fontWeight: '900', color: '#0F172A', lineHeight: 19 },
    assetTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    assetTypeWrap: { flex: 1, minWidth: 0 },
    assetType: { fontSize: 10, fontWeight: '900', color: '#2563EB', textTransform: 'uppercase' },
    assetDivider: { color: '#CBD5E1', flexShrink: 0 },
    assetId: { fontSize: 10, fontWeight: '800', color: '#94A3B8', flexShrink: 0 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    statusDot: { width: 5, height: 5, borderRadius: 2.5 },
    statusLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', flexShrink: 1 },
    assetDividerLine: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
    assetInfoGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    infoBox: { flex: 1, minWidth: 0 },
    infoLabel: { fontSize: 8, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.4, marginBottom: 3 },
    infoValue: { fontSize: 11, fontWeight: '800', color: '#1E293B', lineHeight: 14 },

    emptyView: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, fontWeight: '800', color: '#94A3B8', marginTop: 16, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    modalScroll: { paddingBottom: 26 },
    imageDropzone: { height: 150, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F8FAFC', overflow: 'hidden', marginTop: 6 },
    imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imagePlaceholderTitle: { fontSize: 12, fontWeight: '900', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
    imagePlaceholderSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 4 },
    previewImage: { width: '100%', height: '100%' },
    inputLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
    input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, fontSize: 15, fontWeight: '800', color: '#1E293B' },
    inputRow: { flexDirection: 'row' },
    inputRowStack: { flexDirection: 'column', gap: 10 },
    dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateText: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
    selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    miniBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    miniBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    miniBtnText: { fontSize: 11, fontWeight: '900', color: '#64748B' },
    miniBtnTextActive: { color: '#fff' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 26 },
    cancelBtn: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
    cancelText: { color: '#475569', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
    saveBtn: { flex: 1.25, height: 56, backgroundColor: '#2563EB', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
    iosDatePickerWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    iosDateDoneBtn: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    iosDateDoneText: { color: '#2563EB', fontWeight: '800', fontSize: 14 }
});

export default EquipmentScreen;
