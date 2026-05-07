import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import CustomButton from '../../components/CustomButton';
import { useApp } from '../../context/AppContext';
import * as ImagePicker from 'expo-image-picker';

const UploadScreen = () => {
    const [note, setNote] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const { uploadNotes, addUploadNote } = useApp();

    const requestCameraPermission = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to capture field evidence.');
            return false;
        }
        return true;
    };

    const requestGalleryPermission = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery access is needed to upload photos.');
            return false;
        }
        return true;
    };

    const handleCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const handleGallery = async () => {
        const hasPermission = await requestGalleryPermission();
        if (!hasPermission) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const handleSave = () => {
        if (!note.trim() && !selectedImage) {
            Alert.alert('Missing Data', 'Please add a photo or note before saving.');
            return;
        }
        const timestamp = new Date().toLocaleString();
        const noteData = {
            id: Date.now().toString(),
            note: note.trim(),
            hasPhoto: !!selectedImage,
            timestamp: timestamp,
            imageUri: selectedImage
        };
        addUploadNote(noteData);
        setNote('');
        setSelectedImage(null);
        Alert.alert('✅ Saved', `Field evidence captured successfully!${selectedImage ? '\nPhoto attached' : ''}`);
    };

    return (
        <View style={styles.container}>
            <AppHeader title="Field Evidence" />
            <KeyboardAvoidingView
                style={styles.keyboardWrap}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
            >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <View style={styles.syncContainer}>
                    <MaterialCommunityIcons name="cloud-sync-outline" size={20} color={COLORS.success} />
                    <Text style={styles.syncText}>All data captures are automatically synced</Text>
                </View>

                {selectedImage ? (
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => setSelectedImage(null)}
                        >
                            <MaterialCommunityIcons name="close-circle" size={28} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.uploadActions}>
                        <TouchableOpacity style={styles.uploadBox} activeOpacity={0.8} onPress={handleCamera}>
                            <View style={styles.uploadCircle}>
                                <MaterialCommunityIcons name="camera" size={32} color={COLORS.primary} />
                            </View>
                            <Text style={styles.uploadTitle}>Capture Photo</Text>
                            <Text style={styles.uploadSub}>GPS + Timestamp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.uploadBox} activeOpacity={0.8} onPress={handleGallery}>
                            <View style={styles.uploadCircle}>
                                <MaterialCommunityIcons name="image-multiple" size={32} color={COLORS.info} />
                            </View>
                            <Text style={styles.uploadTitle}>From Gallery</Text>
                            <Text style={styles.uploadSub}>Select existing</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.form}>
                    <Text style={styles.label}>Context Notes</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Foundation crack observed in Zone B..."
                            placeholderTextColor={COLORS.textSecondary}
                            multiline
                            numberOfLines={4}
                            value={note}
                            onChangeText={setNote}
                        />
                    </View>

                    <CustomButton
                        title="Save Field Evidence"
                        onPress={handleSave}
                        style={styles.saveButton}
                    />

                    <Text style={styles.sectionTitle}>Recent Captures</Text>
                    {uploadNotes.map((item, index) => (
                        <View key={item.id || index} style={styles.noteCard}>
                            <View style={styles.noteHeader}>
                                <View style={styles.noteHeaderLeft}>
                                    <MaterialCommunityIcons
                                        name={item.hasPhoto ? "camera" : "note-text-outline"}
                                        size={18}
                                        color={COLORS.primary}
                                    />
                                    <Text style={styles.noteTime}>{item.timestamp}</Text>
                                </View>
                                {item.hasPhoto && (
                                    <View style={styles.photoTag}>
                                        <Text style={styles.photoTagText}>📷 Photo</Text>
                                    </View>
                                )}
                            </View>
                            {item.note && <Text style={styles.noteText}>{item.note}</Text>}
                        </View>
                    ))}

                    {uploadNotes.length === 0 && (
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="history" size={48} color={COLORS.border} />
                            <Text style={styles.emptyText}>No field notes saved yet.</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardWrap: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.m,
    },
    syncContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 200, 83, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: 'rgba(0, 200, 83, 0.2)',
    },
    syncText: {
        fontSize: 12,
        color: COLORS.success,
        marginLeft: 8,
        fontWeight: '700',
    },
    uploadActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: SPACING.xl,
    },
    uploadBox: {
        flex: 1,
        height: 180,
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        height: 280,
        backgroundColor: COLORS.card,
        borderRadius: 20,
        marginBottom: SPACING.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: COLORS.white,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    uploadCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    uploadTitle: {
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    uploadSub: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
    form: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 10,
        marginLeft: 4,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    inputContainer: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        padding: 16,
        height: 120,
        marginBottom: SPACING.m,
    },
    input: {
        color: COLORS.textPrimary,
        fontSize: 16,
        textAlignVertical: 'top',
        height: '100%',
    },
    saveButton: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginBottom: SPACING.m,
        letterSpacing: -0.5,
    },
    noteCard: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    noteHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    photoTag: {
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
    },
    photoTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.primary,
    },
    noteTime: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
        flex: 1,
    },
    noteText: {
        color: COLORS.textPrimary,
        fontSize: 14,
        lineHeight: 22,
        marginTop: 4,
    },
    empty: {
        alignItems: 'center',
        marginTop: 20,
        opacity: 0.5,
    },
    emptyText: {
        color: COLORS.textSecondary,
        marginTop: 8,
        fontSize: 14,
    },
});

export default UploadScreen;
