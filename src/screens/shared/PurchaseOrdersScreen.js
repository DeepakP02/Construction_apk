import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    StatusBar,
    Modal,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

const PO_STATUS_FILTERS = [
    { value: 'all', label: 'All status' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Pending Approval', label: 'Pending approval' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Closed', label: 'Closed' },
    { value: 'Cancelled', label: 'Cancelled' },
];

const PurchaseOrdersScreen = ({ navigation }) => {
    const { projects } = useApp();
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilterId, setProjectFilterId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [projectFilterVisible, setProjectFilterVisible] = useState(false);
    const [statusFilterVisible, setStatusFilterVisible] = useState(false);
    
    // Create PO State
    const [createVisible, setCreateVisible] = useState(false);
    const [formProject, setFormProject] = useState(null);
    const [formVendor, setFormVendor] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [items, setItems] = useState([{ id: Date.now(), itemName: '', description: '', quantity: '1', unitPrice: '0' }]);
    const [submitting, setSubmitting] = useState(false);
    const [selProjectVisible, setSelProjectVisible] = useState(false);

    const fetchPOs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/purchase-orders');
            setPos(res.data || []);
        } catch (e) {
            console.error('Fetch PO error:', e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPOs();
    }, []);

    // Summary Calculations
    const poSummary = useMemo(() => {
        const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
        const tax = subtotal * 0.15;
        const total = subtotal + tax;
        return { subtotal, tax, total };
    }, [items]);

    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), itemName: '', description: '', quantity: '1', unitPrice: '0' }]);
    };

    const handleUpdateItem = (id, field, val) => {
        setItems(items.map(it => it.id === id ? { ...it, [field]: val } : it));
    };

    const handleRemoveItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(it => it.id !== id));
        }
    };

    const handleCreatePO = async () => {
        if (!formProject || !formVendor || !formEmail || items.some(it => !it.itemName)) {
            Alert.alert('Required Fields', 'Please fill in Project, Vendor details and at least one item name.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                projectId: formProject._id || formProject.id,
                vendorName: formVendor,
                vendorEmail: formEmail,
                items: items.map(it => ({
                    itemName: it.itemName,
                    description: it.description,
                    quantity: parseInt(it.quantity) || 0,
                    unitPrice: parseFloat(it.unitPrice) || 0
                })),
                notes: formNotes,
                poNumber: `PO-${Math.floor(100000 + Math.random() * 900000)}`,
                status: 'Pending Approval',
                expectedDeliveryDate: new Date()
            };

            await api.post('/purchase-orders', payload);
            setCreateVisible(false);
            resetForm();
            fetchPOs();
            Alert.alert('Success', 'Purchase Order requisition submitted successfully.');
        } catch (e) {
            Alert.alert('Submission Error', e.response?.data?.message || 'Failed to submit PO');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormProject(null);
        setFormVendor('');
        setFormEmail('');
        setFormNotes('');
        setItems([{ id: Date.now(), itemName: '', description: '', quantity: '1', unitPrice: '0' }]);
    };

    const projectPickerRows = useMemo(() => {
        const map = new Map();
        const add = (id, name) => {
            if (id == null || id === '') return;
            const key = String(id);
            if (!map.has(key)) map.set(key, { id, name: name || 'Project' });
        };
        (projects || []).forEach(p => add(p._id || p.id, p.name));
        pos.forEach(po => {
            const pid = po.projectId?._id || po.projectId;
            const name = po.projectId?.name;
            add(pid, name);
        });
        const rows = Array.from(map.values()).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        );
        return [{ id: null, name: 'All projects' }, ...rows];
    }, [projects, pos]);

    const projectFilterLabel = useMemo(() => {
        if (projectFilterId == null) return 'All projects';
        const row = projectPickerRows.find(
            p => p.id != null && String(p.id) === String(projectFilterId)
        );
        return row?.name || 'Project';
    }, [projectFilterId, projectPickerRows]);

    const statusFilterLabel = useMemo(() => {
        const row = PO_STATUS_FILTERS.find(s => s.value === statusFilter);
        return row?.label || 'All status';
    }, [statusFilter]);

    const filteredPOs = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return pos.filter(po => {
            const matchesSearch =
                !q ||
                (po.poNumber || '').toLowerCase().includes(q) ||
                (po.vendorName || '').toLowerCase().includes(q);
            const pid = po.projectId?._id || po.projectId;
            const matchesProject =
                projectFilterId == null || String(pid || '') === String(projectFilterId);
            const st = po.status || '';
            const matchesStatus =
                statusFilter === 'all' ||
                st === statusFilter ||
                (statusFilter === 'Pending Approval' && st === 'Pending');
            return matchesSearch && matchesProject && matchesStatus;
        });
    }, [pos, searchQuery, projectFilterId, statusFilter]);

    const clearListFilters = () => {
        setProjectFilterId(null);
        setStatusFilter('all');
    };

    const openPODetail = (item) => {
        const id = item._id || item.id;
        if (!id) return;
        navigation.navigate('PurchaseOrderDetail', { poId: String(id) });
    };

    const renderPOItem = ({ item }) => {
        const isApproved = item.status === 'Approved';
        const statusColor = isApproved ? '#2563EB' : '#EA580C';
        const statusBg = isApproved ? '#EFF6FF' : '#FFF7ED';

        return (
            <TouchableOpacity
                style={[styles.poCard, SHADOWS.medium]}
                activeOpacity={0.9}
                onPress={() => openPODetail(item)}
            >
                {/* Status Accent Bar */}
                <View style={[styles.statusAccent, { backgroundColor: statusColor }]} />
                
                <View style={styles.poCardInfo}>
                    <View style={styles.poCardTop}>
                        <View style={styles.poNumWrap}>
                            <View style={[styles.hashBox, { backgroundColor: statusBg }]}>
                                <MaterialCommunityIcons name="pound" size={14} color={statusColor} />
                            </View>
                            <View>
                                <Text style={styles.poNumberTxt}>{item.poNumber || 'PO-000000'}</Text>
                                <Text style={styles.poProjectTxt} numberOfLines={1}>{item.projectId?.name || 'GEN SITE'}</Text>
                                <Text style={styles.poProjectSub}>CONSTRUCTION SITE</Text>
                            </View>
                        </View>
                        <View style={styles.vendorWrap}>
                            <View style={[styles.vendorAvatar, { backgroundColor: '#F8FAFC', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }]}>
                                <Text style={styles.vendorAvatarTxt}>{item.vendorName?.charAt(0) || 'V'}</Text>
                            </View>
                            <Text style={styles.vendorNameTxt}>{item.vendorName || 'Unknown'}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.poCardBottom}>
                        <View style={styles.poAmountWrap}>
                            <Text style={styles.poAmountLabel}>TOTAL REQUISITION</Text>
                            <Text style={[styles.poAmountVal, { color: statusColor }]}>${item.totalAmount?.toLocaleString() || '0'}</Text>
                        </View>
                        <View style={styles.poStatusWrap}>
                            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                    {item.status?.toUpperCase() || 'PENDING'}
                                </Text>
                            </View>
                            <Text style={styles.poDateTxt}>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.detailsBtn} pointerEvents="none">
                            <MaterialCommunityIcons name="chevron-right-circle-outline" size={24} color="#CBD5E1" />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Purchase Orders" showBranding={true} />
            
            <View style={styles.pageHeader}>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.mainTitle}>Purchase Orders</Text>
                    <Text style={styles.mainSubtitle}>Procurement Management</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
                    <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Raise PO</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                    <View style={styles.searchBox}>
                        <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                        <TextInput 
                            placeholder="Search PO #, Vendor..."
                            placeholderTextColor="#94A3B8"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsRow}>
                        <TouchableOpacity
                            style={styles.toolBtn}
                            onPress={() => setProjectFilterVisible(true)}
                        >
                            <Text style={styles.toolBtnTxt} numberOfLines={1}>
                                {projectFilterId == null ? 'ALL PROJECTS' : projectFilterLabel.toUpperCase()}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.toolBtn}
                            onPress={() => setStatusFilterVisible(true)}
                        >
                            <Text style={styles.toolBtnTxt} numberOfLines={1}>
                                {statusFilter === 'all' ? 'ALL STATUS' : statusFilterLabel.toUpperCase()}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtnIcon} onPress={clearListFilters}>
                            <MaterialCommunityIcons name="filter-variant" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </ScrollView>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <FlatList
                    data={filteredPOs}
                    keyExtractor={p => p._id || p.id}
                    renderItem={renderPOItem}
                    contentContainerStyle={styles.listArea}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal visible={projectFilterVisible} transparent animationType="fade" onRequestClose={() => setProjectFilterVisible(false)}>
                <View style={styles.selBack}>
                    <View style={styles.selCard}>
                        <Text style={styles.selTitle}>Filter by project</Text>
                        <FlatList
                            data={projectPickerRows}
                            keyExtractor={item => (item.id == null ? '__all__' : String(item.id))}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const selected =
                                    (item.id == null && projectFilterId == null) ||
                                    (item.id != null && String(item.id) === String(projectFilterId));
                                return (
                                    <TouchableOpacity
                                        style={styles.selItem}
                                        onPress={() => {
                                            setProjectFilterId(item.id);
                                            setProjectFilterVisible(false);
                                        }}
                                    >
                                        <Text style={styles.selItemTxt} numberOfLines={2}>{item.name}</Text>
                                        {selected ? (
                                            <MaterialCommunityIcons name="check-circle" size={22} color="#2563EB" />
                                        ) : (
                                            <View style={{ width: 22 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity onPress={() => setProjectFilterVisible(false)} style={styles.selClose}>
                            <Text style={styles.selCloseTxt}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={statusFilterVisible} transparent animationType="fade" onRequestClose={() => setStatusFilterVisible(false)}>
                <View style={styles.selBack}>
                    <View style={styles.selCard}>
                        <Text style={styles.selTitle}>Filter by status</Text>
                        <FlatList
                            data={PO_STATUS_FILTERS}
                            keyExtractor={item => item.value}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const selected = statusFilter === item.value;
                                return (
                                    <TouchableOpacity
                                        style={styles.selItem}
                                        onPress={() => {
                                            setStatusFilter(item.value);
                                            setStatusFilterVisible(false);
                                        }}
                                    >
                                        <Text style={styles.selItemTxt}>{item.label}</Text>
                                        {selected ? (
                                            <MaterialCommunityIcons name="check-circle" size={22} color="#2563EB" />
                                        ) : (
                                            <View style={{ width: 22 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity onPress={() => setStatusFilterVisible(false)} style={styles.selClose}>
                            <Text style={styles.selCloseTxt}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* FULL SCREEN CREATE PO MODAL */}
            <Modal visible={createVisible} animationType="slide" transparent={false}>
                <SafeAreaView style={styles.createMain}>
                    <View style={styles.createHeader}>
                        <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.backBtnModal}>
                            <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
                        </TouchableOpacity>
                        <View style={styles.createHeaderText}>
                            <Text style={styles.createTitle} numberOfLines={2}>Create Purchase Order</Text>
                            <View style={styles.createSubWrap}>
                                <MaterialCommunityIcons name="information-outline" size={14} color="#2563EB" />
                                <Text style={styles.createSub}>Submitting requisition</Text>
                            </View>
                        </View>
                    </View>

                    <KeyboardAvoidingView
                        style={styles.createKeyboard}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
                    >
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.createScroll}
                            keyboardShouldPersistTaps="handled"
                        >
                        {/* BASIC DETAILS */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Basic details</Text>
                            <View style={styles.fieldsStack}>
                                <View style={styles.formField}>
                                    <View style={styles.labelGrp}>
                                        <MaterialCommunityIcons name="office-building-outline" size={16} color="#2563EB" />
                                        <Text style={styles.formLabel}>Project</Text>
                                    </View>
                                    <TouchableOpacity style={styles.modalSelector} onPress={() => setSelProjectVisible(true)} activeOpacity={0.7}>
                                        <Text style={[styles.selText, !formProject && styles.selTextPlaceholder]} numberOfLines={1}>
                                            {formProject?.name || 'Select project'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={22} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.formField}>
                                    <View style={styles.labelGrp}>
                                        <MaterialCommunityIcons name="store-outline" size={16} color="#2563EB" />
                                        <Text style={styles.formLabel}>Vendor name</Text>
                                    </View>
                                    <TextInput
                                        style={styles.formInp}
                                        placeholder="Company or contact name"
                                        placeholderTextColor="#94A3B8"
                                        value={formVendor}
                                        onChangeText={setFormVendor}
                                    />
                                </View>

                                <View style={styles.formField}>
                                    <View style={styles.labelGrp}>
                                        <MaterialCommunityIcons name="email-outline" size={16} color="#2563EB" />
                                        <Text style={styles.formLabel}>Vendor email</Text>
                                    </View>
                                    <TextInput
                                        style={styles.formInp}
                                        placeholder="vendor@example.com"
                                        placeholderTextColor="#94A3B8"
                                        value={formEmail}
                                        onChangeText={setFormEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>

                                <View style={styles.formField}>
                                    <View style={styles.labelGrp}>
                                        <MaterialCommunityIcons name="calendar-outline" size={16} color="#2563EB" />
                                        <Text style={styles.formLabel}>Request date</Text>
                                    </View>
                                    <View style={styles.formInpBox}>
                                        <Text style={styles.inpValTxt}>{new Date().toLocaleDateString()}</Text>
                                        <MaterialCommunityIcons name="calendar-check" size={22} color="#64748B" />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* LINE ITEMS */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitleInline}>Line items</Text>
                                <TouchableOpacity style={styles.btnAddItem} onPress={handleAddItem} activeOpacity={0.7}>
                                    <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#2563EB" />
                                    <Text style={styles.btnAddItemTxt}>Add item</Text>
                                </TouchableOpacity>
                            </View>

                            {items.map((it) => (
                                <View key={it.id} style={styles.lineItemBox}>
                                    <View style={styles.lineItemHeader}>
                                        <TextInput
                                            style={styles.lineItemNameInp}
                                            placeholder="Item name"
                                            placeholderTextColor="#94A3B8"
                                            value={it.itemName}
                                            onChangeText={v => handleUpdateItem(it.id, 'itemName', v)}
                                        />
                                        <TouchableOpacity
                                            style={styles.lineItemRemove}
                                            onPress={() => handleRemoveItem(it.id)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput
                                        style={styles.lineItemDescInp}
                                        placeholder="Description (optional)"
                                        placeholderTextColor="#94A3B8"
                                        value={it.description}
                                        onChangeText={v => handleUpdateItem(it.id, 'description', v)}
                                    />
                                    <View style={styles.lineItemCalcRow}>
                                        <View style={styles.calcBox}>
                                            <Text style={styles.calcLab}>Qty</Text>
                                            <TextInput
                                                keyboardType="decimal-pad"
                                                style={styles.calcInp}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                value={it.quantity}
                                                onChangeText={v => handleUpdateItem(it.id, 'quantity', v)}
                                            />
                                        </View>
                                        <View style={styles.calcBox}>
                                            <Text style={styles.calcLab}>Unit price</Text>
                                            <TextInput
                                                keyboardType="decimal-pad"
                                                style={styles.calcInp}
                                                placeholder="0.00"
                                                placeholderTextColor="#94A3B8"
                                                value={it.unitPrice}
                                                onChangeText={v => handleUpdateItem(it.id, 'unitPrice', v)}
                                            />
                                        </View>
                                        <View style={[styles.calcBox, styles.calcBoxTotal]}>
                                            <Text style={styles.calcLab}>Line total</Text>
                                            <Text style={styles.calcTotalText} numberOfLines={1}>
                                                ${((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* SUMMARY & NOTES */}
                        <View style={styles.sidebarSection}>
                            <View style={[styles.summaryCard, SHADOWS.large]}>
                                <Text style={styles.summaryTitle}>Requisition summary</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLab}>Subtotal</Text>
                                    <Text style={styles.summaryVal}>${poSummary.subtotal.toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLab}>Tax (15%)</Text>
                                    <Text style={styles.summaryVal}>${poSummary.tax.toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryTotalRow}>
                                    <Text style={styles.totalLab}>Estimated total</Text>
                                    <Text style={styles.totalVal}>${poSummary.total.toFixed(2)}</Text>
                                </View>

                                <Text style={styles.summaryTitleNotes}>Notes</Text>
                                <TextInput
                                    style={styles.notesInp}
                                    placeholder="Notes for procurement…"
                                    placeholderTextColor="#64748B"
                                    multiline
                                    value={formNotes}
                                    onChangeText={setFormNotes}
                                />

                                <TouchableOpacity style={styles.btnSubmitFinal} onPress={handleCreatePO} disabled={submitting} activeOpacity={0.85}>
                                    {submitting ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
                                            <Text style={styles.btnSubmitFinalTxt}>Submit requisition</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.discardBtn} activeOpacity={0.7}>
                                    <Text style={styles.discardTxt}>Discard</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>

                {/* Project Select Nested Modal */}
                <Modal visible={selProjectVisible} transparent animationType="fade">
                    <View style={styles.selBack}>
                        <View style={styles.selCard}>
                             <Text style={styles.selTitle}>Selection</Text>
                             <FlatList 
                                data={projects}
                                keyExtractor={p => p._id || p.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.selItem} onPress={() => { setFormProject(item); setSelProjectVisible(false); }}>
                                        <Text style={styles.selItemTxt}>{item.name}</Text>
                                        <MaterialCommunityIcons name="check-circle" size={20} color="#2563EB" />
                                    </TouchableOpacity>
                                )}
                             />
                             <TouchableOpacity onPress={() => setSelProjectVisible(false)} style={styles.selClose}>
                                <Text style={styles.selCloseTxt}>CANCEL</Text>
                             </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    pageHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTextContainer: { flex: 1, marginRight: 12 },
    mainTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    mainSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '800', marginTop: 4 },
    addBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    addBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    filterSection: { paddingHorizontal: 20, marginBottom: 12, gap: 12 },
    searchBox: { height: 52, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 13, fontWeight: '700', color: '#1E293B' },
    toolsRow: { gap: 10, paddingRight: 20 },
    toolBtn: { height: 40, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 8 },
    toolBtnTxt: { fontSize: 10, fontWeight: '900', color: '#64748B' },
    toolBtnIcon: { width: 40, height: 40, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    listArea: { padding: 16, paddingBottom: 100 },
    poCard: { backgroundColor: '#fff', borderRadius: 28, marginBottom: 16, overflow: 'hidden', flexDirection: 'row' },
    statusAccent: { width: 6 },
    poCardInfo: { flex: 1, padding: 20 },
    poCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    poNumWrap: { flexDirection: 'row', gap: 12 },
    hashBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    poNumberTxt: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
    poProjectTxt: { fontSize: 12, fontWeight: '800', color: '#64748B', marginTop: 2, width: 140 },
    poProjectSub: { fontSize: 8, fontWeight: '900', color: '#CBD5E1', letterSpacing: 0.5 },
    vendorWrap: { alignItems: 'flex-end', gap: 6 },
    vendorAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    vendorAvatarTxt: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
    vendorNameTxt: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
    poCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    poAmountWrap: { flex: 1 },
    poAmountLabel: { fontSize: 8, fontWeight: '900', color: '#CBD5E1', letterSpacing: 0.5 },
    poAmountVal: { fontSize: 18, fontWeight: '900' },
    poStatusWrap: { alignItems: 'flex-end', gap: 6 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    statusText: { fontSize: 9, fontWeight: '900' },
    poDateTxt: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
    detailsBtn: { padding: 4, marginLeft: 15 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Modal Create PO
    createMain: { flex: 1, backgroundColor: '#F8FAFC' },
    createKeyboard: { flex: 1 },
    createHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtnModal: { marginRight: 12, padding: 4 },
    createHeaderText: { flex: 1, minWidth: 0 },
    createTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    createSubWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    createSub: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
    createScroll: { padding: 16, paddingBottom: 40 },
    sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 0.8, marginBottom: 14, textTransform: 'uppercase' },
    sectionTitleInline: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
    fieldsStack: { gap: 16 },
    formField: { width: '100%' },
    labelGrp: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    formLabel: { fontSize: 12, fontWeight: '800', color: '#475569' },
    modalSelector: {
        minHeight: 48,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A', marginRight: 8 },
    selTextPlaceholder: { color: '#94A3B8', fontWeight: '600' },
    formInp: {
        minHeight: 48,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    formInpBox: {
        minHeight: 48,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inpValTxt: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    btnAddItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
    btnAddItemTxt: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
    lineItemBox: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    lineItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    lineItemNameInp: {
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    lineItemRemove: { padding: 4 },
    lineItemDescInp: {
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 14,
        color: '#475569',
        fontWeight: '600',
        marginBottom: 12,
        textAlignVertical: 'top',
    },
    lineItemCalcRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    calcBox: { flex: 1, minWidth: 0 },
    calcBoxTotal: { alignItems: 'flex-end' },
    calcLab: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
    calcInp: {
        width: '100%',
        minHeight: 44,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    calcTotalText: { fontSize: 15, fontWeight: '900', color: '#0F172A', paddingVertical: 10, paddingHorizontal: 4 },
    sidebarSection: { marginBottom: 24 },
    summaryCard: { backgroundColor: '#0F172A', borderRadius: 20, padding: 20 },
    summaryTitle: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 16, textTransform: 'uppercase' },
    summaryTitleNotes: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    summaryLab: { fontSize: 14, color: '#E2E8F0', fontWeight: '600' },
    summaryVal: { fontSize: 14, color: '#F8FAFC', fontWeight: '800' },
    summaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.35)',
    },
    totalLab: { fontSize: 12, fontWeight: '900', color: '#93C5FD', letterSpacing: 0.5 },
    totalVal: { fontSize: 22, fontWeight: '900', color: '#60A5FA' },
    notesInp: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 100,
        fontSize: 14,
        color: '#F8FAFC',
        marginBottom: 20,
        textAlignVertical: 'top',
    },
    btnSubmitFinal: {
        backgroundColor: '#2563EB',
        minHeight: 52,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    btnSubmitFinalTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
    discardBtn: { alignItems: 'center', paddingVertical: 14 },
    discardTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
    selBack: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 25 },
    selCard: { backgroundColor: '#fff', borderRadius: 32, padding: 25, maxHeight: '60%' },
    selTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 20 },
    selItem: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selItemTxt: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    selClose: { marginTop: 20, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 16 },
    selCloseTxt: { color: '#64748B', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});

export default PurchaseOrdersScreen;
