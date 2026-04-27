import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, StatusBar, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

const { width } = Dimensions.get('window');

const SplashScreen = ({ onFinish }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            })
        ]).start();

        const timer = setTimeout(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }).start(() => onFinish?.());
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#2E3647', '#1E293B']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Decorative Background Patterns */}
            <View style={[styles.circle, { top: -50, right: -50, width: 250, height: 250, opacity: 0.1 }]} />
            <View style={[styles.circle, { bottom: -100, left: -100, width: 300, height: 300, opacity: 0.1 }]} />

            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Image 
                    source={require('../../../assets/logo.webp')} 
                    style={styles.splashLogo} 
                    resizeMode="contain" 
                />
                <Text style={styles.brand}>KAAL<Text style={{ color: '#93C5FD' }}> ERP</Text></Text>
                <View style={styles.line} />
                <Text style={styles.tagline}>ADVANCED CONSTRUCTION MANAGEMENT</Text>
            </Animated.View>

            <View style={styles.footer}>
                <Text style={styles.version}>VERSION 4.0 PRO</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2E3647' },
    circle: { position: 'absolute', backgroundColor: '#fff', borderRadius: 999 },
    content: { alignItems: 'center' },
    splashLogo: {
        width: 120,
        height: 120,
        marginBottom: 20,
    },
    brand: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 4 },
    line: { width: 50, height: 4, backgroundColor: '#93C5FD', marginVertical: 15, borderRadius: 2 },
    tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
    footer: { position: 'absolute', bottom: 50 },
    version: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});

export default SplashScreen;
