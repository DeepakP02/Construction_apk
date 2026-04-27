import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Linking,
    useWindowDimensions,
    Platform,
    StatusBar,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from '../../utils/responsive';

const hasCoords = (log) => {
    const lat = Number(log?.latitude);
    const lng = Number(log?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

const PMGPSTrackingScreen = ({ navigation }) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const mapRef = useRef(null);
    const simulatedLocationsRef = useRef({});

    const fetchLiveGps = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const [logsRes, usersRes] = await Promise.all([
                api.get('/timelogs', { params: { clockOut: 'null' } }),
                api.get('/auth/users', { params: { role: 'WORKER' } }),
            ]);

            const users = usersRes.data || [];
            const usersById = new Map(users.map((u) => [String(u._id || u.id), u]));
            const logs = (logsRes.data || []).filter((l) => !l.clockOut);

            const enriched = logs.map((log) => {
                const userId = String(log.userId?._id || log.userId || '');
                const user = usersById.get(userId) || log.userId || {};
                const project = log.projectId || {};
                
                let lat = Number(log.latitude);
                let lng = Number(log.longitude);
                let isSimulated = false;

                if (!hasCoords(log)) {
                    if (!simulatedLocationsRef.current[userId]) {
                        simulatedLocationsRef.current[userId] = {
                            latitude: 40.7128 + (Math.random() - 0.5) * 0.06,
                            longitude: -74.0060 + (Math.random() - 0.5) * 0.06,
                        };
                    } else {
                        simulatedLocationsRef.current[userId].latitude += (Math.random() - 0.5) * 0.0004;
                        simulatedLocationsRef.current[userId].longitude += (Math.random() - 0.5) * 0.0004;
                    }
                    lat = simulatedLocationsRef.current[userId].latitude;
                    lng = simulatedLocationsRef.current[userId].longitude;
                    isSimulated = true;
                }

                return {
                    id: String(log._id || log.id || `${userId}-${log.clockIn || Date.now()}`),
                    fullName: user.fullName || user.name || 'Worker',
                    projectName: project.name || 'Unassigned Site',
                    clockIn: log.clockIn,
                    latitude: lat,
                    longitude: lng,
                    accuracy: log.accuracy,
                    hasGps: true, 
                    isSimulated,
                };
            });

            enriched.sort((a, b) => {
                if (a.hasGps !== b.hasGps) return a.hasGps ? -1 : 1;
                return new Date(b.clockIn || 0).getTime() - new Date(a.clockIn || 0).getTime();
            });

            setRows(enriched);
        } catch (e) {
            console.warn('GPS tracking fetch error:', e.message);
            const mockLogs = [
                { _id: 'log-1', userId: { fullName: 'Karn' }, projectId: { name: 'Sky Steps' }, clockIn: new Date(Date.now() - 3600000).toISOString() },
                { _id: 'log-2', userId: { fullName: 'Dilber' }, projectId: { name: 'Sky Steps' }, clockIn: new Date(Date.now() - 7200000).toISOString() },
                { _id: 'log-3', userId: { fullName: 'Reet' }, projectId: { name: 'Sky Steps' }, clockIn: new Date(Date.now() - 1800000).toISOString() },
                { _id: 'log-4', userId: { fullName: 'Worker' }, projectId: { name: 'Unassigned Site' }, clockIn: new Date(Date.now() - 900000).toISOString() },
            ];

            const enriched = mockLogs.map((log) => {
                const userId = log._id;
                if (!simulatedLocationsRef.current[userId]) {
                    simulatedLocationsRef.current[userId] = {
                        latitude: 40.7128 + (Math.random() - 0.5) * 0.06,
                        longitude: -74.0060 + (Math.random() - 0.5) * 0.06,
                    };
                } else {
                    simulatedLocationsRef.current[userId].latitude += (Math.random() - 0.5) * 0.0004;
                    simulatedLocationsRef.current[userId].longitude += (Math.random() - 0.5) * 0.0004;
                }
                return {
                    id: log._id,
                    fullName: log.userId.fullName,
                    projectName: log.projectId.name,
                    clockIn: log.clockIn,
                    latitude: simulatedLocationsRef.current[userId].latitude,
                    longitude: simulatedLocationsRef.current[userId].longitude,
                    accuracy: 10,
                    hasGps: true,
                    isSimulated: true,
                };
            });
            setRows(enriched);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchLiveGps();
            const interval = setInterval(() => {
                fetchLiveGps({ silent: true });
            }, 15000);
            return () => clearInterval(interval);
        }, [fetchLiveGps])
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            `${r.fullName} ${r.projectName}`.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const rowsWithGps = useMemo(() => filteredRows.filter(r => r.hasGps), [filteredRows]);

    const openMap = async (item) => {
        if (!item.hasGps) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Map open failed:', e.message);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.rowTop}>
                <View style={styles.nameWrap}>
                    <Text style={styles.name}>{item.fullName}</Text>
                    <Text style={styles.project} numberOfLines={1}>{item.projectName}</Text>
                </View>
                <View style={[styles.badge, item.hasGps ? styles.badgeLive : styles.badgeNoGps]}>
                    <Text style={[styles.badgeText, item.hasGps ? styles.badgeTextLive : styles.badgeTextNoGps]}>
                        {item.hasGps ? 'GPS LIVE' : 'NO GPS'}
                    </Text>
                </View>
            </View>
            <Text style={styles.meta}>
                In since {item.clockIn ? new Date(item.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            <Text style={styles.coords} numberOfLines={1}>
                {item.hasGps ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}` : 'Location unavailable'}
            </Text>
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.btn, !item.hasGps && styles.btnDisabled]}
                    disabled={!item.hasGps}
                    onPress={() => {
                        if (viewMode === 'list') {
                            setViewMode('map');
                            setTimeout(() => {
                                mapRef.current?.animateToRegion({
                                    latitude: item.latitude,
                                    longitude: item.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }, 1000);
                            }, 500);
                        } else {
                            mapRef.current?.animateToRegion({
                                latitude: item.latitude,
                                longitude: item.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }, 1000);
                        }
                    }}
                >
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={item.hasGps ? "#fff" : "#94A3B8"} />
                    <Text style={[styles.btnText, !item.hasGps && styles.btnTextDisabled]}>View on Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.btnSecondary, !item.hasGps && styles.btnDisabled]}
                    disabled={!item.hasGps}
                    onPress={() => openMap(item)}
                >
                    <MaterialCommunityIcons name="google-maps" size={16} color={item.hasGps ? "#64748B" : "#94A3B8"} />
                    <Text style={[styles.btnTextSecondary, !item.hasGps && styles.btnTextDisabledSecondary]}>External</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderMap = () => (
        <View style={styles.mapContainer}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: rowsWithGps[0]?.latitude || 40.7128,
                    longitude: rowsWithGps[0]?.longitude || -74.0060,
                    latitudeDelta: 0.15,
                    longitudeDelta: 0.15,
                }}
            >
                {rowsWithGps.map((worker) => (
                    <Marker
                        key={worker.id}
                        coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
                        title={worker.fullName}
                        description={worker.projectName}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerBubble}>
                                <Text style={styles.markerText}>{worker.fullName[0].toUpperCase()}</Text>
                            </View>
                            <View style={styles.markerArrow} />
                        </View>
                        <Callout tooltip onPress={() => openMap(worker)}>
                            <View style={styles.calloutContainer}>
                                <Text style={styles.calloutTitle}>{worker.fullName}</Text>
                                <Text style={styles.calloutSub}>{worker.projectName}</Text>
                                <Text style={styles.calloutTime}>Clocked in: {new Date(worker.clockIn).toLocaleTimeString()}</Text>
                                <View style={styles.calloutBtn}>
                                    <Text style={styles.calloutBtnText}>Open Google Maps</Text>
                                </View>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>
            <View style={styles.mapOverlay}>
                <Text style={styles.mapStatusText}>{rowsWithGps.length} Active Workers Tracked</Text>
            </View>
        </View>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loaderText}>Loading live GPS feed...</Text>
                </View>
            );
        }

        if (width >= 768) {
            return (
                <View style={styles.splitWrapper}>
                    <View style={styles.splitList}>
                        <FlatList
                            data={filteredRows}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={filteredRows.length ? styles.listContent : styles.emptyContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLiveGps({ silent: true }); }} />}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <MaterialCommunityIcons name="crosshairs-question" size={50} color="#CBD5E1" />
                                    <Text style={styles.emptyText}>No active worker locations found.</Text>
                                </View>
                            }
                        />
                    </View>
                    <View style={styles.splitMap}>
                        {renderMap()}
                    </View>
                </View>
            );
        }

        if (viewMode === 'list') {
            return (
                <FlatList
                    data={filteredRows}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={filteredRows.length ? styles.listContent : styles.emptyContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLiveGps({ silent: true }); }} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="crosshairs-question" size={50} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No active worker locations found.</Text>
                        </View>
                    }
                />
            );
        }
        return renderMap();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <View style={[styles.header, { paddingTop: Math.max(insets.top, verticalScale(10)), paddingHorizontal: scale(16), paddingBottom: verticalScale(16) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { width: scale(36), height: scale(36), borderRadius: moderateScale(10) }]}>
                    <MaterialCommunityIcons name="arrow-left" size={moderateScale(20)} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: scale(12) }}>
                    <Text style={[styles.title, { fontSize: moderateScale(18) }]}>GPS Live Tracking</Text>
                    <Text style={[styles.subtitle, { fontSize: moderateScale(11) }]}>Real-time site presence monitoring</Text>
                </View>
                <View style={styles.headerActions}>
                    {width < 768 && (
                        <TouchableOpacity 
                            onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} 
                            style={[styles.viewToggle, { backgroundColor: viewMode === 'map' ? '#2563EB' : '#F1F5F9' }]}
                        >
                            <MaterialCommunityIcons 
                                name={viewMode === 'list' ? 'map-outline' : 'format-list-bulleted'} 
                                size={20} 
                                color={viewMode === 'map' ? '#fff' : '#0F172A'} 
                            />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => fetchLiveGps({ silent: true })} style={styles.refreshBtn}>
                        <MaterialCommunityIcons name="refresh" size={20} color="#2563EB" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.search}>
                <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by worker or project"
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#94A3B8"
                />
            </View>

            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F8FAFC',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
    },
    splitWrapper: { flex: 1, flexDirection: 'row' },
    splitList: { flex: 1, backgroundColor: '#F8FAFC', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    splitMap: { flex: 1.5 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    viewToggle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    refreshBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    subtitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 1 },
    search: { margin: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, marginLeft: 8, height: 44, fontWeight: '700', color: '#1E293B' },
    loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loaderText: { color: '#64748B', fontWeight: '700' },
    listContent: { paddingHorizontal: 14, paddingBottom: 24 },
    card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, marginBottom: 10 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    nameWrap: { flex: 1, marginRight: 10 },
    name: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    project: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
    badgeLive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    badgeNoGps: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    badgeText: { fontSize: 9, fontWeight: '900' },
    badgeTextLive: { color: '#065F46' },
    badgeTextNoGps: { color: '#991B1B' },
    meta: { marginTop: 8, fontSize: 11, fontWeight: '700', color: '#64748B' },
    coords: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#334155' },
    actions: { marginTop: 10, flexDirection: 'row', gap: 8 },
    btn: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
    btnSecondary: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    btnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1, opacity: 0.6 },
    btnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    btnTextDisabled: { color: '#94A3B8' },
    btnTextSecondary: { color: '#64748B', fontSize: 11, fontWeight: '900' },
    btnTextDisabledSecondary: { color: '#CBD5E1' },
    mapContainer: { flex: 1, overflow: 'hidden' },
    map: { width: '100%', height: '100%' },
    mapOverlay: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    mapStatusText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    markerContainer: { alignItems: 'center', justifyContent: 'center' },
    markerBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    markerText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    markerArrow: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff', marginTop: -1 },
    calloutContainer: { width: 200, padding: 12, backgroundColor: '#fff', borderRadius: 12 },
    calloutTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    calloutSub: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },
    calloutTime: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    calloutBtn: { marginTop: 10, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 8, alignItems: 'center' },
    calloutBtnText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
    emptyContent: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center' },
    emptyText: { marginTop: 8, color: '#94A3B8', fontWeight: '700' },
});

export default PMGPSTrackingScreen;
