import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { MOCK_TASKS } from '../../mock/data';
import TaskCard from '../../components/TaskCard';

export const ScheduleTab = ({ projectId }) => {
    return (
        <View style={styles.container}>
            <FlatList
                data={MOCK_TASKS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => <TaskCard task={item} />}
            />
        </View>
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
});
