import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, StatusBar, SafeAreaView, TextInput,
    Alert, Dimensions, Platform, Image, KeyboardAvoidingView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl } from '../../utils/api';

const { width } = Dimensions.get('window');

const RFIDetailScreen = ({ route, navigation }) => {
    const { rfiId } = route.params;
    const { user } = useApp();
    const [rfi, setRfi] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/rfis/${rfiId}`);
            setRfi(res.data);
        } catch (e) {
            console.error('Fetch RFI Detail error:', e);
            Alert.alert('Error', 'Failed to load RFI details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [rfiId]);

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        try {
            setSubmittingComment(true);
            const res = await api.post(`/rfis/${rfiId}/comments`, { text: commentText });
            setRfi(res.data);
            setCommentText('');
        } catch (e) {
            Alert.alert('Error', 'Failed to post comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'open': return { bg: '#FEF2F2', color: '#EF4444', label: 'Open' };
            case 'in_review': return { bg: '#FFFBEB', color: '#F59E0B', label: 'In Review' };
            case 'answered': return { bg: '#F0F9FF', color: '#0EA5E9', label: 'Answered' };
            case 'closed': return { bg: '#ECFDF5', color: '#10B981', label: 'Closed' };
            default: return { bg: '#F8FAFC', color: '#64748B', label: status };
        }
    };

    const getPriorityStyles = (p) => {
        switch (p) {
            case 'high': return { bg: '#FEF2F2', color: '#EF4444', label: 'High Priority' };
            case 'medium': return { bg: '#FFFBEB', color: '#F59E0B', label: 'Medium Priority' };
            case 'low': return { bg: '#ECFDF5', color: '#10B981', label: 'Low Priority' };
            default: return { bg: '#F1F5F9', color: '#64748B', label: p };
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    if (!rfi) return null;

    const statusSt = getStatusStyles(rfi.status);
    const prioritySt = getPriorityStyles(rfi.priority);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="RFI Details" showBack={true} showBranding={true} />
            <KeyboardAvoidingView
                style={styles.keyboardWrap}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 24}
            >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
            >
                {/* HEADER INFO */}
                <View style={[styles.mainCard, SHADOWS.medium]}>
                    <View style={styles.topMeta}>
                        <Text style={styles.rfiNumber}>{rfi.rfiNumber || 'RFI-XXXX'}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusSt.bg }]}>
                            <Text style={[styles.statusText, { color: statusSt.color }]}>{statusSt.label}</Text>
                        </View>
                    </View>

                    <Text style={styles.subject}>{rfi.subject}</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: prioritySt.bg }]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={14} color={prioritySt.color} />
                        <Text style={[styles.priorityText, { color: prioritySt.color }]}>{prioritySt.label}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.projectInfoRow}>
                        <MaterialCommunityIcons name="office-building" size={20} color="#64748B" />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.infoLabel}>PROJECT</Text>
                            <Text style={styles.infoValue}>{rfi.projectId?.name || 'General Project'}</Text>
                        </View>
                    </View>

                    {rfi.location && (
                        <View style={styles.projectInfoRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={20} color="#64748B" />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.infoLabel}>LOCATION / AREA</Text>
                                <Text style={styles.infoValue}>{rfi.location}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* DESCRIPTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <View style={styles.contentCard}>
                        <Text style={styles.descriptionText}>{rfi.description}</Text>
                    </View>
                </View>

                {/* OFFICIAL RESPONSE */}
                {rfi.officialResponse && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Official Response</Text>
                        <View style={[styles.contentCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                            <Text style={[styles.descriptionText, { color: '#0369A1' }]}>{rfi.officialResponse}</Text>
                        </View>
                    </View>
                )}

                {/* ASSIGNMENT INFO */}
                <View style={styles.assignmentGrid}>
                    <View style={styles.assignmentCard}>
                        <Text style={styles.infoLabel}>RAISED BY</Text>
                        <Text style={styles.assignmentName}>{rfi.raisedBy?.fullName || 'Internal'}</Text>
                        <Text style={styles.assignmentRole}>{rfi.raisedBy?.role || 'Staff'}</Text>
                    </View>
                    <View style={styles.assignmentCard}>
                        <Text style={styles.infoLabel}>ASSIGNED TO</Text>
                        <Text style={styles.assignmentName}>{rfi.assignedTo?.fullName || 'Unassigned'}</Text>
                        <Text style={[styles.assignmentRole, !rfi.assignedTo && { color: '#94A3B8' }]}>
                            {rfi.assignedTo ? rfi.assignedTo.role : 'Awaiting assignee'}
                        </Text>
                    </View>
                </View>

                {/* DATES */}
                <View style={styles.datesRow}>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-plus" size={16} color="#94A3B8" />
                        <Text style={styles.dateLabel}>CREATED:</Text>
                        <Text style={styles.dateValue}>{new Date(rfi.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color={rfi.isOverdue ? '#EF4444' : '#94A3B8'} />
                        <Text style={[styles.dateLabel, rfi.isOverdue && { color: '#EF4444' }]}>DUE DATE:</Text>
                        <Text style={[styles.dateValue, rfi.isOverdue && { color: '#EF4444', fontWeight: '800' }]}>
                            {rfi.dueDate ? new Date(rfi.dueDate).toLocaleDateString() : '—'}
                        </Text>
                    </View>
                </View>

                {/* ATTACHMENTS */}
                {rfi.attachments && rfi.attachments.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Attachments ({rfi.attachments.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentList}>
                            {rfi.attachments.map((file, idx) => (
                                <TouchableOpacity key={idx} style={styles.attachmentCardSmall}>
                                    <View style={styles.attachmentIcon}>
                                        <MaterialCommunityIcons name="file-document-outline" size={24} color="#2563EB" />
                                    </View>
                                    <Text style={styles.attachmentName} numberOfLines={1}>{file.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* COMMENTS SECTION */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Discussion</Text>
                        <View style={styles.commentCount}>
                            <Text style={styles.commentCountTxt}>{rfi.comments?.length || 0}</Text>
                        </View>
                    </View>

                    {/* Comment Area */}
                    <View style={styles.commentInputWrap}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add your comment..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={commentText}
                            onChangeText={setCommentText}
                        />
                        <TouchableOpacity 
                            style={[styles.sendBtn, (!commentText.trim() || submittingComment) && { opacity: 0.5 }]}
                            onPress={handleAddComment}
                            disabled={!commentText.trim() || submittingComment}
                        >
                            {submittingComment ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <MaterialCommunityIcons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Comments List */}
                    <View style={styles.commentsList}>
                        {(rfi.comments || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map((comment, idx) => (
                            <View key={comment._id || idx} style={styles.commentItem}>
                                <View style={styles.commentHeader}>
                                    <View style={styles.authorAvatar}>
                                        <Text style={styles.avatarTxt}>{(comment.author?.fullName || 'U')[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.commentAuthor}>{comment.author?.fullName || 'User'}</Text>
                                        <Text style={styles.commentDate}>{new Date(comment.createdAt).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.roleBadge}>
                                        <Text style={styles.roleBadgeTxt}>{comment.author?.role || 'Staff'}</Text>
                                    </View>
                                </View>
                                <Text style={styles.commentText}>{comment.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    keyboardWrap: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    scrollContent: { paddingBottom: 60 },

    mainCard: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    topMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rfiNumber: { fontSize: 13, fontWeight: '900', color: '#2563EB', letterSpacing: 0.5 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    subject: { fontSize: 22, fontWeight: '900', color: '#0F172A', lineHeight: 28, marginBottom: 10 },
    priorityBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 5 },
    priorityText: { fontSize: 11, fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
    projectInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    infoLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '800', color: '#1E293B' },

    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    contentCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9' },
    descriptionText: { fontSize: 15, color: '#445469', lineHeight: 24, fontWeight: '500' },

    assignmentGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
    assignmentCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    assignmentName: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginTop: 4 },
    assignmentRole: { fontSize: 11, color: '#2563EB', fontWeight: '800', marginTop: 2 },

    datesRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 16, marginBottom: 32 },
    dateItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
    dateValue: { fontSize: 11, fontWeight: '800', color: '#475569' },

    attachmentList: { paddingRight: 20, gap: 12 },
    attachmentCardSmall: { width: 120, backgroundColor: '#fff', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
    attachmentIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    attachmentName: { fontSize: 11, fontWeight: '700', color: '#1E293B', textAlign: 'center' },

    commentCount: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    commentCountTxt: { fontSize: 11, fontWeight: '900', color: '#64748B' },
    commentInputWrap: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    commentInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontWeight: '600', color: '#1E293B', maxHeight: 100 },
    sendBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },

    commentsList: { gap: 12 },
    commentItem: { backgroundColor: '#fff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    authorAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
    commentAuthor: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
    commentDate: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
    roleBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    roleBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#2563EB' },
    commentText: { fontSize: 14, color: '#475569', lineHeight: 20, fontWeight: '500' },
});

export default RFIDetailScreen;
