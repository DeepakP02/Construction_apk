import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import * as ImagePicker from 'expo-image-picker';
import IssueCard from '../../components/IssueCard';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';

export const IssuesTab = ({ project }) => {
    const { issues, addIssue, user, uploadFile } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newIssue, setNewIssue] = useState({ 
        title: '', 
        description: '', 
        priority: 'Medium',
        attachments: [] 
    });

    const projectIssues = issues.filter(i => {
        const pId = (i.projectId?._id || i.projectId)?.toString();
        return pId === project.id;
    });

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.4,
        });
        if (!result.canceled) {
            setNewIssue(prev => ({
                ...prev,
                attachments: [...prev.attachments, result.assets[0].uri]
            }));
        }
    };

    const removeImage = (index) => {
        setNewIssue(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    const handleAddIssue = async () => {
        if (!newIssue.title) return;
        
        try {
            setSubmitting(true);
            
            // 1. Upload photos first
            let uploadedUrls = [];
            if (newIssue.attachments && newIssue.attachments.length > 0) {
                const uploadPromises = newIssue.attachments.map((uri, idx) => 
                    uploadFile(uri, `project_issue_${idx}_${Date.now()}.jpg`, 'image/jpeg', '[INTERNAL_ISSUE_PHOTO]', project.id)
                );
                const results = await Promise.all(uploadPromises);
                uploadedUrls = results.map(r => r.url);
            }

            // 2. Submit issue as JSON
            const payload = {
                title: newIssue.title,
                description: newIssue.description || '',
                priority: newIssue.priority.toLowerCase(),
                projectId: project.id,
                status: 'open',
                date: new Date().toISOString(),
                attachments: uploadedUrls
            };

            const res = await addIssue(payload);
            if (res.success) {
                setNewIssue({ title: '', description: '', priority: 'Medium', attachments: [] });
                setModalVisible(false);
            }
        } catch (e) {
            console.error('Project Issue Submit Error:', e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.count}>{projectIssues.length} Active Issues</Text>
                {user?.role !== 'Worker' && (
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                        <MaterialCommunityIcons name="alert-plus" size={20} color={COLORS.black} />
                        <Text style={styles.addButtonText}>Report Issue</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={projectIssues}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => <IssueCard issue={item} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="check-decagram" size={60} color={COLORS.success} />
                        <Text style={styles.emptyText}>Zero critical issues found.</Text>
                    </View>
                }
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
                    >
                    <View style={styles.modalContent}>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                            keyboardDismissMode="none"
                        >
                        <Text style={styles.modalTitle}>Report Site Issue</Text>

                        <CustomInput
                            label="Issue Title"
                            placeholder="e.g. Material shortage in Block 4"
                            value={newIssue.title}
                            onChangeText={(text) => setNewIssue({ ...newIssue, title: text })}
                        />

                        <View style={{ height: SPACING.m }} />

                        <CustomInput
                            label="Description"
                            placeholder="Provide more context..."
                            value={newIssue.description}
                            multiline
                            numberOfLines={3}
                            onChangeText={(text) => setNewIssue({ ...newIssue, description: text })}
                        />

                        <View style={{ height: SPACING.m }} />

                        <Text style={styles.label}>Severity Level</Text>
                        <View style={styles.priorityGrid}>
                            {['Low', 'Medium', 'High'].map(p => (
                                <TouchableOpacity
                                    key={p}
                                    onPress={() => setNewIssue({ ...newIssue, priority: p })}
                                    style={[styles.priorityBtn, newIssue.priority === p && styles.priorityBtnActive]}
                                >
                                    <Text style={[styles.priorityText, newIssue.priority === p && styles.priorityTextActive]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Attachments</Text>
                        <View style={styles.attachmentContainer}>
                            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                                <MaterialCommunityIcons name="camera-plus" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                {newIssue.attachments.map((uri, idx) => (
                                    <View key={idx} style={styles.previewWrapper}>
                                        <Image source={{ uri }} style={styles.preview} />
                                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                                            <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.modalButtons}>
                            <View style={styles.modalBtnCol}>
                                <CustomButton title="Cancel" type="outline" onPress={() => setModalVisible(false)} />
                            </View>
                            <View style={[styles.modalBtnCol, styles.modalBtnColPrimary]}>
                                <CustomButton 
                                    title={submitting ? "Uploading..." : "Flag Issue"} 
                                    onPress={handleAddIssue} 
                                    disabled={submitting} 
                                />
                            </View>
                        </View>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
    },
    count: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addButtonText: {
        color: COLORS.black,
        fontWeight: '900',
        fontSize: 12,
        marginLeft: 4,
    },
    list: {
        padding: SPACING.m,
    },
    empty: {
        alignItems: 'center',
        marginTop: 80,
        opacity: 0.8,
    },
    emptyText: {
        color: COLORS.success,
        marginTop: 12,
        fontSize: 16,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalKeyboardWrap: {
        width: '100%',
    },
    modalContent: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: SPACING.l,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginBottom: SPACING.l,
        textAlign: 'center',
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    priorityGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xl,
    },
    priorityBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    priorityBtnActive: {
        backgroundColor: COLORS.primary + '20',
        borderColor: COLORS.primary,
    },
    priorityText: {
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    priorityTextActive: {
        color: COLORS.primary,
    },
    modalButtons: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 12,
        marginTop: 8,
        width: '100%'
    },
    modalBtnCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
    modalBtnColPrimary: { flex: 1.4 },
    attachmentContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.xl },
    addPhotoBtn: { width: 50, height: 50, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    previewWrapper: { marginRight: 10, position: 'relative' },
    preview: { width: 50, height: 50, borderRadius: 12 },
    removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 }
});
