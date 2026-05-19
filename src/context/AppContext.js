import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform, Alert, AppState } from 'react-native';
import api, { setAuthToken } from '../utils/api';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { io } from 'socket.io-client';
import { registerFcmToken, deactivateFcmToken } from '../utils/pushNotifications';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_ISSUES, MOCK_MESSAGES, MOCK_USER, MOCK_ACTIVITY } from '../mock/data';

const AppContext = createContext();

/**
 * POST /tasks only accepts parentTaskId referencing a Task document.
 * The flat task feed can include SubTask and JobTask rows whose _id is not a Task.
 */
function extractUserId(assignee) {
    if (assignee == null || assignee === '') return '';
    if (typeof assignee === 'object') return String(assignee._id || assignee.id || '').trim();
    return String(assignee).trim();
}

function resolveCanonicalTaskParentId(parentId, taskList) {
    if (!parentId) return '';
    let id = String(parentId).trim();
    const visited = new Set();
    for (let depth = 0; depth < 24; depth++) {
        if (!id || visited.has(id)) return '';
        visited.add(id);
        const row = (taskList || []).find((x) => String(x._id || x.id) === id);
        if (!row) return id;
        if (row.isJobTask) return '';
        if (!row.isSubTask) return String(row._id || row.id);
        const ref = row.taskId?._id || row.taskId;
        if (!ref) return '';
        if (row.onModel === 'JobTask') return '';
        id = String(ref);
    }
    return '';
}

const STRICT_SYNC_LABELS = new Set([
    'Projects',
    'Tasks',
    'Jobs',
    'ChatRooms',
    'Notifications',
    'Team',
    'RFIs',
    'Todos',
    'Issues'
]);

