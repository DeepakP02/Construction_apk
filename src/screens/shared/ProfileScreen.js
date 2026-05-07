import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Animated, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileItem = ({ icon, label, value, onPress, isDestructive = false, animIndex, staggeredAnims }) => {
    const anim = staggeredAnims[animIndex] || new Animated.Value(1);
    return (
        <Animated.View style={{
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
        }}>
            <TouchableOpacity style={[styles.profileItem, SHADOWS.small]} onPress={onPress} activeOpacity={0.7}>
                <View style={styles.profileItemLeft}>
                    <View style={[styles.iconBox, { backgroundColor: isDestructive ? COLORS.danger + '10' : COLORS.primaryAccent + '10' }]}>
                        <MaterialCommunityIcons name={icon} size={20} color={isDestructive ? COLORS.danger : COLORS.primaryAccent} />
                    </View>
                    <Text style={[styles.profileItemLabel, isDestructive && { color: COLORS.danger }]}>{label}</Text>
                </View>
                <View style={styles.profileItemRight}>
                    {value && <Text style={styles.profileItemValue}>{value}</Text>}
                    <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const ProfileScreen = ({ navigation }) => {
    const { user, updateProfile, updatePassword, logout } = useApp();
    const { width, height } = useWindowDimensions();
    const isSmallScreen = width < 380;
    const modalMaxWidth = Math.min(width - 16, 560);
    const modalMaxHeight = Math.min(height * 0.9, 720);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const [editData, setEditData] = useState({
        fullName: user?.name || user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || ''
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setEditData({
                fullName: user.name || user.fullName || '',
                email: user.email || '',
                phone: user.phone || ''
            });
        }
    }, [user]);

    const formatRoleLabel = (role) => {
        if (!role) return 'Member';
        const roleMap = {
            PM: 'Project Manager',
            FOREMAN: 'Foreman',
            SUBCONTRACTOR: 'Subcontractor',
            WORKER: 'Worker',
            CLIENT: 'Client',
            COMPANY_OWNER: 'Company Owner',
            SUPER_ADMIN: 'Super Admin',
            ADMIN: 'Admin',
        };
        return roleMap[role] || String(role).replace(/_/g, ' ');
    };

    // Staggered Animations
    const staggeredAnims = useRef([
        new Animated.Value(0), // Header
        new Animated.Value(0), // Sec 1
        new Animated.Value(0), // Sec 2
        new Animated.Value(0), // Sec 3
        new Animated.Value(0), // Logout
    ]).current;

    useEffect(() => {
        Animated.stagger(100, staggeredAnims.map(anim =>
            Animated.spring(anim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true
            })
        )).start();
    }, []);

    const handleUpdateProfile = async () => {
        if (!editData.fullName || !editData.email) {
            Alert.alert('Error', 'Name and Email are required.');
            return;
        }
        setLoading(true);
        const res = await updateProfile(editData);
        setLoading(false);
        if (res.success) {
            Alert.alert('Success', 'Profile updated successfully!');
            setIsEditModalVisible(false);
        } else {
            Alert.alert('Error', res.message);
        }
    };

    const handleUpdatePassword = async () => {
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            Alert.alert('Error', 'All fields are required.');
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        setLoading(true);
        const res = await updatePassword({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
        });
        setLoading(false);
        if (res.success) {
            Alert.alert('Success', 'Password updated successfully!');
            setIsPasswordModalVisible(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } else {
            Alert.alert('Error', res.message);
        }
    };

    return (
        <View style={styles.container}>
            <WorkerHeader title="My Account" showBack hideSearch />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* User Info Header */}
                <Animated.View style={[styles.userHeader, { opacity: staggeredAnims[0], transform: [{ scale: staggeredAnims[0] }] }]}>
                    <View style={styles.avatarWrapper}>
                        <LinearGradient
                            colors={COLORS.headerGradient}
                            style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}
                        >
                            <Text style={{ fontSize: 48, fontWeight: '900', color: '#fff' }}>
                                {(user?.name || user?.fullName || 'U').charAt(0).toUpperCase()}
                            </Text>
                        </LinearGradient>
                        <TouchableOpacity style={[styles.editAvatar, SHADOWS.small]} onPress={() => setIsEditModalVisible(true)}>
                            <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.userName}>{user?.name || user?.fullName || 'User Name'}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.userRole}>{formatRoleLabel(user?.role)}</Text>
                    </View>
                </Animated.View>

                {/* Account Sections */}
                <Animated.View style={[styles.section, { opacity: staggeredAnims[1] }]}>
                    <Text style={styles.sectionTitle}>Account Details</Text>
                    <ProfileItem
                        icon="account-outline"
                        label="Edit Profile"
                        onPress={() => setIsEditModalVisible(true)}
                        animIndex={1} staggeredAnims={staggeredAnims}
                    />
                    <ProfileItem
                        icon="lock-outline"
                        label="Security"
                        value="Change Password"
                        onPress={() => setIsPasswordModalVisible(true)}
                        animIndex={1} staggeredAnims={staggeredAnims}
                    />
                </Animated.View>

                <Animated.View style={[styles.section, { opacity: staggeredAnims[2] }]}>
                    <Text style={styles.sectionTitle}>Status Information</Text>
                    <ProfileItem icon="email-outline" label="Work Email" value={user?.email || 'N/A'} animIndex={2} staggeredAnims={staggeredAnims} />
                    <ProfileItem icon="shield-check-outline" label="Account Type" value={formatRoleLabel(user?.role)} animIndex={2} staggeredAnims={staggeredAnims} />
                </Animated.View>

                {/* Company Section */}
                <Animated.View style={[styles.section, { opacity: staggeredAnims[3] }]}>
                    <Text style={styles.sectionTitle}>Organization</Text>
                    <View style={[styles.companyCard, SHADOWS.small]}>
                        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.companyLogo}>
                            <MaterialCommunityIcons name="office-building" size={24} color="#fff" />
                        </LinearGradient>
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{user?.companyName || 'KAAL ERP Enterprise'}</Text>
                            <View style={styles.planBadge}>
                                <Text style={styles.planText}>SUBSCRIPTION ACTIVE</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.section, { opacity: staggeredAnims[4] }]}>
                    <ProfileItem
                        icon="logout-variant"
                        label="Log Out"
                        isDestructive
                        onPress={() => logout()}
                        animIndex={4}
                        staggeredAnims={staggeredAnims}
                    />
                </Animated.View>

                <Text style={styles.versionText}>KAAL ERP PRO • Version 4.0.1</Text>
                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditModalVisible}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                presentationStyle="overFullScreen"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                        <View style={[styles.modalContent, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isSmallScreen ? 16 : 20 }]}>
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.modalScrollContent}
                            >
                                <Text style={styles.modalTitle}>Edit Profile</Text>

                                <Text style={styles.inputLabel}>Display Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full Name"
                                    placeholderTextColor="#94A3B8"
                                    value={editData.fullName}
                                    onChangeText={(t) => setEditData({ ...editData, fullName: t })}
                                />

                                <Text style={styles.inputLabel}>Email Address</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="#94A3B8"
                                    value={editData.email}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    onChangeText={(t) => setEditData({ ...editData, email: t })}
                                />

                                <Text style={styles.inputLabel}>Contact Number</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. +1 234 567 890"
                                    placeholderTextColor="#94A3B8"
                                    value={editData.phone}
                                    keyboardType="phone-pad"
                                    onChangeText={(t) => setEditData({ ...editData, phone: t })}
                                />

                                <Text style={styles.inputLabel}>Role</Text>
                                <View style={styles.readOnlyInput}>
                                    <Text style={styles.readOnlyText}>{formatRoleLabel(user?.role)}</Text>
                                </View>

                                <View style={[styles.modalButtons, isSmallScreen && styles.modalButtonsStacked]}>
                                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#64748B' }]} onPress={() => setIsEditModalVisible(false)}>
                                        <Text style={styles.btnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.primary }]} onPress={handleUpdateProfile}>
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update</Text>}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Password Modal */}
            <Modal
                visible={isPasswordModalVisible}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                presentationStyle="overFullScreen"
                onRequestClose={() => setIsPasswordModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKeyboardWrap}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
                    >
                        <View style={[styles.modalContent, { width: modalMaxWidth, maxHeight: modalMaxHeight, padding: isSmallScreen ? 16 : 20 }]}>
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.modalScrollContent}
                            >
                                <Text style={styles.modalTitle}>Change Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Current Password"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={passwordData.currentPassword}
                                    onChangeText={(t) => setPasswordData({ ...passwordData, currentPassword: t })}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="New Password"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={passwordData.newPassword}
                                    onChangeText={(t) => setPasswordData({ ...passwordData, newPassword: t })}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm New Password"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={passwordData.confirmPassword}
                                    onChangeText={(t) => setPasswordData({ ...passwordData, confirmPassword: t })}
                                />
                                <View style={[styles.modalButtons, isSmallScreen && styles.modalButtonsStacked]}>
                                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#64748B' }]} onPress={() => setIsPasswordModalVisible(false)}>
                                        <Text style={styles.btnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.primary }]} onPress={handleUpdatePassword}>
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Change</Text>}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { padding: SPACING.m },
    userHeader: { alignItems: 'center', paddingVertical: SPACING.xl },
    avatarWrapper: { position: 'relative', marginBottom: 16 },
    avatar: { width: 128, height: 128, borderRadius: 42, borderWidth: 4, borderColor: COLORS.card },
    editAvatar: {
        position: 'absolute', bottom: -4, right: -4,
        backgroundColor: COLORS.primaryAccent, width: 40, height: 40,
        borderRadius: 14, justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: COLORS.card,
    },
    userName: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -1 },
    roleBadge: { backgroundColor: COLORS.primaryAccent + '15', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 8 },
    userRole: { fontSize: 11, color: COLORS.primaryAccent, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    section: { marginBottom: SPACING.l },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 1 },
    companyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: SIZES.radius, padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border },
    companyLogo: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    companyInfo: { marginLeft: 14 },
    companyName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    planBadge: { backgroundColor: COLORS.success + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
    planText: { fontSize: 9, fontWeight: '900', color: COLORS.success },
    profileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 14, borderRadius: SIZES.radius, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
    profileItemLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    profileItemLabel: { fontSize: 15, color: COLORS.textPrimary, marginLeft: 12, fontWeight: '800' },
    profileItemRight: { flexDirection: 'row', alignItems: 'center' },
    profileItemValue: { fontSize: 14, marginRight: 6, fontWeight: '700', color: COLORS.textSecondary },
    versionText: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
    modalKeyboardWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, alignSelf: 'center' },
    modalScrollContent: { paddingBottom: 12, flexGrow: 1 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 12, letterSpacing: -0.4 },
    inputLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 6, marginTop: 6 },
    input: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#000' },
    readOnlyInput: { backgroundColor: '#E2E8F0', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#CBD5E1' },
    readOnlyText: { fontSize: 16, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalButtonsStacked: { flexDirection: 'column' },
    modalBtn: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', fontSize: 14 }
});

export default ProfileScreen;
