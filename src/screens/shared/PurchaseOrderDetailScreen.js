import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import WorkerHeader from '../../components/WorkerHeader';
import api from '../../utils/api';

const fmtMoney = (n) => {
    const x = typeof n === 'number' ? n : parseFloat(n);
    if (Number.isNaN(x)) return '0.00';
    return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PurchaseOrderDetailScreen = ({ navigation, route }) => {
    const poId = route.params?.poId;
    const [po, setPo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!poId) {
            setError('Missing purchase order id');
            setLoading(false);
            return;
        }
        try {
            setError(null);
            const res = await api.get(`/purchase-orders/${poId}`);
            setPo(res.data);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Failed to load purchase order');
            setPo(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [poId]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const projectName =
        (typeof po?.projectId === 'object' && po?.projectId?.name) ||
        po?.projectName ||
        '—';
    const vendorDisplay = po?.vendorName || (typeof po?.vendorId === 'object' ? po?.vendorId?.name : null) || '—';
    const jobName =
        (typeof po?.jobId === 'object' && po?.jobId?.name) ||
        po?.jobName ||
        '—';
    const createdBy =
        (typeof po?.createdBy === 'object' && (po?.createdBy?.fullName || po?.createdBy?.name)) || '—';

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader
                title={po?.poNumber || 'Purchase order'}
                showBranding
                showBack
                hideSearch
            />

            {loading && !po ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : error && !po ? (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.hero}>
                        <View style={styles.heroTop}>
                            <Text style={styles.poNum}>{po?.poNumber || '—'}</Text>
                            <View style={styles.statusPill}>
                                <Text style={styles.statusTxt}>{(po?.status || '—').toUpperCase()}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroSub}>{projectName}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Vendor</Text>
                        <Row icon="store-outline" label="Name" value={vendorDisplay} />
                        <Row icon="email-outline" label="Email" value={po?.vendorEmail || '—'} />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Basic details</Text>
                        <Row icon="briefcase-outline" label="Project" value={projectName} />
                        <Row icon="hammer-wrench" label="Job (optional)" value={jobName} />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Timeline</Text>
                        <Row
                            icon="calendar-outline"
                            label="Created"
                            value={po?.createdAt ? new Date(po.createdAt).toLocaleString() : '—'}
                        />
                        <Row
                            icon="truck-delivery-outline"
                            label="Expected delivery"
                            value={po?.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'}
                        />
                        <Row icon="account-outline" label="Created by" value={createdBy} />
                    </View>

                    {Array.isArray(po?.items) && po.items.length > 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Line items</Text>
                            {po.items.map((line, i) => (
                                <View key={line._id || i} style={styles.lineRow}>
                                    <View style={styles.lineMain}>
                                        <Text style={styles.lineName}>{line.itemName || 'Item'}</Text>
                                        {line.description ? (
                                            <Text style={styles.lineDesc} numberOfLines={3}>
                                                {line.description}
                                            </Text>
                                        ) : null}
                                        <Text style={styles.lineMeta}>
                                            Qty {line.quantity ?? '—'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {(po?.notesToVendor || po?.internalNotes) ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Quick notes</Text>
                            {po.notesToVendor ? (
                                <View style={styles.noteBlock}>
                                    <Text style={styles.noteLabel}>To vendor</Text>
                                    <Text style={styles.noteBody}>{po.notesToVendor}</Text>
                                </View>
                            ) : null}
                            {po.internalNotes ? (
                                <View style={styles.noteBlock}>
                                    <Text style={styles.noteLabel}>Internal</Text>
                                    <Text style={styles.noteBody}>{po.internalNotes}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    <View style={{ height: 32 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

function Row({ icon, label, value }) {
    return (
        <View style={styles.row}>
            <MaterialCommunityIcons name={icon} size={18} color="#64748B" style={styles.rowIcon} />
            <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { marginTop: 12, fontSize: 14, fontWeight: '600', color: '#64748B', textAlign: 'center' },
    hero: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    poNum: { fontSize: 20, fontWeight: '900', color: '#0F172A', flex: 1, marginRight: 12 },
    statusPill: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusTxt: { fontSize: 10, fontWeight: '900', color: '#2563EB' },
    heroSub: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.6,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    rowIcon: { marginTop: 2, marginRight: 10 },
    rowText: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 2 },
    rowValue: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    lineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    lineMain: { flex: 1, marginRight: 12, minWidth: 0 },
    lineName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    lineDesc: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600' },
    lineMeta: { fontSize: 12, color: '#94A3B8', marginTop: 6, fontWeight: '700' },
    noteBlock: { marginBottom: 12 },
    noteLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
    noteBody: { fontSize: 14, color: '#475569', fontWeight: '600', lineHeight: 20 },
});

export default PurchaseOrderDetailScreen;