export const AppProvider = ({ children }) => {
    const socketRef = useRef(null);
    const chatRoomsRef = useRef([]);
    const appStateRef = useRef(AppState.currentState);
    const lastPopupMessageIdRef = useRef(null);
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
    const [syncStatus, setSyncStatus] = useState({ level: 'ok', message: '', at: null, roleScope: '' });
    const [lastNotifCount, setLastNotifCount] = useState(0);
    const [lastUnreadCount, setLastUnreadCount] = useState(0);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isClocking, setIsClocking] = useState(false);

    useEffect(() => {
        chatRoomsRef.current = Array.isArray(chatRooms) ? chatRooms : [];
    }, [chatRooms]);

    const emitJoinRoom = (roomId) => {
        const rid = String(roomId || '').trim();
        if (!rid) return;
        const socket = socketRef.current;
        if (!socket || !socket.connected) return;
        socket.emit('join_room', rid);
    };

    const normalizeNotifications = (rawList) => {
        const list = Array.isArray(rawList) ? rawList : [];
        const map = new Map();
        list.forEach((item) => {
            const id = String(item?._id || item?.id || '');
            if (!id) return;
            const normalized = {
                ...item,
                _id: item._id || item.id,
                title: item.title || 'Notification',
                message: item.message || '',
                type: (item.type || 'system').toLowerCase(),
                isRead: !!item.isRead
            };
            map.set(id, normalized);
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    };

    const incomingChatTone = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
    const sentChatTone = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
    const incomingChatPlayer = useAudioPlayer(incomingChatTone);
    const sentChatPlayer = useAudioPlayer(sentChatTone);

    useEffect(() => {
        const configureAudio = async () => {
            try {
                await setAudioModeAsync({
                    playsInSilentMode: true,
                    allowsRecording: false,
                    shouldPlayInBackground: false
                });
            } catch (error) {
                console.log('--- AUDIO MODE ERROR ---', error.message);
            }
        };
        configureAudio();
    }, []);

    const playIncomingChatSound = async () => {
        try {
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: false,
                shouldPlayInBackground: false
            });
            if (incomingChatPlayer) {
                incomingChatPlayer.volume = 1;
                await incomingChatPlayer.seekTo(0);
                incomingChatPlayer.play();
            }
        } catch (error) {
            console.log('--- SOUND PLAY ERROR ---', error.message);
        }
    };

    const playSentChatSound = async () => {
        try {
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: false,
                shouldPlayInBackground: false
            });
            if (sentChatPlayer) {
                sentChatPlayer.volume = 1;
                await sentChatPlayer.seekTo(0);
                sentChatPlayer.play();
            }
        } catch (error) {
            console.log('--- SENT SOUND ERROR ---', error.message);
        }
    };

    // Persist login state
    useEffect(() => {
        checkToken();
    }, []);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;
        });
        return () => sub?.remove?.();
    }, []);

    // FCM token registration effect on login/session restore
    useEffect(() => {
        if (user && user._id) {
            registerFcmToken(user._id).catch(err => {
                console.log('[FCM AppContext Register Error]', err.message);
            });
        }
    }, [user?._id]);

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
                if (parsedUser?.role) {
                    const roleScope = ['ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER'].includes(parsedUser.role)
                        ? 'Full org visibility'
                        : `Role-scoped visibility (${parsedUser.role})`;
                    setSyncStatus((prev) => ({ ...prev, roleScope }));
                }
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
            const strictFailures = [];

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

                    // Keep app/web parity reliable: never inject mock data for core synced modules.
                    if (STRICT_SYNC_LABELS.has(label)) {
                        const status = err?.response?.status || 'NETWORK';
                        const message = err?.response?.data?.message || err?.message || 'Unknown error';
                        console.warn(`[Fetch Failed] ${label} (${url}) [${status}] ${message}. Keeping last live state.`);
                        strictFailures.push({ label, status, message });
                        return { data: null, failed: true, label, status, message };
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
            // Give the backend a moment to settle after any recent POST operations
            await new Promise(r => setTimeout(r, 800)); 
            const taskRes = await fetchData('/tasks', (data) => {
                const normalized = (data || []).map(t => {
                    const taskIdRef = t.taskId?._id || t.taskId || null;
                    const parentSubTaskIdRef = t.parentSubTaskId?._id || t.parentSubTaskId || null;
                    const inferredParentId = parentSubTaskIdRef || taskIdRef || null;
                    const normalizedProjectId =
                        typeof t.projectId === 'string'
                            ? { _id: t.projectId }
                            : (t.projectId || t.taskId?.projectId || t.taskId?.jobId?.projectId || null);

                    return {
                        ...t,
                        _id: t._id || t.id,
                        projectId: normalizedProjectId,
                        // For SubTask model items, map parent linkage into the same key consumed by app hierarchy UI.
                        parentTaskId: t.parentTaskId?._id || t.parentTaskId || (t.isSubTask ? inferredParentId : null),
                        level: Number(t.level || 0),
                        path: t.path || '',
                        isSubTask: !!(t.isSubTask || t.parentSubTaskId || t.taskId || t.parentTaskId)
                    };
                });
                
                setTasks(prev => {
                    const existingById = new Map((normalized || []).map(t => [String(t._id || t.id), t]));
                    const now = Date.now();

                    for (const previousTask of (prev || [])) {
                        const previousId = String(previousTask._id || previousTask.id || '');
                        if (!previousId || existingById.has(previousId)) continue;
                        const recentlyOptimistic = previousTask.isOptimistic && (now - (previousTask.createdAtTimestamp || 0) < 20000);
                        if (recentlyOptimistic) {
                            existingById.set(previousId, previousTask);
                        }
                    }

                    return Array.from(existingById.values());
                });
            }, 'Tasks');
            const jobRes = await fetchData('/jobs', setJobs, 'Jobs');
            const actsRes = await fetchData('/reports/stats', null, 'Stats');
            const chatRes = await fetchData('/chat/rooms', setChatRooms, 'ChatRooms');
            const notifRes = await fetchData('/notifications', (data) => setNotifications(normalizeNotifications(data)), 'Notifications');
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
                const logsRes = await fetchData(`/timelogs?userId=${activeUser._id}`, setTimeLogs, 'Clock Sync');
                if (logsRes?.data && Array.isArray(logsRes.data)) {
                    const active = logsRes.data.find(l => !l.clockOut);
                    setIsClockedIn(!!active);
                    if (active) setClockInTime(new Date(active.clockIn));
                }
            }

            if (strictFailures.length > 0) {
                const first = strictFailures[0];
                setSyncStatus((prev) => ({
                    ...prev,
                    level: 'warn',
                    at: Date.now(),
                    message: `Live sync issue in ${first.label}. Showing last synced data; pull to refresh when network stabilizes.`
                }));
            } else {
                setSyncStatus((prev) => ({ ...prev, level: 'ok', message: '', at: Date.now() }));
            }

        } catch (e) {
            console.error('Data fetch error overall:', e.message);
            setSyncStatus((prev) => ({
                ...prev,
                level: 'warn',
                at: Date.now(),
                message: 'Live sync temporarily unavailable. Showing last synced data.'
            }));
        } finally {
            setLoading(false);
        }
    };

    // --- NEW: Polling & Sound Management ---
    useEffect(() => {
        if (!loading && notifications.length > lastNotifCount) {
            const hasUnread = notifications.some(n => !n.isRead);
            if (hasUnread) playIncomingChatSound();
        }
        setLastNotifCount(notifications.length);
    }, [notifications.length]);

    useEffect(() => {
        const currentUnread = (chatRooms || []).reduce((acc, r) => acc + (r.unreadCount || 0), 0);
        if (!loading && currentUnread > lastUnreadCount) {
            playIncomingChatSound();
        }
        setLastUnreadCount(currentUnread);
    }, [chatRooms]);

    useEffect(() => {
        let interval;
        if (user) {
            interval = setInterval(() => {
                refreshBackgroundData();
            }, 10000); // 10s fallback refresh; real-time handled by socket
        }
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        let mounted = true;
        const connectSocket = async () => {
            if (!user?._id) return;

            const token = await AsyncStorage.getItem('token');
            const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
            if (!token || !base) return;

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }

            const socket = io(base, {
                transports: ['websocket', 'polling'],
                auth: { token },
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });

            const joinKnownRooms = () => {
                (chatRoomsRef.current || []).forEach((room) => {
                    const rid = room?.id || room?._id;
                    if (rid) socket.emit('join_room', String(rid));
                });
            };

            socket.on('connect', () => {
                socket.emit('register_user', {
                    _id: user._id,
                    fullName: user.fullName || user.name || 'User',
                    role: user.role,
                    companyId: user.companyId
                });
                joinKnownRooms();
            });

            socket.on('connect_error', () => {
                // Keep silent fallback; background refresh handles temporary socket instability.
            });
            if (socket.io && typeof socket.io.on === 'function') {
                socket.io.on('reconnect', () => {
                    joinKnownRooms();
                });
            }

            socket.on('new_message', (incoming) => {
                if (!mounted || !incoming) return;
                const incomingId = String(incoming._id || incoming.id || '');
                const normalizedRoomId = String(incoming.roomId?._id || incoming.roomId || '');
                const normalizedProjectId = incoming.projectId
                    ? String(incoming.projectId?._id || incoming.projectId)
                    : null;
                const normalizedIncoming = {
                    ...incoming,
                    id: incoming._id || incoming.id,
                    roomId: normalizedRoomId || undefined,
                    projectId: normalizedProjectId || undefined
                };
                setMessages((prev) => {
                    if (!incomingId) return prev;
                    if ((prev || []).some((m) => String(m._id || m.id) === incomingId)) return prev;
                    return [...(prev || []), normalizedIncoming];
                });
                setChatRooms((prev) => {
                    const current = Array.isArray(prev) ? [...prev] : [];
                    const roomId = normalizedRoomId;
                    if (!roomId) return current;
                    const idx = current.findIndex((r) => String(r.id || r._id) === roomId);
                    if (idx === -1) return current;

                    const senderId = String(incoming.sender?._id || incoming.sender || incoming.senderId || '');
                    const isMine = senderId && senderId === String(user._id);
                    const room = { ...current[idx] };
                    room.lastMessage = {
                        text: incoming.message,
                        sender: incoming.sender?.fullName || room.lastMessage?.sender || 'User',
                        time: incoming.createdAt || new Date().toISOString()
                    };
                    room.unreadCount = isMine ? (room.unreadCount || 0) : ((room.unreadCount || 0) + 1);
                    current.splice(idx, 1);
                    current.unshift(room);
                    return current;
                });

                const senderForSound = String(incoming.sender?._id || incoming.sender || incoming.senderId || '');
                const isOwnEcho = senderForSound && senderForSound === String(user._id);
                if (!isOwnEcho && lastPopupMessageIdRef.current !== incomingId) {
                    lastPopupMessageIdRef.current = incomingId;
                    playIncomingChatSound();
                }
            });

            socket.on('new_notification', (payload) => {
                if (!mounted || !payload) return;
                if (payload?._id || payload?.id) {
                    setNotifications((prev) => normalizeNotifications([payload, ...(prev || [])]));
                }
                if (payload.roomId && socket.connected) {
                    socket.emit('join_room', String(payload.roomId));
                }
                if (payload.type === 'chat') {
                    refreshBackgroundData();
                }
            });

            socketRef.current = socket;
        };

        connectSocket();

        return () => {
            mounted = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [user?._id]);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return;
        (chatRooms || []).forEach((room) => {
            const rid = room?.id || room?._id;
            if (rid) socket.emit('join_room', String(rid));
        });
    }, [chatRooms]);

    const refreshBackgroundData = async () => {
        try {
            const notifRes = await api.get('/notifications');
            setNotifications(normalizeNotifications(notifRes.data));
            
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
                const roleScope = ['ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER'].includes(userData.role)
                    ? 'Full org visibility'
                    : `Role-scoped visibility (${userData.role})`;
                setSyncStatus((prev) => ({ ...prev, roleScope }));
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
                if (userData?.role) {
                    const roleScope = ['ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER'].includes(userData.role)
                        ? 'Full org visibility'
                        : `Role-scoped visibility (${userData.role})`;
                    setSyncStatus((prev) => ({ ...prev, roleScope }));
                }
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
            // Deactivate token on backend prior to clearing session
            await deactivateFcmToken().catch(fcmErr => {
                console.log('[FCM Logout Error]', fcmErr.message);
            });

            await AsyncStorage.multiRemove(['token', 'user']);
            setUser(null);
            setProjects([]);
        } catch (e) { }
    };

    const addTask = async (newTask) => {
        try {
            const normalizeDateInput = (value) => {
                if (!value || typeof value !== 'string') return value;
                const trimmed = value.trim();
                if (!trimmed) return '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
                const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (slashMatch) {
                    const day = slashMatch[1].padStart(2, '0');
                    const month = slashMatch[2].padStart(2, '0');
                    const year = slashMatch[3];
                    return `${year}-${month}-${day}`;
                }
                return trimmed;
            };

            // Map status to backend enum: 'todo', 'in_progress', 'review', 'completed'
            const statusMap = {
                'Pending': 'todo',
                'In Progress': 'in_progress',
                'Done': 'completed',
                'pending': 'todo',
                'todo': 'todo',
                'in-progress': 'in_progress',
                'in_progress': 'in_progress',
                'review': 'review',
                'completed': 'completed'
            };

            const assigneeRaw = Array.isArray(newTask.assignedTo) ? newTask.assignedTo[0] : newTask.assignedTo;
            const payload = {
                ...newTask,
                category: (newTask.category || 'TASK').toUpperCase(),
                status: statusMap[newTask.status] || newTask.status || 'todo',
                priority: newTask.priority ? (newTask.priority.charAt(0).toUpperCase() + newTask.priority.slice(1).toLowerCase()) : 'Medium',
                assignedTo: extractUserId(assigneeRaw),
                dueDate: normalizeDateInput(newTask.dueDate),
                startDate: normalizeDateInput(newTask.startDate)
            };

            if (payload.parentTaskId) {
                const canon = resolveCanonicalTaskParentId(payload.parentTaskId, tasks);
                if (canon) payload.parentTaskId = canon;
                else delete payload.parentTaskId;
            }

            if (payload.isChild && !payload.parentTaskId) {
                console.error('Add task rejected: child task missing parentTaskId', payload);
                return false;
            }

            const myId = String(user?._id || user?.id || '').trim();
            if (myId && ['WORKER', 'SUBCONTRACTOR'].includes(user?.role)) {
                payload.assignedTo = myId;
                delete payload.assignedRoleType;
            } else if (!payload.assignedTo) {
                delete payload.assignedTo;
            }

            let res;
            console.log(`--- [AppContext] CREATING TASK ---`, payload);
            if (payload.jobId) {
                const jobTaskPayload = {
                    jobId: payload.jobId,
                    title: payload.title,
                    description: payload.description || '',
                    assignedTo: payload.assignedTo || undefined,
                    assignedRoleType: payload.assignedRoleType || '',
                    priority: (payload.priority || 'Medium').toLowerCase(),
                    status: payload.status === 'todo' ? 'pending' : payload.status,
                    dueDate: payload.dueDate || undefined,
                    startDate: payload.startDate || undefined
                };
                res = await api.post('/job-tasks', jobTaskPayload);
            } else {
                res = await api.post('/tasks', payload);
            }

            const saved = res.data;
            setTasks(prev => {
                // Find project name for local display
                const linkedJob = jobs.find(j => String(j._id || j.id) === String(newTask.jobId || saved.jobId || ''));
                const derivedProjectId =
                    newTask.projectId ||
                    saved.projectId ||
                    linkedJob?.projectId?._id ||
                    linkedJob?.projectId;
                const proj = projects.find(p => String(p._id || p.id) === String(derivedProjectId || ''));
                
                const normalized = {
                    ...saved,
                    _id: saved._id || saved.id,
                    parentTaskId: saved.parentTaskId || newTask.parentTaskId || null,
                    projectId: proj ? { _id: proj._id || proj.id, name: proj.name } : derivedProjectId,
                    jobId: saved.jobId || newTask.jobId || null,
                    isJobTask: !!(saved.jobId || newTask.jobId || saved.isJobTask),
                    status: saved.status === 'pending' ? 'todo' : saved.status,
                    assignedTo: saved.assignedTo
                        ? (Array.isArray(saved.assignedTo) ? saved.assignedTo : [saved.assignedTo])
                        : [],
                    level: Number(saved.level || 0),
                    path: saved.path || '',
                    isOptimistic: true,
                    createdAtTimestamp: Date.now(),
                };
                console.log('--- [AppContext] OPTIMISTIC ADD ---', normalized.title);
                return [normalized, ...(prev || [])];
            });
            // Pull fresh server truth so app + web remain in sync.
            await fetchInitialData();
            return true;
        } catch (e) {
            console.error('Add task error', e.response?.data || e);
            return false;
        }
    };

    const addChildTask = async (parentTaskId, childTaskData = {}) => {
        try {
            const rawId = String(parentTaskId || '').trim();
            if (!rawId) {
                console.error('addChildTask rejected: missing parentTaskId');
                return false;
            }

            const normDate = (value) => {
                if (!value || typeof value !== 'string') return value;
                const trimmed = value.trim();
                if (!trimmed) return '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
                const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (slashMatch) {
                    const day = slashMatch[1].padStart(2, '0');
                    const month = slashMatch[2].padStart(2, '0');
                    const year = slashMatch[3];
                    return `${year}-${month}-${day}`;
                }
                return trimmed;
            };

            const parentRow = (tasks || []).find((t) => String(t._id || t.id) === rawId);

            const myIdChild = String(user?._id || user?.id || '').trim();
            const pickSubtaskAssignee = (at) => {
                if (myIdChild && ['WORKER', 'SUBCONTRACTOR'].includes(user?.role)) return myIdChild;
                const raw = Array.isArray(at) ? at[0] : at;
                return extractUserId(raw) || undefined;
            };

            if (parentRow?.isJobTask) {
                const assignedTo = pickSubtaskAssignee(childTaskData.assignedTo);
                await api.post(`/tasks/${rawId}/subtasks`, {
                    title: childTaskData.title,
                    assignedTo: assignedTo || undefined,
                    startDate: normDate(childTaskData.startDate) || undefined,
                    dueDate: normDate(childTaskData.dueDate) || undefined,
                    remarks: childTaskData.description || '',
                    priority: childTaskData.priority || 'Medium',
                });
                await fetchInitialData();
                return true;
            }

            if (parentRow?.isSubTask && parentRow.onModel === 'JobTask') {
                const jtId = String(parentRow.taskId?._id || parentRow.taskId || '');
                if (!jtId) return false;
                const assignedTo = pickSubtaskAssignee(childTaskData.assignedTo);
                await api.post(`/tasks/${jtId}/subtasks`, {
                    title: childTaskData.title,
                    assignedTo: assignedTo || undefined,
                    startDate: normDate(childTaskData.startDate) || undefined,
                    dueDate: normDate(childTaskData.dueDate) || undefined,
                    remarks: childTaskData.description || '',
                    priority: childTaskData.priority || 'Medium',
                    parentSubTaskId: rawId,
                });
                await fetchInitialData();
                return true;
            }

            const canonicalParentId = resolveCanonicalTaskParentId(rawId, tasks);
            if (!canonicalParentId) {
                console.error('addChildTask: could not resolve Task parent id', rawId);
                return false;
            }

            const parent = (tasks || []).find((t) => String(t._id || t.id) === canonicalParentId);

            const inheritedProjectId =
                childTaskData.projectId ||
                parent?.projectId?._id ||
                parent?.projectId;

            const payload = {
                ...childTaskData,
                parentTaskId: canonicalParentId,
                projectId: inheritedProjectId || undefined,
                jobId: undefined,
                isChild: true,
            };

            return await addTask(payload);
        } catch (e) {
            console.error('addChildTask error', e?.response?.data || e);
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
            const allowedFields = ['status', 'progress', 'remarks', 'cancellationReason', 'priority', 'title', 'description', 'notes', 'dueDate', 'startDate', 'assignedTo', 'assignedRoleType', 'category', 'parentTaskId'];
            
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

            // Refresh from server after patch for canonical parity with web.
            await fetchInitialData();
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

    const deleteTask = async (id, options = {}) => {
        try {
            const action = options?.action || null;
            const query = action ? `?action=${encodeURIComponent(action)}` : '';
            console.log(`--- [AppContext] DELETING TASK [ID: ${id}] ---`);
            await api.delete(`/tasks/${id}${query}`);
            setTasks(prev => (prev || []).filter(t => (t._id || t.id) !== id));
            await fetchInitialData();
            return true;
        } catch (e) {
            console.error('Delete task error', e.response?.data || e);
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

    /** @param {string|null|undefined} projectId - Project id (optional if taskId/jobId or emergency reason) */
    /** @param {string|null|undefined} taskId - Task / job-task / subtask id */
    /** @param {{ jobId?: string, taskType?: string, reason?: string }} [options] */
    const toggleClock = async (projectId, taskId = null, options = {}) => {
        const now = new Date();
        const opts = options || {};
        const pRaw = projectId != null && projectId !== '' ? String(projectId) : '';
        const pId = pRaw && pRaw !== 'undefined' && pRaw !== 'null' ? pRaw : null;
        const tRaw = taskId != null && taskId !== '' ? String(taskId) : '';
        const tId = tRaw && tRaw !== 'undefined' && tRaw !== 'null' ? tRaw : null;
        const jRaw = opts.jobId != null && opts.jobId !== '' ? String(opts.jobId) : '';
        const jId = jRaw && jRaw !== 'undefined' && jRaw !== 'null' ? jRaw : null;
        const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';

        let coords = { latitude: 49.2246, longitude: -122.8488 }; // Default Surrey V3W3E9 / Vancouver region coordinates

        setIsClocking(true);
        try {
            // Attempt to get highly precise GPS location
            try {
                const enabled = await Location.hasServicesEnabledAsync();
                if (enabled) {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const location = await Location.getCurrentPositionAsync({ 
                            accuracy: Location.Accuracy.Balanced,
                            timeout: 5000 
                        });
                        if (location && location.coords) {
                            coords = {
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude
                            };
                        }
                    }
                }
            } catch (gpsError) {
                console.warn('GPS location retrieval failed, using fallback coordinates:', gpsError.message);
            }

            if (!isClockedIn) {
                const hasTarget = !!(pId || tId || jId || reason);
                if (!hasTarget) {
                    throw new Error('Project selection required for clock-in');
                }
                const res = await api.post('/timelogs/clock-in', {
                    projectId: pId || undefined,
                    jobId: jId || undefined,
                    taskId: tId || undefined,
                    taskType: opts.taskType || undefined,
                    reason: reason || undefined,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    deviceInfo: `BuildMaster App ${Platform.OS || 'native'}`
                });
                
                const serverLog = res.data;
                setIsClockedIn(true);
                setClockInTime(new Date(serverLog.clockIn));
                
                // UPDATE LOGS: Add the new clock-in record to the top of the history
                setTimeLogs(prev => [serverLog, ...prev]);
                
                // PERSIST: Save to local storage
                await AsyncStorage.setItem('localClockIn', JSON.stringify({ isClockedIn: true, time: serverLog.clockIn, pId }));

                // OPTIMISTIC ACTIVITY UPDATE
                const activeProject = pId ? (projects || []).find((p) => String(p._id || p.id) === String(pId)) : null;
                setActivities((prev) => [
                    {
                        type: 'clock_in',
                        createdAt: now.toISOString(),
                        projectId: {
                            _id: pId || undefined,
                            name: activeProject?.name || (reason ? 'Emergency / unlisted' : 'Project Site')
                        },
                        taskId: tId
                    },
                    ...prev
                ]);

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
        } finally {
            setIsClocking(false);
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
            emitJoinRoom(finalRoomId);

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

            // For direct messages, always resolve to the canonical ChatRoom id early.
            // This avoids backend-side room resolution on each send (which adds latency).
            if (receiverId && (!rStr || rStr === receiverId?.toString())) {
                const directRoomId = await ensureDirectChatRoom(receiverId);
                if (directRoomId) {
                    finalRoomId = String(directRoomId);
                }
            }

            if (pStr && (finalRoomId === pStr || !finalRoomId)) {
                const existingRoom = (chatRooms || []).find((r) => {
                    const p1 = (r.projectId?._id || r.projectId)?.toString();
                    const p2 = (r.project?._id || r.project)?.toString();
                    const p3 = (r.relatedId?._id || r.relatedId)?.toString();
                    const p4 = (r.projectId?.$oid || r.project?.$oid)?.toString();
                    return p1 === pStr || p2 === pStr || p3 === pStr || p4 === pStr;
                });

                if (existingRoom) {
                    finalRoomId = (existingRoom._id || existingRoom.id)?.toString();
                }
            }

            const payload = {
                message: text,
                attachments: attachments,
                roomId: finalRoomId
            };

            if (projectId) payload.projectId = pStr;
            const shouldSendReceiverId = !!receiverId && (!finalRoomId || String(finalRoomId) === String(receiverId));
            if (shouldSendReceiverId) payload.receiverId = receiverId?.toString();
            if (finalRoomId) emitJoinRoom(finalRoomId);

            const tempId = `optimistic-${Date.now()}`;
            const optimisticMsg = {
                _id: tempId,
                id: tempId,
                message: text,
                attachments: attachments || [],
                roomId: finalRoomId,
                projectId: pStr || undefined,
                sender: user
                    ? { _id: user._id, fullName: user.fullName || user.name, role: user.role }
                    : undefined,
                createdAt: new Date().toISOString(),
                pending: true
            };

            setMessages((prev) => [...(prev || []), optimisticMsg]);

            setChatRooms((prev) => {
                const list = Array.isArray(prev) ? [...prev] : [];
                const idx = list.findIndex((r) => String(r.id || r._id) === String(finalRoomId));
                if (idx === -1) return list;
                const room = { ...list[idx] };
                room.lastMessage = {
                    text,
                    sender: user?.fullName || 'You',
                    time: new Date().toISOString()
                };
                list.splice(idx, 1);
                list.unshift(room);
                return list;
            });

            void playSentChatSound();

            const res = await api.post('/chat', payload);
            const savedMsg = res.data;
            const savedRoom = savedMsg?.roomId?._id || savedMsg?.roomId || finalRoomId;
            if (savedRoom) emitJoinRoom(savedRoom);

            setMessages((prev) => {
                const rawRoom = savedMsg.roomId ?? payload.roomId;
                const rawProj = savedMsg.projectId ?? payload.projectId;
                const normalizedMsg = {
                    ...savedMsg,
                    id: savedMsg._id || savedMsg.id,
                    roomId: rawRoom != null ? String(rawRoom) : undefined,
                    projectId: rawProj != null ? String(rawProj) : undefined,
                    receiverId: savedMsg.receiverId || payload.receiverId
                };
                const withoutTemp = (prev || []).filter((m) => String(m._id || m.id) !== tempId);
                if (withoutTemp.find((m) => String(m._id || m.id) === String(normalizedMsg.id))) return withoutTemp;
                return [...withoutTemp, normalizedMsg];
            });

            setChatRooms((prev) => {
                const list = Array.isArray(prev) ? [...prev] : [];
                const idx = list.findIndex((r) => String(r.id || r._id) === String(finalRoomId));
                if (idx === -1) return list;
                const room = { ...list[idx] };
                room.lastMessage = {
                    text: savedMsg.message,
                    sender: savedMsg.sender?.fullName || user?.fullName,
                    time: savedMsg.createdAt
                };
                list.splice(idx, 1);
                list.unshift(room);
                return list;
            });

            // If socket echo is delayed/missed, quick background sync keeps room previews + unreads fresh.
            if (!socketRef.current?.connected) {
                refreshBackgroundData();
            }

            return true;
        } catch (e) {
            console.error('Send message error', e.response?.data || e);
            setMessages((prev) => (prev || []).filter((m) => !String(m._id || m.id).startsWith('optimistic-')));
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
            const res = await api.post('/photos/upload', formData);

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

    const updateTodo = async (rawId, updates) => {
        const id = String(rawId || '').trim();
        if (!id || id === 'undefined' || id === 'null') return null;
        try {
            const res = await api.patch(`/todos/${id}`, updates);
            const updated = res.data;
            const updatedId = String(updated._id || updated.id || id);
            setTodos(prev => (prev || []).map(t => (String(t._id || t.id) === updatedId ? updated : t)));
            return updated;
        } catch (error) {
            console.error('--- [AppContext] updateTodo API ERROR ---', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            return null;
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
            tasks, addTask, addChildTask, updateTask, deleteTask, setTasks,
            jobs, addJob, updateJob,
            updateEquipment, deleteEquipment,
            issues, setIssues, addIssue,
            messages, setMessages, sendMessage, fetchMessages, ensureDirectChatRoom, uploadFile,
            rfis, rfiStats, addRFI,
            isClockedIn, isClocking, toggleClock,
            clockInTime, clockOutTime, getWorkDuration,
            activities,
            timeLogs,
            chatRooms,
            notifications,
            metrics,
            todos, addTodo, toggleTodo, updateTodo, deleteTodo,
            unreadChatCount: (chatRooms || []).reduce((acc, room) => acc + (room.unreadCount || 0), 0),
            uploadNotes, setUploadNotes,
            addUploadNote: (note) => setUploadNotes([note, ...uploadNotes]),
            refreshData: fetchInitialData,
            markNotificationAsRead: async (id) => {
                try {
                    await api.patch(`/notifications/${id}/read`);
                    setNotifications(prev => normalizeNotifications((prev || []).map(n => n._id === id ? { ...n, isRead: true } : n)));
                } catch (e) {
                    console.error('Mark read error', e);
                }
            },
            markAllNotificationsAsRead: async () => {
                try {
                    await api.patch('/notifications/mark-all-read');
                    setNotifications(prev => normalizeNotifications((prev || []).map(n => ({ ...n, isRead: true }))));
                } catch (e) {
                    console.error('Mark all read error', e);
                }
            },
            syncStatus,
            dismissSyncStatus: () => setSyncStatus((prev) => ({ ...prev, level: 'ok', message: '' })),
            loading,
            selectedProject,
            setSelectedProject
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);

