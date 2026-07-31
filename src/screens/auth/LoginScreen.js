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
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

export default function LoginScreen({ navigation }) {
    const { login, logout } = useApp();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        try { logout(); } catch (e) { }
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }, []);

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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={s.scroll}
                    contentContainerStyle={[
                        s.scrollContent,
                        { paddingTop: insets.top + verticalScale(20), paddingBottom: insets.bottom + verticalScale(120) }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
                        {/* Header & Logo Section (Fixed size, does not collapse) */}
                        <View style={s.headerSection}>
                            <Image
                                source={require('../../../assets/logo.webp')}
                                style={[s.loginLogo, { width: scale(84), height: scale(84) }]}
                                resizeMode="contain"
                            />
                            <Text style={[s.brand, { fontSize: moderateScale(28) }]}>
                                KAAL<Text style={{ color: '#93C5FD' }}> ERP</Text>
                            </Text>
                            <Text style={[s.tagline, { fontSize: moderateScale(13) }]}>Build Smarter. Manage Better.</Text>
                        </View>

                        {/* Login Form Card */}
                        <View style={[s.card, SHADOWS.large, { maxWidth: isTablet ? 500 : '100%' }]}>
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
                                    keyboardType="email-address"
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
                                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                                    <MaterialCommunityIcons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={moderateScale(20)} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[s.btn, loading && { opacity: 0.8 }]}
                                onPress={doLogin}
                                disabled={loading}
                            >
                                <LinearGradient colors={['#1E293B', '#334155']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btnGrad, { height: verticalScale(56) }]}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <Text style={[s.btnText, { fontSize: moderateScale(15) }]}>SIGN IN TO DASHBOARD</Text>
                                            <MaterialCommunityIcons name="arrow-right" size={moderateScale(20)} color="#fff" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text style={[s.footerNote, { fontSize: moderateScale(10) }]}>Backend version v4.0.2 Stable</Text>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#1E293B' },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.m },
    container: { width: '100%', alignItems: 'center' },
    headerSection: { alignItems: 'center', marginBottom: verticalScale(24) },
    loginLogo: { marginBottom: 12 },
    brand: { color: COLORS.white, fontWeight: '900', letterSpacing: 2, marginVertical: 0 },
    tagline: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 6 },
    card: {
        width: '100%',
        backgroundColor: COLORS.card,
        borderRadius: SIZES.radiusCard,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.background, borderRadius: SIZES.radiusBtn, borderWidth: 1.5, borderColor: COLORS.border,
        paddingHorizontal: SPACING.m, marginBottom: SPACING.m,
    },
    inputActive: { borderColor: '#3B82F6', backgroundColor: COLORS.card },
    input: { flex: 1, height: '100%', color: COLORS.textPrimary, fontWeight: '700', marginLeft: 12 },
    btn: { borderRadius: SIZES.radiusBtn, overflow: 'hidden', marginTop: 10 },
    btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    btnText: { color: COLORS.white, fontWeight: '900', letterSpacing: 0.5 },
    footerNote: { textAlign: 'center', color: COLORS.textMuted, fontWeight: '700', marginTop: SPACING.m, textTransform: 'uppercase', letterSpacing: 1 },
});
