import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, ActivityIndicator, Alert, ScrollView, Modal, KeyboardAvoidingView, Platform, SafeAreaView, useWindowDimensions, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { isTodoVisibleToUser } from '../../utils/todoVisibility';

const ProjectManagerDashboard = ({ navigation }) => {
    const { refreshData, teamMembers, user, todos, fetchTeamMembers, addTodo, resolveUser } = useApp();
    const { width, height } = useWindowDimensions();
    const [todo, setTodo] = useState('');
    const [assignedTo, setAssignedTo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUserSelectorVisible, setIsUserSelectorVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                refreshData(),
                fetchTeamMembers()
            ]);
        } catch (err) {
            console.error('Error refreshing dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', fetchDashboardData);
        fetchDashboardData();
        return unsubscribe;
    }, [navigation]);

    const handleAddTodo = async () => {
        if (!todo.trim()) return;
        try {
            setSubmitting(true);
            const success = await addTodo({
                title: todo.trim(),
                assignedTo: assignedTo?._id || assignedTo?.id,
                priority: 'Medium',
                status: 'pending'
            });

            if (success) {
                setTodo('');
                setAssignedTo(null);
                setSearchTerm('');
            } else {
                Alert.alert('Error', 'Failed to create task. Check required fields.');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const myDailyTodos = (todos || []).filter(t => isTodoVisibleToUser(t, user));

    const assignedByMe = (todos || []).filter(t => {
        const assignerId = typeof t.assignedBy === 'object' ? (t.assignedBy?._id || t.assignedBy?.id) : t.assignedBy;
        const assignedId = typeof t.assignedTo === 'object' ? (t.assignedTo?._id || t.assignedTo?.id) : t.assignedTo;
        return assignerId === user?._id && assignedId !== user?._id;
    });

    return (
        <View style={styles.container}>
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? '10%' : moderateScale(16) }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { fontSize: moderateScale(32) }]}>Dashboard</Text>
                    <Text style={[styles.headerSubtitle, { fontSize: moderateScale(13) }]} numberOfLines={1}>Own Your Time. Control Your Site.</Text>
                </View>

                {/* Quick Actions Grid */}
                <Text style={[styles.sectionTitle, { fontSize: moderateScale(10) }]}>QUICK ACTIONS</Text>
                <View style={styles.grid}>
                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#6366F1' }]} onPress={() => navigation.navigate('CrewClock')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="account-clock" size={moderateScale(16)} color="#6366F1" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Clock In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#F59E0B' }]} onPress={() => navigation.navigate('DailyLogs')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="clipboard-text" size={moderateScale(16)} color="#F59E0B" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Add Log</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#10B981' }]} onPress={() => navigation.navigate('Photos')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="camera" size={moderateScale(16)} color="#10B981" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Photos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#3B82F6' }]} onPress={() => navigation.navigate('Drawings')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="drawing" size={moderateScale(16)} color="#3B82F6" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Drawings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#3B82F6' }]} onPress={() => navigation.navigate('Tasks')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="calendar-check" size={moderateScale(16)} color="#3B82F6" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Tasks</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#8B5CF6' }]} onPress={() => navigation.navigate('PMGPSTracking')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="map-marker-path" size={moderateScale(16)} color="#8B5CF6" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Live Map</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, { borderLeftColor: '#EF4444' }]} onPress={() => navigation.navigate('PurchaseOrders')}>
                        <View style={[styles.cardIconBox, { width: scale(28), height: scale(28), borderRadius: moderateScale(8) }]}><MaterialCommunityIcons name="receipt" size={moderateScale(16)} color="#EF4444" /></View>
                        <Text style={[styles.cardLabel, { fontSize: moderateScale(11) }]} numberOfLines={1}>Orders</Text>
                    </TouchableOpacity>
                </View>

                {/* DAILY QUICK TO-DO */}
                <View style={[styles.premiumWidget, { padding: moderateScale(14), borderRadius: moderateScale(16) }]}>
                    <View style={styles.widgetHeaderRow}>
                        <View style={styles.widgetTitleWrap}>
                            <View style={[styles.iconCircle, { width: scale(28), height: scale(28), borderRadius: scale(14) }]}><MaterialCommunityIcons name="lightning-bolt" size={moderateScale(16)} color="#4F46E5" /></View>
                            <Text style={[styles.widgetTitle, { fontSize: moderateScale(16) }]}>Daily Quick To-Do</Text>
                        </View>
                        <MaterialCommunityIcons name="dots-vertical" size={moderateScale(20)} color="#94A3B8" />
                    </View>

                    <View style={styles.widgetContent}>
                        <View style={styles.inputFieldWrap}>
                            <Text style={[styles.fieldLabel, { fontSize: moderateScale(9) }]}>Task Description</Text>
                            <View style={[styles.textInputBox, { borderRadius: moderateScale(12) }]}>
                                <TextInput 
                                    style={[styles.mainInput, { fontSize: moderateScale(13) }]}
                                    placeholder="e.g. Pick up supplies from the warehouse and deliver to main site..."
                                    placeholderTextColor="#94A3B8"
                                    value={todo}
                                    onChangeText={setTodo}
                                    multiline={true}
                                    numberOfLines={5}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        <View style={styles.inputFieldWrap}>
                            <Text style={[styles.fieldLabel, { fontSize: moderateScale(9) }]}>Assign To User</Text>
                            <TouchableOpacity 
                                style={[styles.selectorBox, isUserSelectorVisible && styles.selectorBoxActive, { height: verticalScale(44), borderRadius: moderateScale(12) }]} 
                                onPress={() => setIsUserSelectorVisible(true)}
                            >
                                <View style={styles.selectorLeft}>
                                    <View style={[styles.tinyAvatar, !assignedTo && { backgroundColor: '#F1F5F9' }, { width: scale(26), height: scale(26), borderRadius: scale(13) }]}>
                                        {assignedTo ? (
                                            <Text style={[styles.tinyAvatarTxt, { fontSize: moderateScale(11) }]}>{(assignedTo.fullName || assignedTo.name || 'U')[0]}</Text>
                                        ) : (
                                            <MaterialCommunityIcons name="account-plus" size={moderateScale(14)} color="#94A3B8" />
                                        )}
                                    </View>
                                    <Text style={[styles.selectorValue, !assignedTo && { color: '#94A3B8' }, { fontSize: moderateScale(13) }]}>
                                        {assignedTo ? assignedTo.fullName : 'Search user...'}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-down" size={moderateScale(20)} color="#6366F1" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[styles.launchBtn, (!todo.trim()) && styles.launchBtnDisabled, { height: verticalScale(50), borderRadius: moderateScale(14) }]} 
                            onPress={handleAddTodo}
                            disabled={submitting || !todo.trim()}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={[styles.launchBtnText, { fontSize: moderateScale(14) }]}>Assign Item</Text>
                                    <MaterialCommunityIcons name="send" size={moderateScale(16)} color="#fff" style={{ marginLeft: scale(8) }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* My Daily Todos */}
                <View style={[styles.listHeader, { marginTop: verticalScale(10) }]}>
                    <Text style={[styles.listTitleText, { fontSize: moderateScale(15) }]}>My Daily Todos</Text>
                    <View style={[styles.countBadge, { borderRadius: moderateScale(8) }]}><Text style={[styles.countText, { fontSize: moderateScale(11) }]}>{myDailyTodos.length}</Text></View>
                </View>
                {myDailyTodos.length === 0 ? (
                    <View style={[styles.emptyState, { borderRadius: moderateScale(12) }]}><Text style={[styles.emptyText, { fontSize: moderateScale(12) }]}>No pending todos</Text></View>
                ) : (
                    <View style={styles.grid}>
                        {myDailyTodos.map((item, index) => (
                            <View key={item._id ? `todo-${item._id}-${index}` : `todo-idx-${index}`} style={[styles.miniCard, { borderLeftColor: '#10B981', borderRadius: moderateScale(14), padding: moderateScale(10) }]}>
                                <View style={[styles.miniIconBox, { backgroundColor: '#ECFDF5', width: scale(30), height: scale(30), borderRadius: moderateScale(8) }]}>
                                    <MaterialCommunityIcons name="check-circle-outline" size={moderateScale(14)} color="#10B981" />
                                </View>
                                <Text style={[styles.miniText, { fontSize: moderateScale(11) }]} numberOfLines={1}>{item.title}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Assigned By Me */}
                <View style={[styles.listHeader, { marginTop: verticalScale(15) }]}>
                    <Text style={[styles.listTitleText, { fontSize: moderateScale(15) }]}>Assigned By Me</Text>
                    <View style={[styles.countBadge, { backgroundColor: '#EEF2FF', borderRadius: moderateScale(8) }]}><Text style={[styles.countText, { color: '#4F46E5', fontSize: moderateScale(11) }]}>{assignedByMe.length}</Text></View>
                </View>
                {assignedByMe.length === 0 ? (
                    <View style={[styles.emptyState, { borderRadius: moderateScale(12) }]}><Text style={[styles.emptyText, { fontSize: moderateScale(12) }]}>Nothing assigned</Text></View>
                ) : (
                    <View style={styles.grid}>
                        {assignedByMe.map((item, index) => (
                            <View key={item._id || `assigned-${index}`} style={[styles.miniCard, { flexDirection: 'column', alignItems: 'flex-start', gap: verticalScale(6), borderLeftColor: '#4F46E5', borderRadius: moderateScale(14), padding: moderateScale(10) }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                                    <View style={[styles.miniIconBox, { backgroundColor: '#EEF2FF', width: scale(24), height: scale(24), borderRadius: moderateScale(6) }]}>
                                        <MaterialCommunityIcons name="account-arrow-right-outline" size={moderateScale(12)} color="#4F46E5" />
                                    </View>
                                    <Text style={[styles.miniLabel, { fontSize: moderateScale(8) }]} numberOfLines={1}>
                                        {resolveUser(item.assignedTo).fullName}
                                    </Text>
                                </View>
                                <Text style={[styles.miniTitle, { fontSize: moderateScale(12) }]} numberOfLines={1}>{item.title}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: verticalScale(20) }} />
            </ScrollView>

            <Modal
                visible={isUserSelectorVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsUserSelectorVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={[styles.modalContent, { maxWidth: 600, alignSelf: 'center', width: '100%', borderTopLeftRadius: moderateScale(30), borderTopRightRadius: moderateScale(30) }]}>
                        <View style={[styles.modalHeader, { marginBottom: verticalScale(20) }]}>
                            <TouchableOpacity onPress={() => setIsUserSelectorVisible(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#0F172A" />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(18) }]}>Assign To Team Member</Text>
                            <View style={{ width: scale(24) }} />
                        </View>

                        <View style={[styles.modalSearchBox, { borderRadius: moderateScale(15), height: verticalScale(50), marginBottom: verticalScale(15) }]}>
                            <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                            <TextInput 
                                style={[styles.modalSearchInput, { fontSize: moderateScale(15) }]}
                                placeholder="Search by name or role..."
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                autoFocus
                            />
                        </View>

                        <FlatList
                            data={(teamMembers || []).filter(u => 
                                (u.fullName || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
                            )}
                            keyExtractor={(u, index) => u._id || `user-${index}`}
                            style={styles.modalList}
                            keyboardShouldPersistTaps="always"
                            renderItem={({ item: u, index }) => (
                                <TouchableOpacity 
                                    style={[styles.modalItem, { paddingVertical: verticalScale(15) }]} 
                                    onPress={() => {
                                        setAssignedTo(u);
                                        setIsUserSelectorVisible(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    <View style={[styles.modalItemLeft, { gap: scale(15) }]}>
                                        <View style={[styles.modalAvatar, { width: scale(44), height: scale(44), borderRadius: scale(22) }]}><Text style={[styles.modalAvatarTxt, { fontSize: moderateScale(16) }]}>{(u.fullName || u.name || 'U')[0]}</Text></View>
                                        <View>
                                            <Text style={[styles.modalUserTxt, { fontSize: moderateScale(15) }]}>{u.fullName || u.name || 'Unnamed User'}</Text>
                                            <Text style={[styles.modalRoleTxt, { fontSize: moderateScale(11) }]}>{u.role || 'Member'}</Text>
                                        </View>
                                    </View>
                                    {assignedTo?._id === u._id && (
                                        <MaterialCommunityIcons name="check-circle" size={moderateScale(22)} color="#10B981" />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyModalView}>
                                    <MaterialCommunityIcons name="account-search" size={moderateScale(48)} color="#E2E8F0" />
                                    <Text style={[styles.emptyModalTxt, { fontSize: moderateScale(14) }]}>No team members found</Text>
                                </View>
                            }
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingBottom: 10, paddingTop: 10 },
    header: { marginBottom: 6, paddingLeft: 2 },
    headerTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    headerSubtitle: { fontWeight: '700', color: '#64748B', marginTop: 1 },
    sectionTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: 1.5, marginBottom: 10, marginTop: 4, paddingLeft: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
    card: { 
        width: '48.5%', 
        backgroundColor: '#FFFFFF', 
        borderRadius: 12, 
        paddingVertical: 8, 
        paddingHorizontal: 10, 
        marginBottom: 8, 
        borderLeftWidth: 3, 
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 2
    },
    cardIconBox: { 
        backgroundColor: '#F8FAFC', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 8 
    },
    cardLabel: { 
        flex: 1,
        fontWeight: '900', 
        color: '#1E293B', 
        letterSpacing: -0.2 
    },
    premiumWidget: { 
        backgroundColor: '#FFFFFF', 
        marginBottom: 16, 
        borderLeftWidth: 4, 
        borderLeftColor: '#4F46E5',
        elevation: 4, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.08, 
        shadowRadius: 3 
    },
    widgetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    widgetTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconCircle: { backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
    widgetTitle: { fontWeight: '900', color: '#1E293B' },
    widgetContent: { gap: 10 },
    inputFieldWrap: { gap: 4 },
    fieldLabel: { fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    textInputBox: { minHeight: 80, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10 },
    mainInput: { fontWeight: '700', color: '#1E293B', flex: 1 },
    selectorBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectorBoxActive: { borderColor: '#4F46E5', backgroundColor: '#F5F7FF' },
    selectorLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    tinyAvatar: { backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center' },
    tinyAvatarTxt: { fontWeight: '900', color: '#4F46E5' },
    selectorValue: { fontWeight: '700', color: '#1E293B', flex: 1, marginLeft: 10 },
    launchBtn: { backgroundColor: '#0F172A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
    launchBtnText: { color: '#fff', fontWeight: '900' },
    launchBtnDisabled: { opacity: 0.4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)' },
    modalContent: { backgroundColor: '#FFFFFF', padding: 20, flex: 1 },
    modalList: { flex: 1, marginTop: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    modalSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 15 },
    modalSearchInput: { flex: 1, marginLeft: 10, fontWeight: '700', color: '#1E293B' },
    modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalItemLeft: { flexDirection: 'row', alignItems: 'center' },
    modalAvatar: { backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
    modalAvatarTxt: { fontWeight: '900', color: '#4F46E5' },
    modalUserTxt: { fontWeight: '800', color: '#1E293B' },
    modalRoleTxt: { fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 },
    emptyModalView: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyModalTxt: { fontWeight: '800', color: '#94A3B8', marginTop: 10 },
    listHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 2 },
    listTitleText: { fontWeight: '900', color: '#0F172A' },
    countBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 1 },
    countText: { fontWeight: '900', color: '#64748B' },
    emptyState: { padding: 15, backgroundColor: '#F8FAFC', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', width: '100%' },
    emptyText: { color: '#94A3B8', fontWeight: '700' },
    miniIconBox: { backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    miniCard: { 
        width: '48.5%', 
        backgroundColor: '#FFFFFF', 
        marginBottom: 12, 
        borderLeftWidth: 4, 
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        flexDirection: 'row', 
        alignItems: 'center', 
    },
    miniText: { flex: 1, fontWeight: '700', color: '#334155' },
    miniLabel: { fontWeight: '900', color: '#4F46E5', textTransform: 'uppercase' },
    miniTitle: { fontWeight: '800', color: '#1E293B', lineHeight: 16 },
});

export default ProjectManagerDashboard;
