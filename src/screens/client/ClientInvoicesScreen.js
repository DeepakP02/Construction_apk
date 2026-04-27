import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Dimensions, ActivityIndicator, StatusBar, RefreshControl, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const ClientInvoicesScreen = ({ navigation }) => {
    const { projects } = useApp();
    const insets = useSafeAreaInsets();

    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Fetch invoices from backend — same API as web software (/invoices)
    const fetchInvoices = useCallback(async () => {
        try {
            const res = await api.get('/invoices');
            setInvoices(res.data || []);
        } catch (e) {
            console.error('Fetch invoices error:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchInvoices();
    }, [fetchInvoices]);

    // Total Outstanding — same logic as web software
    const totalOutstanding = invoices
        .filter(i => i.status !== 'paid')
        .reduce((acc, i) => acc + (i.totalAmount || 0), 0);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return `$${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
    };

    const getStatusConfig = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'paid':
                return { bg: '#ECFDF5', color: '#10B981', border: '#D1FAE5', label: 'Paid', icon: 'check-circle' };
            case 'overdue':
                return { bg: '#FEF2F2', color: '#EF4444', border: '#FEE2E2', label: 'Overdue', icon: 'alert-circle' };
            case 'sent':
                return { bg: '#EFF6FF', color: '#3B82F6', border: '#DBEAFE', label: 'Sent', icon: 'send' };
            case 'draft':
                return { bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0', label: 'Draft', icon: 'file-document-edit-outline' };
            default:
                return { bg: '#FFFBEB', color: '#F59E0B', border: '#FEF3C7', label: 'Unpaid', icon: 'clock-alert-outline' };
        }
    };

    // Render invoice card — mobile-optimized version of web table row
    const renderInvoiceCard = ({ item }) => {
        const statusConfig = getStatusConfig(item.status);
        const projectName = item.projectId?.name || '---';
        const invoiceId = item.invoiceNumber || item._id?.slice(-8) || '---';
        const clientName = item.clientId?.fullName || '';
        const dueDate = item.dueDate ? formatDate(item.dueDate) : null;

        return (
            <TouchableOpacity
                style={[styles.invoiceCard, SHADOWS.small]}
                activeOpacity={0.85}
                onPress={() => setSelectedInvoice(selectedInvoice?._id === item._id ? null : item)}
            >
                {/* Status Strip */}
                <View style={[styles.statusStrip, { backgroundColor: statusConfig.color }]} />

                <View style={styles.cardBody}>
                    {/* Top Row: Invoice ID + Status */}
                    <View style={styles.cardTopRow}>
                        <View style={styles.invoiceIdWrap}>
                            <MaterialCommunityIcons name="receipt" size={14} color="#3B82F6" />
                            <Text style={styles.invoiceId}>#{invoiceId}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                            <MaterialCommunityIcons name={statusConfig.icon} size={12} color={statusConfig.color} />
                            <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </Text>
                        </View>
                    </View>

                    {/* Project Name */}
                    <Text style={styles.projectName} numberOfLines={1}>{projectName}</Text>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Info Grid — all fields from web */}
                    <View style={styles.infoGrid}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>DATE</Text>
                            <Text style={styles.infoVal}>{formatDate(item.createdAt)}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>AMOUNT</Text>
                            <Text style={[styles.infoVal, styles.amountText]}>{formatCurrency(item.totalAmount)}</Text>
                        </View>
                        {dueDate && (
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>DUE DATE</Text>
                                <Text style={styles.infoVal}>{dueDate}</Text>
                            </View>
                        )}
                        {clientName ? (
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>CLIENT</Text>
                                <Text style={styles.infoVal} numberOfLines={1}>{clientName}</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Expanded Detail — items breakdown */}
                    {selectedInvoice?._id === item._id && (item.items || []).length > 0 && (
                        <View style={styles.itemsExpanded}>
                            <Text style={styles.itemsHeader}>LINE ITEMS</Text>
                            {(item.items || []).map((lineItem, idx) => (
                                <View key={idx} style={styles.lineItemRow}>
                                    <View style={styles.lineItemLeft}>
                                        <Text style={styles.lineItemDesc} numberOfLines={1}>
                                            {lineItem.description || 'Item'}
                                        </Text>
                                        <Text style={styles.lineItemMeta}>
                                            Qty: {lineItem.quantity || 1} × ${(lineItem.unitPrice || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.lineItemTotal}>
                                        ${(lineItem.total || 0).toLocaleString()}
                                    </Text>
                                </View>
                            ))}
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>TOTAL</Text>
                                <Text style={styles.totalValue}>{formatCurrency(item.totalAmount)}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // LOADING STATE
    if (loading) {
        return (
            <View style={styles.screen}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <WorkerHeader title="Invoices" hideSearch />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>LOADING INVOICES...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Invoices" hideSearch />

            {/* Page Header — matching web */}
            <View style={styles.pageHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.pageTitle}>Invoices & Payments</Text>
                    <Text style={styles.pageSubtitle}>
                        View and manage your project billing history.
                    </Text>
                </View>
                <View style={[styles.outstandingCard, SHADOWS.small]}>
                    <Text style={styles.outstandingLabel}>TOTAL OUTSTANDING</Text>
                    <Text style={styles.outstandingValue}>{formatCurrency(totalOutstanding)}</Text>
                </View>
            </View>

            {/* Table Header — matching web column labels */}
            <View style={styles.tableHeader}>
                <Text style={[styles.thText, { flex: 1.2 }]}>INVOICE ID</Text>
                <Text style={[styles.thText, { flex: 1 }]}>PROJECT</Text>
                <Text style={[styles.thText, { flex: 0.8, textAlign: 'center' }]}>STATUS</Text>
            </View>

            {/* Invoice List */}
            <FlatList
                data={invoices}
                keyExtractor={(item) => item._id || item.id}
                renderItem={renderInvoiceCard}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
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
                        <MaterialCommunityIcons name="file-document-outline" size={64} color="#E2E8F0" />
                        <Text style={styles.emptyTitle}>No invoices found.</Text>
                        <Text style={styles.emptySubtitle}>
                            Invoices will appear here when created by your project manager.
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F8FAFC' },

    // Loading
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 2 },

    // Page Header — matching web's layout
    pageHeader: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerLeft: { flex: 1, marginRight: 12 },
    pageTitle: {
        fontSize: isSmallDevice ? 18 : 20,
        fontWeight: '950',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    pageSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 4,
    },
    outstandingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignItems: 'flex-end',
    },
    outstandingLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 2,
    },
    outstandingValue: {
        fontSize: 20,
        fontWeight: '950',
        color: '#0F172A',
        letterSpacing: -1,
    },

    // Table Header — matching web's column header row
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    thText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    // List
    listContent: { paddingHorizontal: 12, paddingTop: 8 },

    // Invoice Card — mobile card version of web table row
    invoiceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 10,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    statusStrip: { width: 4 },
    cardBody: { flex: 1, padding: 16 },

    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    invoiceIdWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    invoiceId: {
        fontSize: 13,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: 0.3,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'capitalize',
    },

    projectName: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 10,
        letterSpacing: -0.3,
    },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },

    // Info Grid — DATE, AMOUNT, DUE DATE, CLIENT
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    infoCol: { minWidth: '40%' },
    infoLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 3,
        textTransform: 'uppercase',
    },
    infoVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1E293B',
    },
    amountText: {
        color: '#0F172A',
        fontWeight: '950',
        fontSize: 15,
    },

    // Expanded Line Items
    itemsExpanded: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    itemsHeader: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1.5,
        marginBottom: 10,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    lineItemLeft: { flex: 1, marginRight: 12 },
    lineItemDesc: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    lineItemMeta: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
    lineItemTotal: { fontSize: 13, fontWeight: '900', color: '#0F172A' },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1.5,
        borderTopColor: '#E2E8F0',
    },
    totalLabel: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
    totalValue: { fontSize: 18, fontWeight: '950', color: '#2563EB', letterSpacing: -0.5 },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#94A3B8',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#CBD5E1',
        marginTop: 8,
        textAlign: 'center',
    },
});

export default ClientInvoicesScreen;
