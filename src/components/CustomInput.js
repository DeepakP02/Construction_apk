import React from 'react';
import { View, TextInput, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { COLORS, SIZES, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CustomInput = ({ label, placeholder, value, onChangeText, secureTextEntry, error, icon, keyboardType, autoCapitalize }) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
            <View style={[
                styles.inputContainer,
                error && styles.errorInput,
                isFocused && styles.focusedInput
            ]}>
                {icon && (
                    <MaterialCommunityIcons
                        name={icon}
                        size={20}
                        color={isFocused ? COLORS.primary : COLORS.textSecondary}
                        style={styles.icon}
                    />
                )}
                <TextInput
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry}
                    style={styles.input}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.m,
        width: '100%',
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 1,
    },
    inputContainer: {
        height: 52,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    focusedInput: {
        borderColor: COLORS.primary,
        backgroundColor: '#EFF6FF',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: Dimensions.get('window').width < 380 ? 13 : 15,
        fontWeight: '500',
    },
    errorInput: {
        borderColor: COLORS.danger,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
        fontWeight: '600',
    },
});

export default CustomInput;
