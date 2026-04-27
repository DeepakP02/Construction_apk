import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
    ActivityIndicator, Platform, ScrollView, Animated, Keyboard,
    KeyboardAvoidingView, Dimensions, Image, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ROLES = [
    {
        id: 'PM', label: 'Project Manager', icon: 'briefcase-account', color: '#1D4ED8', bg: '#EFF6FF',
        email: 'pm@kaal.ca', pass: '123456'
    },
    {
        id: 'FOREMAN', label: 'Foreman', icon: 'hard-hat', color: '#16A34A', bg: '#F0FDF4',
        email: 'foreman@kaal.ca', pass: '123456'
    },
    {
        id: 'WORKER', label: 'Worker', icon: 'account-hard-hat', color: '#6366F1', bg: '#EEF2FF',
        email: 'worker@kaal.ca', pass: '123456'
    },
    {
        id: 'SUBCONTRACTOR', label: 'Sub', icon: 'wrench-cog', color: '#DB2777', bg: '#FDF2F8',
        email: 'subcontractor@kaal.ca', pass: '123456'
    },
    {
        id: 'CLIENT', label: 'Client', icon: 'account-tie', color: '#8B5CF6', bg: '#F5F3FF',
        email: 'client@kaal.ca', pass: '123456'
    }
];

export default function LoginScreen({ navigation }) {
    const { login, logout } = useApp();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [focusedField, setFocusedField] = useState(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        try { logout(); } catch (e) { }
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        handleSelectRole(ROLES[0]);
    }, []);

    const handleSelectRole = (role) => {
        setSelectedRole(role.id);
        setEmail(role.email);
        setPassword(role.pass);
    };

    const doLogin = async () => {
        Keyboard.dismiss();
        if (!email.trim() || !password.trim()) {
            alert('Enter valid credentials');
            return;
        }
        setLoading(true);
        try {
            const res = await login(email.trim(), password);
            if (!res?.success) {
                alert(res?.message || 'Login failed. Please check credentials.');
                setLoading(false);
            }
        } catch (err) {
            alert('Login error. Check your server connection.');
            setLoading(false);
        }
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <LinearGradient
                colors={['#2E3647', '#1E293B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.top, { height: verticalScale(240) + insets.top, paddingTop: insets.top + verticalScale(20) }]}
            >
                <View style={[s.bubble, { top: -scale(60), right: -scale(60), width: scale(220), height: scale(220), opacity: 0.1 }]} />
                <View style={[s.bubble, { bottom: -scale(30), left: -scale(30), width: scale(140), height: scale(140), opacity: 0.08 }]} />
                
                <Animated.View style={[s.headerContent, { opacity: fadeAnim }]}>
                    <Image 
                        source={require('../../../assets/logo.webp')} 
                        style={[s.loginLogo, { width: scale(80), height: scale(80) }]} 
                        resizeMode="contain" 
                    />
                    <Text style={[s.brand, { fontSize: moderateScale(28) }]}>KAAL<Text style={{ color: '#93C5FD' }}> ERP</Text></Text>
                    <Text style={[s.tagline, { fontSize: moderateScale(13) }]}>Build Smarter. Manage Better.</Text>
                </Animated.View>
                <View style={s.curve} />
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : null}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={s.scroll}
                    contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[s.card, SHADOWS.large, { opacity: fadeAnim, maxWidth: isTablet ? 500 : '100%', alignSelf: 'center', width: '100%' }]}>
                        <View style={s.guideHeader}>
                            <MaterialCommunityIcons name="lock-open-outline" size={moderateScale(16)} color="#3B82F6" />
                            <Text style={[s.guideTitle, { fontSize: moderateScale(12) }]}>DEMO ACCESS GUIDE</Text>
                        </View>

                        <Text style={[s.label, { fontSize: moderateScale(11) }]}>Tap Role to Auto-fill</Text>
                        <View style={s.roleGrid}>
                            {ROLES.map(role => {
                                const active = selectedRole === role.id;
                                return (
                                    <TouchableOpacity
                                        key={`role-${role.id}`}
                                        onPress={() => handleSelectRole(role)}
                                        style={[s.chip, { backgroundColor: active ? role.bg : '#F8FAFC', borderColor: active ? role.color : '#E2E8F0', paddingHorizontal: scale(10), paddingVertical: verticalScale(10) }]}
                                    >
                                        <MaterialCommunityIcons name={role.icon} size={moderateScale(14)} color={active ? role.color : '#94A3B8'} />
                                        <Text style={[s.chipText, { color: active ? role.color : '#64748B', fontSize: moderateScale(11) }]}>{role.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={[s.inputWrap, focusedField === 'email' && s.inputActive, { height: verticalScale(56) }]}>
                            <MaterialCommunityIcons name="email-outline" size={moderateScale(20)} color={focusedField === 'email' ? '#3B82F6' : '#94A3B8'} />
                            <TextInput
                                style={[s.input, { fontSize: moderateScale(15) }]}
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                placeholder="Email Address"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={[s.inputWrap, focusedField === 'pass' && s.inputActive, { height: verticalScale(56) }]}>
                            <MaterialCommunityIcons name="lock-outline" size={moderateScale(20)} color={focusedField === 'pass' ? '#3B82F6' : '#94A3B8'} />
                            <TextInput
                                style={[s.input, { fontSize: moderateScale(15) }]}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocusedField('pass')}
                                onBlur={() => setFocusedField(null)}
                                placeholder="Password"
                                placeholderTextColor="#94A3B8"
                                secureTextEntry={!showPass}
                            />
                            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                <MaterialCommunityIcons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={moderateScale(20)} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[s.btn, loading && { opacity: 0.8 }]}
                            onPress={doLogin}
                            disabled={loading}
                        >
                            <LinearGradient colors={['#1E293B', '#334155']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btnGrad, { height: verticalScale(58) }]}>
                                {loading ? <ActivityIndicator color="#fff" /> : (
                                    <>
                                        <Text style={[s.btnText, { fontSize: moderateScale(15) }]}>SIGN IN TO DASHBOARD</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={moderateScale(20)} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <Text style={[s.footerNote, { fontSize: moderateScale(10) }]}>Backend version v4.0.2 Stable</Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F1F5F9' },
    top: {
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    bubble: { position: 'absolute', backgroundColor: '#fff', borderRadius: 999 },
    headerContent: { alignItems: 'center', zIndex: 10 },
    loginLogo: {
        marginBottom: 10,
    },
    brand: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
    tagline: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 4 },
    curve: {
        position: 'absolute', bottom: -1, width: '100%', height: 40,
        backgroundColor: '#F1F5F9', borderTopLeftRadius: 40, borderTopRightRadius: 40,
    },
    scroll: { flex: 1, marginTop: -30 },
    scrollContent: { paddingHorizontal: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    guideTitle: { fontWeight: '900', color: '#3B82F6', letterSpacing: 1 },
    label: { fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
        paddingHorizontal: 16, marginBottom: 16,
    },
    inputActive: { borderColor: '#3B82F6', backgroundColor: '#fff' },
    input: { flex: 1, height: '100%', color: '#0F172A', fontWeight: '700', marginLeft: 12 },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1.2 },
    chipText: { fontWeight: '800' },
    btn: { borderRadius: 14, overflow: 'hidden', marginTop: 10 },
    btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    btnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
    footerNote: { textAlign: 'center', color: '#94A3B8', fontWeight: '700', marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 },
});
