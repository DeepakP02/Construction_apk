import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, Modal, TextInput, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import CustomButton from '../../components/CustomButton';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - SPACING.m * 2 - 10) / 2;

export const PhotosTab = ({ project }) => {
    const [photos, setPhotos] = useState([
        { id: '1', url: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&w=500&q=60', label: 'FOUNDATION' },
        { id: '2', url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=500&q=60', label: 'STRUCTURE' },
        { id: '3', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=500&q=60', label: 'ZONE A PLUMBING' },
    ]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [photoLabel, setPhotoLabel] = useState('');
    const [viewerUri, setViewerUri] = useState(null);

    const handleCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            setModalVisible(true);
        }
    };

    const handleGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery access is needed.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            setModalVisible(true);
        }
    };

    const handleSavePhoto = () => {
        if (!photoLabel.trim()) {
            Alert.alert('Missing Label', 'Please add a category label for this photo.');
            return;
        }

        const newPhoto = {
            id: Date.now().toString(),
            url: selectedImage,
            label: photoLabel.toUpperCase(),
        };

        setPhotos([newPhoto, ...photos]);
        setModalVisible(false);
        setSelectedImage(null);
        setPhotoLabel('');
        Alert.alert('✅ Added', 'Photo added to project gallery!');
    };

    const showAddOptions = async () => {
        console.log('Add Photo button clicked!');

        // Directly open gallery for testing
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Please enable gallery access in settings.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        console.log('Image picker result:', result);

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            setModalVisible(true);
        }
    };

    const handleDeletePhoto = (photoId, photoLabel) => {
        Alert.alert(
            '🗑️ Delete Photo',
            `Remove "${photoLabel}" from gallery?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setPhotos(photos.filter(p => p.id !== photoId));
                        Alert.alert('✅ Deleted', 'Photo removed from gallery.');
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.count}>{photos.length} Captures</Text>
                <TouchableOpacity style={styles.addButton} onPress={showAddOptions}>
                    <MaterialCommunityIcons name="camera-plus" size={20} color={COLORS.black} />
                    <Text style={styles.addButtonText}>Add Photo</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={photos}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.photoCard}
                        onPress={() => setViewerUri(item.url)}
                        onLongPress={() => handleDeletePhoto(item.id, item.label)}
                        activeOpacity={0.8}
                    >
                        <Image source={{ uri: item.url }} style={styles.image} />
                        <View style={styles.overlay}>
                            <Text style={styles.label}>{item.label}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Label This Photo</Text>

                        {selectedImage && (
                            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Foundation, Structure, Plumbing..."
                            placeholderTextColor={COLORS.textSecondary}
                            value={photoLabel}
                            onChangeText={setPhotoLabel}
                        />

                        <View style={styles.modalButtons}>
                            <CustomButton
                                title="CANCEL"
                                type="outline"
                                style={styles.flex1}
                                onPress={() => {
                                    setModalVisible(false);
                                    setSelectedImage(null);
                                    setPhotoLabel('');
                                }}
                            />
                            <View style={{ width: SPACING.m }} />
                            <CustomButton
                                title="SAVE PHOTO"
                                style={styles.flex1}
                                onPress={handleSavePhoto}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
                <View style={styles.viewerBackdrop}>
                    <StatusBar barStyle="light-content" backgroundColor="#000" />
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.viewerScroll}
                        maximumZoomScale={4}
                        minimumZoomScale={1}
                        centerContent
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                    >
                        <TouchableOpacity activeOpacity={1} onPress={() => setViewerUri(null)}>
                            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
                        </TouchableOpacity>
                    </ScrollView>
                    <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    viewerScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    viewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
    viewerClose: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
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
        padding: 10,
    },
    photoCard: {
        width: COLUMN_WIDTH,
        height: COLUMN_WIDTH,
        margin: 5,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
    },
    label: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: SPACING.l,
    },
    modalContent: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: SPACING.l,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginBottom: SPACING.m,
        textAlign: 'center',
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        marginBottom: SPACING.m,
    },
    input: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        padding: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: SPACING.l,
    },
    modalButtons: {
        flexDirection: 'row',
    },
    flex1: {
        flex: 1,
    },
});
