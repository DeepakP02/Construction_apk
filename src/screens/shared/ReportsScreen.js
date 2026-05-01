import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    useWindowDimensions,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import api from '../../utils/api';

const ReportsScreen = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const isCompact = width < 380;
    const { projects, selectedProject } = useApp();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [companyReport, setCompanyReport] = useState(null);
    const [detailedProjectReport, setDetailedProjectReport] = useState(null);
    const [activeMode, setActiveMode] = useState('site_metrics');
    const [operationsView, setOperationsView] = useState('list');
    const [selectedJobId, setSelectedJobId] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        siteLogs: true,
        deficiencies: true,
        workers: false,
        subcontractors: false,
        quality: false,
        materials: false,
        equipment: false,
        efficiencies: false,
        hierarchy: false,
        notes: false,
        jobs: true,
        operations: true
    });

    const activeProjectId = useMemo(() => {
        const fromSelected = selectedProject?._id || selectedProject?.id;
        const fromFirst = projects?.[0]?._id || projects?.[0]?.id;
        return fromSelected || fromFirst || null;
    }, [selectedProject, projects]);

    const loadReports = useCallback(async ({ showLoader = true } = {}) => {
        try {
            if (showLoader) setLoading(true);
            const companyRes = await api.get('/reports/company');
            setCompanyReport(companyRes.data || null);

            if (activeProjectId) {
                const detailedRes = await api.get(`/reports/detailed/${activeProjectId}`);
                setDetailedProjectReport(detailedRes.data || null);
            } else {
                setDetailedProjectReport(null);
            }
        } catch (e) {
            console.error('Reports sync fetch failed', e?.response?.data || e?.message || e);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [activeProjectId]);

    useEffect(() => {
        loadReports({ showLoader: true });
    }, [loadReports]);

    useEffect(() => {
        const firstJobId = detailedProjectReport?.jobs?.[0]?._id || '';
        setSelectedJobId(firstJobId);
    }, [detailedProjectReport?.jobs]);

    useEffect(() => {
        setOperationsView('list');
    }, [activeMode, activeProjectId]);

    const stats = useMemo(() => {
        const companyTasks = companyReport?.tasks || {};
        const project = detailedProjectReport?.project || {};
        const sortByDateDesc = (list, key) => [...list].sort((a, b) => new Date(b?.[key] || 0) - new Date(a?.[key] || 0));
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortByPriorityThenDate = (list) => [...list].sort((a, b) => {
            const ap = priorityOrder[String(a?.priority || '').toLowerCase()] ?? 999;
            const bp = priorityOrder[String(b?.priority || '').toLowerCase()] ?? 999;
            if (ap !== bp) return ap - bp;
            return new Date(b?.date || 0) - new Date(a?.date || 0);
        });

        const projectJobsRaw = Array.isArray(detailedProjectReport?.jobs) ? [...detailedProjectReport.jobs] : [];
        const projectJobsSorted = projectJobsRaw.sort((a, b) => {
            const aStart = new Date(a?.startDate || 0).getTime();
            const bStart = new Date(b?.startDate || 0).getTime();
            if (aStart !== bStart) return bStart - aStart;
            return String(a?.jobName || '').localeCompare(String(b?.jobName || ''));
        });
        const budgetRaw = Number(project.budget || 0);
        const spendRaw = Number(project.totalCost || 0);
        const budgetUsageRaw = Number(project.budgetUsedPercent || 0);
        const selectedName =
            selectedProject?.name ||
            projects?.find(p => String(p._id || p.id) === String(activeProjectId || ''))?.name;

        return {
            projectName: project.name || selectedName || 'No Active Project',
            progress: Number(companyTasks.completionRate || 0),
            completedTasks: Number(companyTasks.completed || 0),
            totalTasks: Number(companyTasks.total || 0),
            totalSpend: Number.isFinite(spendRaw) ? spendRaw : 0,
            totalBudget: Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 0,
            budgetUsage: Number.isFinite(budgetUsageRaw) ? budgetUsageRaw : 0,
            workers: Number(project.totalWorkers || 0),
            projectDeficiencies: Array.isArray(project.deficiencies) ? sortByPriorityThenDate(project.deficiencies) : [],
            projectDailyLogs: Array.isArray(project.recentDailyLogs) ? sortByDateDesc(project.recentDailyLogs, 'date') : [],
            projectJobs: projectJobsSorted
        };
    }, [companyReport, detailedProjectReport, selectedProject, projects, activeProjectId]);

    const selectedJob = useMemo(() => {
        return stats.projectJobs.find(j => String(j._id) === String(selectedJobId)) || stats.projectJobs[0] || null;
    }, [stats.projectJobs, selectedJobId]);

    const flattenTaskTree = (nodes = [], depth = 0) => {
        const rows = [];
        nodes.forEach((node) => {
            rows.push({
                _id: node._id,
                title: node.title || 'Untitled Task',
                status: node.status || 'pending',
                assignedTo: Array.isArray(node.assignedTo) ? node.assignedTo?.[0]?.fullName : node.assignedTo?.fullName || 'Unassigned',
                depth
            });
            if (Array.isArray(node.subtasks) && node.subtasks.length > 0) {
                rows.push(...flattenTaskTree(node.subtasks, depth + 1));
            }
        });
        return rows;
    };

    const selectedJobData = useMemo(() => {
        if (!selectedJob) return null;
        const sortByDateDesc = (list, key) => [...list].sort((a, b) => new Date(b?.[key] || 0) - new Date(a?.[key] || 0));
        const sortByName = (list, key) => [...list].sort((a, b) => String(a?.[key] || '').localeCompare(String(b?.[key] || '')));

        return {
            ...selectedJob,
            workers: sortByName(Array.isArray(selectedJob.workers) ? selectedJob.workers : [], 'name'),
            deficiencies: sortByDateDesc(Array.isArray(selectedJob.deficiencies) ? selectedJob.deficiencies : [], 'date'),
            materials: sortByName(Array.isArray(selectedJob.materials) ? selectedJob.materials : [], 'itemName'),
            equipment: sortByName(Array.isArray(selectedJob.equipment) ? selectedJob.equipment : [], 'name'),
            subcontractors: sortByName(Array.isArray(selectedJob.subcontractors) ? selectedJob.subcontractors : [], 'name'),
            notes: sortByDateDesc(Array.isArray(selectedJob.notes) ? selectedJob.notes : [], 'date')
        };
    }, [selectedJob]);

    const hierarchyRows = useMemo(() => flattenTaskTree(selectedJobData?.tasks || []), [selectedJobData]);
    const summaryCardStyle = useMemo(() => ({ width: isCompact ? '100%' : '48.5%' }), [isCompact]);
    const compactHorizontalPadding = isCompact ? 14 : 20;

    const formatCurrency = (amount) => `$${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—';

    const renderSectionHeader = (icon, title, subtitle) => (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
                <MaterialCommunityIcons name={icon} size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
            </View>
        </View>
    );

    const renderEmpty = (label) => (
        <View style={styles.emptyRow}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#94A3B8" />
            <Text style={styles.emptyText}>{label}</Text>
        </View>
    );

    const toggleSection = (key) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadReports({ showLoader: false });
        setRefreshing(false);
    }, [loadReports]);

    const SectionCard = ({ sectionKey, icon, title, subtitle, children }) => (
        <View style={[styles.sectionCard, SHADOWS.small, { marginHorizontal: compactHorizontalPadding }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => toggleSection(sectionKey)} style={styles.sectionHeaderTap}>
                {renderSectionHeader(icon, title, subtitle)}
                <MaterialCommunityIcons
                    name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#475569"
                />
            </TouchableOpacity>
            {expandedSections[sectionKey] ? <View style={styles.sectionContent}>{children}</View> : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Reports" showBranding={true} showBack={true} />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Syncing reports...</Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                >
                    <View style={[styles.header, { paddingHorizontal: compactHorizontalPadding }]}>
                        <View style={styles.headerTextContainer}>
                            <Text style={[styles.dashboardTitle, isCompact && styles.dashboardTitleCompact]}>Intelligence Command Center</Text>
                            <Text style={styles.dashboardSubtitle} numberOfLines={1}>{stats.projectName}</Text>
                        </View>
                    </View>

                    <View style={[styles.topControls, { paddingHorizontal: compactHorizontalPadding }]}>
                        <View style={styles.modeTabs}>
                            <TouchableOpacity
                                style={[styles.modeBtn, activeMode === 'operations' && styles.modeBtnActive]}
                                onPress={() => setActiveMode('operations')}
                            >
                                <Text style={[styles.modeText, activeMode === 'operations' && styles.modeTextActive]}>OPERATIONS</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeBtn, activeMode === 'site_metrics' && styles.modeBtnActive]}
                                onPress={() => setActiveMode('site_metrics')}
                            >
                                <Text style={[styles.modeText, activeMode === 'site_metrics' && styles.modeTextActive]}>SITE METRICS</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {activeMode === 'operations' ? (
                        <>
                            {operationsView === 'list' ? (
                                <>
                                    <SectionCard sectionKey="operations" icon="finance" title="OPERATIONS SNAPSHOT" subtitle="Budget and execution pulse">
                                        <View style={styles.summaryGrid}>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Budget Used</Text>
                                                <Text style={styles.summaryValue}>{stats.budgetUsage}%</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Total Cost</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(stats.totalSpend)}</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Completed Tasks</Text>
                                                <Text style={styles.summaryValue}>{stats.completedTasks}</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Total Workforce</Text>
                                                <Text style={styles.summaryValue}>{stats.workers}</Text>
                                            </View>
                                        </View>
                                    </SectionCard>

                                    <View style={[styles.sectionCard, SHADOWS.small, { marginHorizontal: compactHorizontalPadding }]}>
                                        <View style={styles.opsHeader}>
                                            <Text style={styles.opsTitle}>ACTIVE WORK UNITS</Text>
                                            <Text style={styles.opsBadge}>{stats.projectJobs.length} Phases Active</Text>
                                        </View>
                                        <Text style={styles.opsSubtitle}>Select a phase to view detailed job intelligence</Text>

                                        {stats.projectJobs.length === 0 ? renderEmpty('No jobs available') : stats.projectJobs.map((job) => (
                                            <TouchableOpacity
                                                key={job._id}
                                                style={styles.opsRow}
                                                onPress={() => {
                                                    setSelectedJobId(job._id);
                                                    setOperationsView('detail');
                                                }}
                                            >
                                                <View style={styles.opsRowTop}>
                                                    <Text style={styles.opsJobName} numberOfLines={1}>{job.jobName || 'Untitled Job'}</Text>
                                                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                                                </View>
                                                <View style={styles.opsMetrics}>
                                                    <Text style={styles.opsMetricText}>Progress: {Number(job.progress || 0)}%</Text>
                                                    <Text style={styles.opsMetricText}>Labor: {formatCurrency(job.financials?.workerCost || 0)}</Text>
                                                    <Text style={styles.opsMetricText}>Material: {formatCurrency(job.financials?.materialCost || 0)}</Text>
                                                    <Text style={[styles.opsMetricText, styles.opsMetricTotal]}>Total: {formatCurrency(job.totalCost || 0)}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={[styles.sectionCard, SHADOWS.small, { marginHorizontal: compactHorizontalPadding }]}>
                                        <View style={styles.opsDetailTop}>
                                            <TouchableOpacity style={styles.backBtn} onPress={() => setOperationsView('list')}>
                                                <MaterialCommunityIcons name="arrow-left" size={16} color="#1D4ED8" />
                                                <Text style={styles.backBtnText}>Back to Work Units</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.opsDetailName}>{selectedJobData?.jobName || 'Selected Job'}</Text>
                                        </View>
                                    </View>

                                    <SectionCard sectionKey="workers" icon="clipboard-account-outline" title="WORKER TIME TRACKING" subtitle={selectedJobData?.jobName || 'Selected job'}>
                                        {!selectedJobData?.workers?.length ? renderEmpty('No worker logs available') : selectedJobData.workers.map((w, idx) => (
                                            <View key={`${w.name}-${idx}`} style={styles.dataCard}>
                                                <Text style={styles.cellMain}>{w.name || 'Unknown Worker'}</Text>
                                                <Text style={styles.cellSub}>Role: {w.role || 'WORKER'} | Hours: {w.totalHours || 0}</Text>
                                                <Text style={styles.cellSubStrong}>Cost: {formatCurrency(w.cost)}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>

                                    <SectionCard sectionKey="subcontractors" icon="account-group-outline" title="SUBCONTRACTOR LOGISTICS" subtitle="Subcontractor workforce and cost">
                                        {!selectedJobData?.subcontractors?.length ? renderEmpty('No subcontractor records') : selectedJobData.subcontractors.map((s, idx) => (
                                            <View key={`${s.name}-${idx}`} style={styles.dataCard}>
                                                <Text style={styles.cellMain}>{s.name || 'Subcontractor'}</Text>
                                                <Text style={styles.cellSub}>Work: {s.work || 'Contracted Services'} | Hours: {s.totalHours || 0}</Text>
                                                <Text style={styles.cellSubStrong}>Cost: {formatCurrency(s.cost)}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>

                                    <SectionCard sectionKey="materials" icon="package-variant-closed" title="MATERIAL CONSUMPTION" subtitle="Purchase order driven quantities">
                                        {!selectedJobData?.materials?.length ? renderEmpty('No material records') : selectedJobData.materials.map((m, idx) => (
                                            <View key={`${m.itemName}-${idx}`} style={styles.dataCard}>
                                                <Text style={styles.cellMain}>{m.itemName || 'Material'}</Text>
                                                <Text style={styles.cellSub}>Qty: {m.quantity || 0}</Text>
                                                <Text style={styles.cellSubStrong}>Cost: {formatCurrency(m.cost)}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>

                                    <SectionCard sectionKey="equipment" icon="excavator" title="EQUIPMENT USAGE" subtitle="Hours and machine-level cost">
                                        {!selectedJobData?.equipment?.length ? renderEmpty('No equipment usage tracked') : selectedJobData.equipment.map((e, idx) => (
                                            <View key={`${e.name}-${idx}`} style={styles.dataCard}>
                                                <Text style={styles.cellMain}>{e.name || 'Equipment'}</Text>
                                                <Text style={styles.cellSub}>Hours: {e.hoursUsed || 0}</Text>
                                                <Text style={styles.cellSubStrong}>Cost: {formatCurrency(e.cost)}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>

                                    <SectionCard sectionKey="efficiencies" icon="chart-box-outline" title="OPERATIONAL EFFICIENCIES" subtitle="Task and cost mix analysis">
                                        <View style={styles.summaryGrid}>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Total Tasks</Text>
                                                <Text style={styles.summaryValue}>{selectedJobData?.summary?.totalTasks || 0}</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Completed</Text>
                                                <Text style={styles.summaryValue}>{selectedJobData?.summary?.completedTasks || 0}</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Pending</Text>
                                                <Text style={styles.summaryValue}>{selectedJobData?.summary?.pendingTasks || 0}</Text>
                                            </View>
                                            <View style={[styles.summaryItem, summaryCardStyle]}>
                                                <Text style={styles.summaryLabel}>Job Cost</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(selectedJobData?.totalCost)}</Text>
                                            </View>
                                        </View>
                                    </SectionCard>

                                    <SectionCard sectionKey="hierarchy" icon="sitemap-outline" title="EXECUTION HIERARCHY" subtitle="Task and nested subtask tree">
                                        {hierarchyRows.length === 0 ? renderEmpty('No execution hierarchy available') : hierarchyRows.map((row, idx) => (
                                            <View key={`${row._id}-${idx}`} style={[styles.dataCard, { marginLeft: row.depth * 12 }]}>
                                                <Text style={styles.cellMain}>{row.title}</Text>
                                                <Text style={styles.cellSub}>Status: {row.status} | Assigned: {row.assignedTo}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>

                                    <SectionCard sectionKey="notes" icon="notebook-multiple-outline" title="INTELLIGENCE NOTES + LOGISTICS" subtitle="Job notes and field observations">
                                        {!selectedJobData?.notes?.length ? renderEmpty('No intelligence notes yet') : selectedJobData.notes.map((note, idx) => (
                                            <View key={`${note.date}-${idx}`} style={styles.dataCard}>
                                                <Text style={styles.cellMain}>{note.content || 'No content'}</Text>
                                                <Text style={styles.cellSub}>By: {note.author || 'System'} | {formatDate(note.date)}</Text>
                                            </View>
                                        ))}
                                    </SectionCard>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <SectionCard sectionKey="siteLogs" icon="timeline-clock-outline" title="CHRONOLOGICAL SITE LOGS" subtitle="Daily entries in time sequence">
                                {stats.projectDailyLogs.length === 0 ? renderEmpty('No site logs found') : stats.projectDailyLogs.map((log, idx) => (
                                    <View key={`${log.date}-${idx}`} style={styles.dataCard}>
                                        <Text style={styles.cellDate}>{formatDate(log.date)}</Text>
                                        <Text style={styles.cellMain}>{log.notes || 'No notes'}</Text>
                                        <Text style={styles.cellSub}>Crew: {log.crewCount || 0} | Foreman: {log.foreman || '—'}</Text>
                                    </View>
                                ))}
                            </SectionCard>

                            <SectionCard sectionKey="deficiencies" icon="alert-decagram-outline" title="PROJECT-WIDE DEFICIENCY AUDIT" subtitle="Open quality and safety issues">
                                {stats.projectDeficiencies.length === 0 ? renderEmpty('No deficiencies logged') : stats.projectDeficiencies.map((item, idx) => (
                                    <View key={`${item.title}-${idx}`} style={styles.dataCard}>
                                        <Text style={styles.cellMain} numberOfLines={2}>{item.title || 'Untitled Issue'}</Text>
                                        <Text style={styles.cellSub}>Priority: {item.priority || '—'} | Status: {item.status || '—'}</Text>
                                        <Text style={styles.cellSub}>Assigned: {item.assignedTo || 'Unassigned'}</Text>
                                    </View>
                                ))}
                            </SectionCard>
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    loadingText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
    scrollContent: { paddingBottom: 40 },

    header: { padding: 20, paddingBottom: 12 },
    headerTextContainer: { flex: 1 },
    dashboardTitle: { fontSize: 21, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
    dashboardTitleCompact: { fontSize: 19 },
    dashboardSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 4 },

    topControls: { paddingHorizontal: 20, gap: 10, marginBottom: 12 },
    modeTabs: { flexDirection: 'row', gap: 8 },
    modeBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44
    },
    modeBtnActive: { backgroundColor: '#E0EAFF', borderColor: '#2563EB' },
    modeText: { fontSize: 11, color: '#334155', fontWeight: '900', letterSpacing: 0.4 },
    modeTextActive: { color: '#1D4ED8' },

    sectionCard: {
        marginHorizontal: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        padding: 12
    },
    sectionHeaderTap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionContent: { paddingTop: 4 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    sectionIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center'
    },
    sectionTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
    sectionSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 },

    opsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    opsTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', letterSpacing: 0.3 },
    opsBadge: {
        fontSize: 10,
        color: '#2563EB',
        fontWeight: '800',
        backgroundColor: '#EFF6FF',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    opsSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '700', marginBottom: 10 },
    opsRow: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 10,
        marginBottom: 8
    },
    opsRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    opsJobName: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '900', paddingRight: 6 },
    opsMetrics: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opsMetricText: { fontSize: 11, color: '#475569', fontWeight: '700' },
    opsMetricTotal: { color: '#1D4ED8', fontWeight: '900' },

    opsDetailTop: { gap: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    backBtnText: { fontSize: 11, color: '#1D4ED8', fontWeight: '800' },
    opsDetailName: { fontSize: 16, color: '#0F172A', fontWeight: '900' },

    dataCard: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8
    },
    cellDate: { fontSize: 11, fontWeight: '900', color: '#1E293B', marginBottom: 3 },
    cellMain: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
    cellSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    cellSubStrong: { fontSize: 11, color: '#1D4ED8', marginTop: 2, fontWeight: '900' },

    emptyRow: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    emptyText: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    summaryItem: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: '#F8FAFC'
    },
    summaryLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },
    summaryValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 2 },

    jobCard: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        backgroundColor: '#F8FAFC'
    },
    jobHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    jobName: { flex: 1, fontSize: 13, fontWeight: '900', color: '#1E293B', paddingRight: 8 },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#1D4ED8',
        backgroundColor: '#DBEAFE',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3
    },
    jobMeta: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 4 }
});

export default ReportsScreen;
