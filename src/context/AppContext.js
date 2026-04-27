import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import api, { setAuthToken } from '../utils/api';
import { useAudioPlayer } from 'expo-audio';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_ISSUES, MOCK_MESSAGES, MOCK_USER, MOCK_ACTIVITY } from '../mock/data';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [issues, setIssues] = useState([]);
    const [messages, setMessages] = useState([]);
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockInTime, setClockInTime] = useState(null);
    const [clockOutTime, setClockOutTime] = useState(null);
    const [activities, setActivities] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [uploadNotes, setUploadNotes] = useState([]);
    const [timeLogs, setTimeLogs] = useState([]);
    const [chatRooms, setChatRooms] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [rfis, setRFIs] = useState([]);
    const [rfiStats, setRfiStats] = useState(null);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastNotifCount, setLastNotifCount] = useState(0);
    const [lastUnreadCount, setLastUnreadCount] = useState(0);
    const [selectedProject, setSelectedProject] = useState(null);

    // Audio setup - using modern expo-audio API
    const notificationPlayer = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    
    const playNotificationSound = () => {
        try {
            if (notificationPlayer) {
                notificationPlayer.play();
            }
        } catch (error) {
            console.log('--- SOUND PLAY ERROR ---', error.message);
        }
    };

    // Persist login state
    useEffect(() => {
        checkToken();
    }, []);

    const checkToken = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const savedUser = await AsyncStorage.getItem('user');

            if (token && savedUser) {
                const parsedUser = JSON.parse(savedUser);
                setAuthToken(token);
                setUser(parsedUser);
                
                // RESTORE CLOCK STATE: Instantly resume session from local storage
                const savedClock = await AsyncStorage.getItem('localClockIn');
                if (savedClock) {
                    const parsed = JSON.parse(savedClock);
                    setIsClockedIn(true);
                    setClockInTime(new Date(parsed.time));
                }

                console.log('--- SESSION RESTORED ---', { role: parsedUser.role });
                fetchInitialData(parsedUser);
            } else {
                // No artificial delay needed
            }
        } catch (e) {
            console.error('Auth check error', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async (restoredUser = null) => {
        try {
            const currentUser = restoredUser || user;
            console.log('--- FETCH INITIAL DATA START ---', { role: currentUser?.role });

            const fetchData = async (url, setter, label, retryCount = 1) => {
                try {
                    const res = await api.get(url);
                    console.log(`[Fetch Success] ${label} (${url})`);
                    if (setter) {
                        const data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.projects || res.data.tasks || res.data);
                        setter(data);
                    }
                    return res;
                } catch (err) {
                    // Optimized Retry Logic: If it's a network error or 5xx, retry once after 1s
                    if (retryCount > 0 && (!err.response || err.response.status >= 500)) {
                        console.warn(`[Retrying] ${label} (${url})...`);
                        await new Promise(r => setTimeout(r, 1000));
                        return fetchData(url, setter, label, retryCount - 1);
                    }
                    console.warn(`[Fetch Failed] ${label} (${url}). Falling back to mock data.`);
                    
                    // --- MOCK FALLBACK INJECTION ---
                    console.warn(`[Mock Fallback] Loading local mock data for ${label}`);
                    let mockData = [];
                    if (label === 'Projects') {
                        mockData = MOCK_PROJECTS.map(p => ({
                            ...p,
                            pmId: currentUser?._id || p.pmId || '1',
                            manager: currentUser?.fullName || currentUser?.name || p.manager,
                            projectManagerId: currentUser?._id || p.projectManagerId || '1'
                        }));
                    }
                    else if (label === 'Tasks') mockData = MOCK_TASKS;
                    else if (label === 'Issues') mockData = MOCK_ISSUES;
                    else if (label === 'Stats') mockData = { myRecentActivity: MOCK_ACTIVITY, crewActivity: MOCK_ACTIVITY };
                    else if (label === 'Team') {
                        mockData = [
                            { _id: currentUser?._id || '1', name: currentUser?.fullName || currentUser?.name || 'John Anderson', role: currentUser?.role || 'Project Manager' }, 
                            { _id: '2', name: 'Mike Foreman', role: 'Site Supervisor' }, 
                            { _id: '3', name: 'Mike Ross', role: 'Worker' }, 
                            { _id: '4', name: 'Harvey Specter', role: 'Subcontractor' }
                        ];
                    }
                    
                    // Transform mock IDs to match _id format expected by some components
                    const formattedMockData = Array.isArray(mockData) 
                        ? mockData.map(item => ({ ...item, _id: item._id || item.id }))
                        : mockData;

                    if (setter) setter(formattedMockData);
                    return { data: formattedMockData };
                }
            };

            // SEQUENTIAL FETCH for stability on mobile devices
            const projRes = await fetchData('/projects', setProjects, 'Projects');
            await new Promise(r => setTimeout(r, 100)); // Minor jitter
            const taskRes = await fetchData('/tasks', setTasks, 'Tasks');
            const jobRes = await fetchData('/jobs', setJobs, 'Jobs');
            const actsRes = await fetchData('/reports/stats', null, 'Stats');
            const chatRes = await fetchData('/chat/rooms', setChatRooms, 'ChatRooms');
            const notifRes = await fetchData('/notifications', setNotifications, 'Notifications');
            const teamRes = await fetchData('/auth/users', setTeamMembers, 'Team');
            const rfiRes = await fetchData('/rfis', setRFIs, 'RFIs');
            const rfiStatsRes = await fetchData('/rfis/stats', setRfiStats, 'RFIStats');
            const todoRes = await fetchData('/todos', setTodos, 'Todos');
            const issueRes = await fetchData('/issues', setIssues, 'Issues');

            if (actsRes?.data) {
                setMetrics(actsRes.data);
                if (actsRes.data.myRecentActivity) setActivities(actsRes.data.myRecentActivity);
                else if (actsRes.data.crewActivity) setActivities(actsRes.data.crewActivity);
            }

            // Sync Clock Status & Logs
            const activeUser = currentUser || user;
            if (activeUser?._id) {
                try {
                    const logsRes = await api.get(`/timelogs?userId=${activeUser._id}`);
                    setTimeLogs(logsRes.data);
                    const active = logsRes.data.find(l => !l.clockOut);
                    setIsClockedIn(!!active);
                    if (active) setClockInTime(new Date(active.clockIn));
                } catch (err) {
                    console.error('[Fetch Failed] Clock Sync:', err.response?.status, err.response?.data || err.message);
                }
            }

        } catch (e) {
            console.error('Data fetch error overall:', e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- NEW: Polling & Sound Management ---
    useEffect(() => {
        if (!loading && notifications.length > lastNotifCount) {
            const hasUnread = notifications.some(n => !n.isRead);
            if (hasUnread) playNotificationSound();
        }
        setLastNotifCount(notifications.length);
    }, [notifications.length]);

    useEffect(() => {
        const currentUnread = (chatRooms || []).reduce((acc, r) => acc + (r.unreadCount || 0), 0);
        if (!loading && currentUnread > lastUnreadCount) {
            playNotificationSound();
        }
        setLastUnreadCount(currentUnread);
    }, [chatRooms]);

    useEffect(() => {
        let interval;
        if (user) {
            interval = setInterval(() => {
                refreshBackgroundData();
            }, 30000); // 30s background check
        }
        return () => clearInterval(interval);
    }, [user]);

    const refreshBackgroundData = async () => {
        try {
            const notifRes = await api.get('/notifications');
            setNotifications(notifRes.data);
            
            const chatRes = await api.get('/chat/rooms');
            setChatRooms(chatRes.data);
        } catch (e) {}
    };



    const login = async (email, password) => {
        try {
            console.log('--- API LOGIN START ---', { email, url: api.defaults.baseURL });
            const res = await api.post('/auth/login',
                { email, password },
                { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
            );

            const { token } = res.data;
            const userData = res.data; // In this API, the root object is the user data

            console.log('User Data received:', { role: userData?.role, hasToken: !!token });

            if (token) {
                setAuthToken(token);
                await AsyncStorage.setItem('token', token);
            }
            if (userData && userData.role) {
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                setUser(userData);
                console.log('User state updated, navigating...');
            } else {
                console.warn('Login success but userData/role missing:', res.data);
                throw new Error('Invalid user data received from server');
            }
 
            // Load data in background, don't block navigation
            fetchInitialData(userData);
            return { success: true };
        } catch (error) {
            console.log('--- API LOGIN ERROR ---', error.response?.status || error.message);
            console.error('Full Error:', error.response?.data || error);

            const errorMsg = error.response?.data?.message || 'Login failed. Check server connection.';
            return { success: false, message: errorMsg };
        }
    };

    const registerCompany = async (companyData) => {
        try {
            const res = await api.post('/auth/register-company', companyData);
            const { token, user: userData } = res.data;

            if (token) {
                setAuthToken(token);
                await AsyncStorage.setItem('token', token);
            }
            if (userData) {
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                setUser(userData);
            }
            await fetchInitialData(userData);
            return { success: true };
        } catch (error) {
            console.error('Registration error', error);
            return { success: false, message: error.response?.data?.message || 'Registration failed' };
        }
    };

    const fetchEquipment = async () => {
        try {
            const res = await api.get('/equipment');
            return res.data;
        } catch (e) {
            return [];
        }
    };

    const updateEquipment = async (id, data) => {
        try {
            await api.patch(`/equipment/${id}`, data);
            return true;
        } catch (e) {
            console.error('Update equipment error', e);
            return false;
        }
    };

    const deleteEquipment = async (id) => {
        try {
            await api.delete(`/equipment/${id}`);
            return true;
        } catch (e) {
            console.error('Delete equipment error', e);
            return false;
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.multiRemove(['token', 'user']);
            setUser(null);
            setProjects([]);
        } catch (e) { }
    };

    const addTask = async (newTask) => {
        try {
            // Map status to backend enum: 'todo', 'in_progress', 'review', 'completed'
            const statusMap = {
                'Pending': 'todo',
                'In Progress': 'in_progress',
                'Done': 'completed',
                'pending': 'todo',
                'in-progress': 'in_progress',
                'completed': 'completed'
            };

            const payload = {
                ...newTask,
                category: (newTask.category || 'TASK').toUpperCase(),
                status: statusMap[newTask.status] || 'todo',
                priority: newTask.priority ? (newTask.priority.charAt(0).toUpperCase() + newTask.priority.slice(1).toLowerCase()) : 'Medium',
                // If assignedTo is a member name, we should ideally find their ID
                // For now, let's just make sure we don't crash and try to send what's there
                assignedTo: Array.isArray(newTask.assignedTo) ? newTask.assignedTo : []
            };

            const res = await api.post('/tasks', payload);
            setTasks([res.data, ...tasks]);
            return true;
        } catch (e) {
            console.error('Add task error', e.response?.data || e);
            return false;
        }
    };

    const updateTask = async (rawId, taskData) => {
        const id = String(rawId || '').trim();
        console.log(`--- [AppContext] START updateTask ---`, { id, taskTitle: taskData?.title, status: taskData?.status });

        if (!id || id === 'undefined' || id === 'null') {
            console.error('--- [AppContext] REJECTING UPDATE: INVALID ID ---', { rawId });
            return false;
        }

        try {
            const statusMap = {
                'Pending': 'todo', 'In Progress': 'in_progress', 'Done': 'completed',
                'pending': 'todo', 'in-progress': 'in_progress', 'completed': 'completed'
            };

            // Only send fields that are actually being updated
            const payload = {};
            const allowedFields = ['status', 'progress', 'remarks', 'cancellationReason', 'priority', 'title', 'description', 'dueDate', 'startDate', 'assignedTo'];
            
            allowedFields.forEach(field => {
                if (taskData[field] !== undefined) {
                    let value = taskData[field];
                    if (field === 'status') value = statusMap[value] || value;
                    payload[field] = value;
                }
            });

            // ROUTE DISCOVERY: Check indicators and ID types
            const isJobTask = 
                taskData.isJobTask === true || 
                taskData.type === 'JobTask' || 
                taskData.category === 'JOB_TASK' || 
                !!taskData.jobId || 
                !!taskData.taskId?.jobId;

            const primaryEndpoint = isJobTask ? `/job-tasks/${id}` : `/tasks/${id}`;
            const secondaryEndpoint = isJobTask ? `/tasks/${id}` : `/job-tasks/${id}`;

            console.log(`--- [AppContext] UPDATING TASK: ${id} | Primary: ${primaryEndpoint} ---`);

            let res;
            try {
                res = await api.patch(primaryEndpoint, payload);
            } catch (err) {
                // If 404, the task might exist in the other collection
                if (err.response?.status === 404) {
                    console.warn(`--- [AppContext] 404 on ${primaryEndpoint}. FALLBACK TO ${secondaryEndpoint} ---`);
                    res = await api.patch(secondaryEndpoint, payload);
                } else {
                    throw err;
                }
            }
            
            const updated = res.data;

            console.log(`--- [AppContext] UPDATE SUCCESS ---`, { id, model: updated.isJobTask ? 'JobTask' : 'Task' });

            // Update global tasks state
            setTasks(prev => (prev || []).map(t => {
                const tId = String(t._id || t.id || t.taskId?._id || '');
                return (tId === id) ? { ...t, ...updated } : t;
            }));

            // Sync with worker metrics if applicable
            if (metrics?.workerMetrics?.assignedTasks) {
                setMetrics(prev => ({
                    ...prev,
                    workerMetrics: {
                        ...prev.workerMetrics,
                        assignedTasks: prev.workerMetrics.assignedTasks.map(t => {
                             const tId = String(t._id || t.id || t.taskId?._id || '');
                             return (tId === id) ? { ...t, ...updated } : t;
                        })
                    }
                }));
            }

            return true;
        } catch (e) {
            console.error('--- [AppContext] UPDATE TASK FAILED ---');
            console.error('ID:', id);
            console.error('Error Status:', e.response?.status);
            console.error('Error Data:', e.response?.data);
            console.error('Error Message:', e.message);
            return false;
        }
    };

    const deleteTask = async (id) => {
        try {
            await api.delete(`/tasks/${id}`);
            setTasks(tasks.filter(t => t._id !== id && t.id !== id));
            return true;
        } catch (e) {
            console.error('Delete task error', e);
            return false;
        }
    };

    const updateJob = async (id, status) => {
        try {
            const res = await api.patch(`/jobs/${id}`, { status });
            setJobs(prev => prev.map(j => (j._id === id || j.id === id) ? res.data : j));
            return true;
        } catch (e) {
            console.error('Update job error', e);
            return false;
        }
    };

    const addJob = async (jobData) => {
        try {
            const res = await api.post('/jobs', jobData);
            setJobs([res.data, ...jobs]);
            return { success: true, data: res.data };
        } catch (e) {
            console.error('Add job error', e.response?.data || e.message);
            return { success: false, message: e.response?.data?.message || 'Failed to create job' };
        }
    };

    const addRFI = async (rfiData) => {
        try {
            const res = await api.post('/rfis', rfiData);
            setRFIs([res.data, ...rfis]);
            fetchInitialData(); // Refresh stats
            return true;
        } catch (e) {
            console.error('Add RFI error', e);
            return false;
        }
    };

    const addIssue = async (issueData) => {
        try {
            const res = await api.post('/issues', issueData);
            setIssues([res.data, ...issues]);
            return { success: true, data: res.data };
        } catch (e) {
            console.error('Add Issue error', e);
            return { success: false, message: e.response?.data?.message || 'Failed to file snag' };
        }
    };

    const addProject = async (newProject) => {
        try {
            // Sanitize budget (strip $ and ,)
            const cleanBudget = typeof newProject.budget === 'string'
                ? newProject.budget.replace(/[^0-9.]/g, '')
                : newProject.budget;

            const payload = {
                ...newProject,
                budget: parseFloat(cleanBudget) || 0,
                status: newProject.status === 'on-hold' ? 'on_hold' : (newProject.status || 'active').toLowerCase(),
                progress: parseInt(newProject.progress) || 0,
                pmId: newProject.pmId || null,
                clientId: newProject.clientId || null,
                projectManager: newProject.pmName || 'Unassigned'
            };
            const res = await api.post('/projects', payload);
            setProjects([res.data, ...projects]);
            return true;
        } catch (e) {
            console.error('Create project error', e.response?.data || e);
            return false;
        }
    };

    const updateProject = async (id, projectData) => {
        try {
            const cleanBudget = typeof projectData.budget === 'string'
                ? projectData.budget.replace(/[^0-9.]/g, '')
                : projectData.budget;

            const payload = {
                ...projectData,
                budget: parseFloat(cleanBudget) || 0,
                status: projectData.status === 'on-hold' ? 'on_hold' : (projectData.status || 'active').toLowerCase(),
                progress: parseInt(projectData.progress) || 0,
                pmId: projectData.pmId || null,
                clientId: projectData.clientId || null,
                projectManager: projectData.pmName || projectData.projectManager
            };
            const res = await api.patch(`/projects/${id}`, payload);
            const updated = res.data;
            setProjects(projects.map(p => (p._id === id || p.id === id) ? updated : p));
            return true;
        } catch (e) {
            console.error('Update project error', e.response?.data || e);
            return false;
        }
    };

    const deleteProject = async (id) => {
        try {
            await api.delete(`/projects/${id}`);
            setProjects(projects.filter(p => (p._id || p.id) !== id));
            return true;
        } catch (e) {
            console.error('Delete project error', e);
            return false;
        }
    };

    const toggleClock = async (projectId, taskId = null) => {
        const now = new Date();
        const pId = typeof projectId === 'string' ? projectId : null;
        const tId = typeof taskId === 'string' ? taskId : null;

        try {
            // Check if location services are enabled on the device
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                throw new Error('Location services are disabled on your device. Please enable GPS and try again.');
            }

            let { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                if (!canAskAgain) {
                    throw new Error('Location permission is permanently denied. Please enable it in your Phone Settings > BuildMaster PRO > Location.');
                }
                throw new Error('Permission to access location was denied. GPS is required for Site Check-In verification.');
            }

            const location = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Balanced,
                timeout: 5000 
            });
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };

            if (!isClockedIn) {
                if (!pId) {
                    throw new Error('Project selection required for clock-in');
                }
                const res = await api.post('/timelogs/clock-in', {
                    projectId: pId,
                    taskId: tId,
                    latitude: coords.latitude,
                    longitude: coords.longitude
                });
                
                const serverLog = res.data;
                setIsClockedIn(true);
                setClockInTime(new Date(serverLog.clockIn));
                
                // UPDATE LOGS: Add the new clock-in record to the top of the history
                setTimeLogs(prev => [serverLog, ...prev]);
                
                // PERSIST: Save to local storage
                await AsyncStorage.setItem('localClockIn', JSON.stringify({ isClockedIn: true, time: serverLog.clockIn, pId }));

                // OPTIMISTIC ACTIVITY UPDATE
                const activeProject = (projects || []).find(p => p._id === pId);
                setActivities(prev => [{
                    type: 'clock_in',
                    createdAt: now.toISOString(),
                    projectId: { _id: pId, name: activeProject?.name || 'Project Site' },
                    taskId: tId
                }, ...prev]);

                return serverLog;
            } else {
                console.log('--- ATTEMPTING CLOCK-OUT ---');
                const res = await api.post('/timelogs/clock-out', {
                    latitude: coords.latitude,
                    longitude: coords.longitude
                });
                
                const updatedLog = res.data;
                setIsClockedIn(false);
                setClockOutTime(now);

                // UPDATE LOGS: Mark the active log as finished in the local state
                setTimeLogs(prev => prev.map(log => 
                    (log._id === updatedLog._id || !log.clockOut) ? updatedLog : log
                ));

                // PERSIST: Clear local storage
                await AsyncStorage.removeItem('localClockIn');

                // OPTIMISTIC ACTIVITY UPDATE
                setActivities(prev => [{
                    type: 'clock_out',
                    createdAt: now.toISOString(),
                    projectId: updatedLog.projectId || { name: 'Project Site' }
                }, ...prev]);

                return updatedLog;
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;

            // SYNC FIX for Railway Live Backend:
            // Dual-Sync Logic: Handles cases where local state is out of sync with server.
            
            // Case 1: App says "On-Site" but Server says "Off-Site"
            if (errorMsg === 'User not clocked in') {
                console.warn('Silent Sync: Server says Off-Site. Resetting local state...');
                setIsClockedIn(false);
                setClockInTime(null);
                return { success: true, synced: true };
            }

            // Case 2: App says "Off-Site" but Server says "On-Site"
            if (errorMsg === 'User already clocked in') {
                console.warn('Silent Sync: Server says On-Site. Syncing local state...');
                setIsClockedIn(true);
                fetchInitialData(); 
                return { success: true, synced: true };
            }

            console.error('Clock toggle error', errorMsg);
            throw e;
        }
    };

    const getWorkDuration = () => {
        if (!clockInTime || isNaN(clockInTime.getTime())) return '00:00:00';
        const now = new Date();
        const diff = Math.max(0, now.getTime() - clockInTime.getTime());

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const updateProfile = async (profileData) => {
        try {
            const res = await api.patch('/auth/profile', profileData);
            const updatedUser = { ...user, ...res.data };
            setUser(updatedUser);
            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            return { success: true };
        } catch (error) {
            console.error('Update profile error', error);
            return { success: false, message: error.response?.data?.message || 'Update failed' };
        }
    };

    /** Resolve peer user id → DIRECT ChatRoom id (GET/POST /chat/direct). Required for DM list + send. */
    const ensureDirectChatRoom = async (peerUserId) => {
        try {
            if (!peerUserId) return null;
            const res = await api.post('/chat/direct', { targetUserId: peerUserId });
            const id = res.data?.id || res.data?._id;
            return id ? id.toString() : null;
        } catch (e) {
            const data = e.response?.data;
            const msg =
                typeof data === 'string' ? data : (data?.message || data?.error || e.message || '');
            const legacyPmClient =
                typeof msg === 'string' &&
                msg.includes('Project Managers are not permitted to initiate direct chats with Clients');
            if (legacyPmClient) {
                console.warn(
                    '[Chat] Your API is still on an old build. Redeploy Constuction_Backend with the current chatController (PMs may DM clients). Until then, direct chats with clients will fail.'
                );
            } else {
                console.warn('ensureDirectChatRoom:', msg);
            }
            return null;
        }
    };

    const fetchMessages = async (roomId) => {
        try {
            if (!roomId) return [];
            
            let finalRoomId = roomId;

            // SMART SYNC: If the ID looks like a Project ID, try to find the actual ChatRoom document ID.
            const isHexId = /^[0-9a-fA-F]{24}$/.test(roomId);
            if (isHexId) {
                const existingRoom = (chatRooms || []).find(r => 
                    ((r.projectId?._id || r.projectId) === roomId) && r.type === 'project'
                );
                if (existingRoom) {
                    finalRoomId = existingRoom._id || existingRoom.id;
                    console.log('--- SMART SYNC (Fetch): Mapping Project to Room ---', { projectId: roomId, finalRoomId });
                }
            }

            // FINAL VALIDATION: Prevent sending known malformed or invalid IDs
            const isValidFormat = finalRoomId === 'GENERAL_COMPANY' || /^[0-9a-fA-F]{24}$/.test(finalRoomId);
            if (!isValidFormat) {
                return { success: false, message: 'Invalid room format' };
            }

            console.log(`[Fetching Messages] Room ID: ${finalRoomId}`);

            const res = await api.get(`/chat/${finalRoomId}`);
            const newMsgs = res.data;
            
            setMessages(prev => {
                const combined = [...prev, ...newMsgs];
                const uniqueMap = new Map();
                combined.forEach(m => {
                    const id = m._id || m.id;
                    if (id) uniqueMap.set(id.toString(), m);
                });
                return Array.from(uniqueMap.values());
            });
            return { success: true, data: newMsgs };
        } catch (e) {
            const isAuthError = e.response?.status === 403 || e.response?.data?.message?.includes('authorized');
            if (isAuthError) {
                console.warn(`[Chat Restricted] User not authorized for room: ${roomId}`);
                return { success: false, unauthorized: true, message: 'You do not have access to this discussion.' };
            }
            console.error('Fetch messages error', e.response?.data || e.message);
            return { success: false, message: e.message };
        }
    };


    const sendMessage = async (text, projectId = null, receiverId = null, roomId = null, attachments = []) => {
        try {
            const pStr = projectId?.toString();
            const rStr = roomId?.toString();
            
            let finalRoomId = rStr || pStr || receiverId?.toString();

            // SMART SYNC: Deep discovery of the correct room ID
            if (pStr && (finalRoomId === pStr || !finalRoomId)) {
                const existingRoom = (chatRooms || []).find(r => {
                    // Try every possible key where the Project ID might be stored
                    const p1 = (r.projectId?._id || r.projectId)?.toString();
                    const p2 = (r.project?._id || r.project)?.toString();
                    const p3 = (r.relatedId?._id || r.relatedId)?.toString();
                    const p4 = (r.projectId?.$oid || r.project?.$oid)?.toString();
                    
                    return p1 === pStr || p2 === pStr || p3 === pStr || p4 === pStr;
                });
                
                if (existingRoom) {
                    finalRoomId = (existingRoom._id || existingRoom.id)?.toString();
                    console.log('--- SMART SYNC (Send): Deep Resolved Room ID ---', { pStr, finalRoomId });
                }
            }

            const payload = { 
                message: text,
                attachments: attachments,
                roomId: finalRoomId
            };

            if (projectId) payload.projectId = pStr;
            if (receiverId) payload.receiverId = receiverId?.toString();

            console.log('--- SUBMITTING CHAT ---', { roomId: finalRoomId, projectId: pStr });

            const res = await api.post('/chat', payload);
            const savedMsg = res.data;

            setMessages(prev => {
                const rawRoom = savedMsg.roomId ?? payload.roomId;
                const rawProj = savedMsg.projectId ?? payload.projectId;
                const normalizedMsg = {
                    ...savedMsg,
                    id: savedMsg._id || savedMsg.id,
                    roomId: rawRoom != null ? String(rawRoom) : undefined,
                    projectId: rawProj != null ? String(rawProj) : undefined,
                    receiverId: savedMsg.receiverId || payload.receiverId
                };

                if (prev.find(m => (m._id || m.id) === normalizedMsg.id)) return prev;
                return [...prev, normalizedMsg];
            });
            return true;
        } catch (e) {
            console.error('Send message error', e.response?.data || e);
            return false;
        }
    };

    const uploadFile = async (fileUri, fileName, fileType = 'image/jpeg', description = '', projectId = '') => {
        try {
            const formData = new FormData();
            formData.append('image', {
                uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
                name: fileName || 'upload.jpg',
                type: fileType
            });
            if (description) formData.append('description', description);
            if (projectId) formData.append('projectId', projectId);

            console.log('--- UPLOADING FILE ---', { uri: fileUri, type: fileType, description, projectId });
            const res = await api.post('/photos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            return {
                url: res.data.imageUrl,
                name: fileName || 'attachment',
                fileType: fileType,
                description: res.data.description || description
            };
        } catch (error) {
            console.error('File upload error:', error.response?.data || error.message);
            throw error;
        }
    };

    const updatePassword = async (passwordData) => {
        try {
            await api.patch('/auth/updatepassword', passwordData);
            return { success: true };
        } catch (error) {
            console.error('Update password error', error);
            return { success: false, message: error.response?.data?.message || 'Password update failed' };
        }
    };

    const fetchTeamMembers = async () => {
        try {
            const res = await api.get('/auth/users');
            setTeamMembers(res.data);
            return res.data;
        } catch (error) {
            console.warn('Fetch team error (falling back to mock team):', error.message);
            const mockTeam = MOCK_PROJECTS[0]?.team || [{ _id: '1', name: 'John Anderson', role: 'Project Manager' }];
            const formattedMockTeam = mockTeam.map(m => ({ ...m, _id: m._id || m.id || Math.random().toString() }));
            setTeamMembers(formattedMockTeam);
            return formattedMockTeam;
        }
    };

    const inviteMember = async (memberData) => {
        try {
            await api.post('/auth/register', {
                ...memberData,
                companyId: user?.companyId
            });
            await fetchTeamMembers();
            return { success: true };
        } catch (error) {
            console.error('Invite error', error);
            return { success: false, message: error.response?.data?.message || 'Failed to invite' };
        }
    };

    const updateTeamMember = async (id, memberData) => {
        try {
            await api.patch(`/auth/users/${id}`, memberData);
            await fetchTeamMembers();
            return { success: true };
        } catch (error) {
            console.error('Update team member error', error);
            return { success: false, message: error.response?.data?.message || 'Update failed' };
        }
    };

    const deleteTeamMember = async (id) => {
        try {
            await api.delete(`/auth/users/${id}`);
            await fetchTeamMembers();
            return { success: true };
        } catch (error) {
            console.error('Delete team member error', error);
            return { success: false, message: error.response?.data?.message || 'Delete failed' };
        }
    };

    const addTodo = async (todoData) => {
        try {
            // Ensure title is present (backend requirement)
            const title = todoData.title || todoData.description || todoData.text;
            
            if (!title) {
                console.error('--- [AppContext] ADD TODO REJECTED: Title is missing ---', todoData);
                return null;
            }

            const payload = {
                ...todoData,
                title,
                status: todoData.status || 'pending',
                priority: todoData.priority || 'Medium'
            };

            if (payload.assignedTo == null || payload.assignedTo === '') {
                if (user?._id) payload.assignedTo = user._id;
            }

            console.log('--- [AppContext] ADD TODO START ---', payload);
            const res = await api.post('/todos', payload);
            console.log('--- [AppContext] ADD TODO SUCCESS ---', res.data._id);
            setTodos(prev => [res.data, ...(prev || [])]);
            return res.data;
        } catch (error) {
            console.error('--- [AppContext] ADD TODO FAILED ---', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            return null;
        }
    };

    const toggleTodo = async (rawId) => {
        const id = String(rawId || '').trim();
        if (!id || id === 'undefined' || id === 'null') {
            console.error('--- [AppContext] toggleTodo REJECTED: Invalid ID ---', { rawId });
            return false;
        }

        try {
            const todo = (todos || []).find(t => (t._id || t.id) === id);
            if (!todo) {
                console.error('--- [AppContext] toggleTodo FAILED: Todo not found ---', { id });
                return false;
            }

            // Map statuses correctly: Backend uses 'pending' and 'completed'
            const currentStatus = (todo.status || '').toLowerCase();
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            
            console.log(`--- [AppContext] TOGGLING TODO: ${id} | ${currentStatus} -> ${newStatus} ---`);
            
            const res = await api.patch(`/todos/${id}`, { status: newStatus });
            const updatedTodo = res.data;

            setTodos(prev => (prev || []).map(t => (t._id === id || t.id === id) ? updatedTodo : t));
            return true;
        } catch (error) {
            console.error('--- [AppContext] toggleTodo API ERROR ---', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            return false;
        }
    };

    const deleteTodo = async (rawId) => {
        const id = String(rawId || '').trim();
        if (!id || id === 'undefined' || id === 'null') return false;

        try {
            await api.delete(`/todos/${id}`);
            setTodos(prev => (prev || []).filter(t => (t._id !== id && t.id !== id)));
            return true;
        } catch (error) {
            console.error('Delete todo error', error.response?.status, error.response?.data);
            return false;
        }
    };

    const resolveUser = (userRef) => {
        if (!userRef) return { fullName: 'Admin', role: 'System' };
        if (typeof userRef === 'object' && (userRef.fullName || userRef.name)) {
            return {
                ...userRef,
                fullName: userRef.fullName || userRef.name
            };
        }
        const userId = typeof userRef === 'object' ? (userRef._id || userRef.id) : userRef;
        const member = (teamMembers || []).find(m => (m._id || m.id) === userId);
        if (member) return member;
        if (userId === user?._id) return user;
        return { fullName: 'Team Member', _id: userId };
    };

    return (
        <AppContext.Provider value={{
            resolveUser,
            user, login, logout, registerCompany,
            updateProfile, updatePassword,
            teamMembers, fetchTeamMembers, inviteMember, updateTeamMember, deleteTeamMember,
            projects, addProject, updateProject, deleteProject,
            tasks, addTask, updateTask, deleteTask, setTasks,
            jobs, addJob, updateJob,
            updateEquipment, deleteEquipment,
            issues, setIssues, addIssue,
            messages, setMessages, sendMessage, fetchMessages, ensureDirectChatRoom, uploadFile,
            rfis, rfiStats, addRFI,
            isClockedIn, toggleClock,
            clockInTime, clockOutTime, getWorkDuration,
            activities,
            timeLogs,
            chatRooms,
            notifications,
            metrics,
            todos, addTodo, toggleTodo, deleteTodo,
            unreadChatCount: (chatRooms || []).reduce((acc, room) => acc + (room.unreadCount || 0), 0),
            uploadNotes, setUploadNotes,
            addUploadNote: (note) => setUploadNotes([note, ...uploadNotes]),
            refreshData: fetchInitialData,
            markNotificationAsRead: async (id) => {
                try {
                    await api.patch(`/notifications/${id}/read`);
                    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
                } catch (e) {
                    console.error('Mark read error', e);
                }
            },
            loading,
            selectedProject,
            setSelectedProject
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);

