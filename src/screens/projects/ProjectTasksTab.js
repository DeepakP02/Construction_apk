import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import TaskCard from '../../components/TaskCard';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';

export const ProjectTasksTab = ({ project }) => {
    const { tasks, jobs, addTask, updateTask, updateJob, user } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const projectTasks = tasks.filter(t => {
        const tProjId = typeof t.projectId === 'object' ? t.projectId?._id : t.projectId;
        const targetProjId = project._id || project.id;

        return (
            tProjId === targetProjId ||
            t.projectId === project.name ||
            t.project === project.name ||
            (t.projectId && t.projectId === targetProjId)
        );
    });

    const projectJobs = jobs.filter(j => {
        const jProjId = typeof j.projectId === 'object' ? j.projectId?._id : j.projectId;
        const targetProjId = project._id || project.id;
        return jProjId === targetProjId || j.name === project.name;
    });

    const consolidated = [
        ...projectTasks.map(t => ({ ...t, _itemType: 'task' })),
        ...projectJobs.map(j => ({ ...j, title: j.name, _itemType: 'job' }))
    ];

    const visibleTasks = (user?.role === 'WORKER')
        ? consolidated.filter(t => {
            if (t._itemType === 'job') {
                return t.assignedWorkers?.some(w => (w._id || w) === user._id) || t.foremanId === user._id;
            }
            const assignedId = typeof t.assignedTo === 'object' ? t.assignedTo?._id : t.assignedTo;
            return assignedId === user._id || t.assignedTo === user.name;
        })
        : consolidated;

    const canAddTask = user?.role === 'COMPANY_OWNER' || user?.role === 'PM' || user?.role === 'FOREMAN' || user?.role === 'SUPER_ADMIN';

    const handleAddTask = () => {
        if (!newTaskTitle.trim()) return;
        addTask({
            title: newTaskTitle,
            project: project.name,
            projectId: project._id || project.id,
            status: 'pending',
            priority: 'medium'
        });
        setNewTaskTitle('');
        setModalVisible(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerPremium}>
                <View>
                    <Text style={styles.hTitle}>CONSTRUCTION JOBS</Text>
                    <Text style={styles.hSub}>{visibleTasks.length} active work orders</Text>
                </View>
                {canAddTask && (
                    <TouchableOpacity style={styles.addBtnPremium} onPress={() => setModalVisible(true)}>
                        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={visibleTasks}
                keyExtractor={(item, index) => item._id || item.id || index.toString()}
                contentContainerStyle={styles.list}
                renderItem={({ item, index }) => (
                    <TaskCard
                        task={item}
                        index={index}
                        onStatusToggle={async () => {
                            const nextStatus = ['completed', 'done'].includes(item.status) ? (item._itemType === 'job' ? 'active' : 'todo') : (item._itemType === 'job' ? 'completed' : 'completed');
                            if (item._itemType === 'job') {
                                await updateJob(item._id || item.id, nextStatus);
                            } else {
                                // For tasks, only PM/Foreman can update
                                if (['COMPANY_OWNER', 'PM', 'FOREMAN'].includes(user?.role)) {
                                    await updateTask(item._id || item.id, { ...item, status: nextStatus });
                                } else {
                                    Alert.alert('Restricted', 'Only management can update Task models. Site Jobs are open for worker updates.');
                                }
                            }
                        }}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyIconBox}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={COLORS.textMuted} />
                        </View>
                        <Text style={styles.emptyText}>No project jobs found.</Text>
                        <Text style={styles.emptySub}>Awaiting scheduling by Project Manager.</Text>
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
                    <View style={styles.modalContent}>
                        <View style={styles.modalIndicator} />
                        <View style={styles.mHeader}>
                            <Text style={styles.mTitle}>Schedule New Job</Text>
                            <Text style={styles.mSubTitle}>Project: {project.name}</Text>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <CustomInput
                                label="Job Instruction / Title"
                                placeholder="e.g. Electrical roughed-in 2nd Floor"
                                value={newTaskTitle}
                                onChangeText={setNewTaskTitle}
                            />

                            <View style={styles.modalButtons}>
                                <View style={styles.modalBtnCol}>
                                    <CustomButton title="CANCEL" type="outline" onPress={() => setModalVisible(false)} />
                                </View>
                                <View style={[styles.modalBtnCol, styles.modalBtnColPrimary]}>
                                    <CustomButton title="ADD TO BACKLOG" onPress={handleAddTask} />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    headerPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0'
    },
    hTitle: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
    hSub: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 4 },
    addBtnPremium: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    list: { padding: 20, paddingBottom: 100 },
    empty: { alignItems: 'center', marginTop: 80 },
    emptyIconBox: { width: 80, height: 80, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    emptyText: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
    emptySub: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 8 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    mHeader: { marginBottom: 24 },
    mTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    mSubTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
    modalButtons: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 12,
        marginTop: 32,
        width: '100%'
    },
    modalBtnCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
    modalBtnColPrimary: { flex: 1.4 }
});
