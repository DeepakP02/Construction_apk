import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const ChatTab = ({ project }) => {
    const { messages, sendMessage, fetchMessages, user } = useApp();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);
    const flatListRef = useRef();

    const targetId = (project._id || project.id)?.toString();

    React.useEffect(() => {
        const load = async () => {
            if (!targetId) return;
            setLoading(true);
            const res = await fetchMessages(targetId, 'project');
            setLoading(false);
            if (res?.unauthorized) {
                setUnauthorized(true);
            } else {
                setUnauthorized(false);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
            }
        };
        load();
    }, [targetId]);

    const projectMessages = (messages || []).filter(m => {
        const mProjId = m.projectId?.toString();
        return mProjId === targetId;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (unauthorized) {
        return (
            <View style={styles.center}>
                <MaterialCommunityIcons name="lock-outline" size={64} color={COLORS.textSecondary} />
                <Text style={styles.restrictedTitle}>Restricted Discussion</Text>
                <Text style={styles.restrictedText}>This channel is limited to project stakeholders. Please contact the site manager for access.</Text>
            </View>
        );
    }

    const handleSend = async () => {
        if (!text.trim()) return;
        await sendMessage(text, targetId);
        setText('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={projectMessages}
                keyExtractor={(item, index) => item._id || item.id || index.toString()}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => {
                    const itemSenderId = (item.sender?._id || item.sender || item.senderId)?.toString();
                    const isMe = itemSenderId === user?._id?.toString() || item.isMe;
                    const senderName = item.sender?.fullName || item.senderName || item.sender || 'User';

                    return (
                        <View style={[styles.messageWrapper, isMe ? styles.myMessage : styles.theirMessage]}>
                            {!isMe && <Text style={styles.sender}>{senderName}</Text>}
                            <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
                                    {item.message || item.text}
                                </Text>
                            </View>
                            <Text style={styles.time}>{item.time || new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    );
                }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Type a group message..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={text}
                    onChangeText={setText}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!text.trim()}
                >
                    <MaterialCommunityIcons name="send" size={24} color={COLORS.black} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    list: {
        padding: SPACING.m,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    restrictedTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginTop: 20,
        textAlign: 'center',
    },
    restrictedText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
        fontWeight: '600',
    },
    messageWrapper: {
        marginBottom: 16,
        maxWidth: '80%',
    },
    myMessage: {
        alignSelf: 'flex-end',
    },
    theirMessage: {
        alignSelf: 'flex-start',
    },
    sender: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.primary,
        marginBottom: 4,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
    },
    myBubble: {
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: COLORS.card,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    myText: {
        color: COLORS.black,
        fontWeight: '600',
    },
    theirText: {
        color: COLORS.textPrimary,
    },
    time: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 4,
        marginHorizontal: 4,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: COLORS.textPrimary,
        maxHeight: 100,
        fontSize: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
