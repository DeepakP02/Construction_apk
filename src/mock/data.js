export const MOCK_COMPANY = {
    name: 'BuildMaster Pro',
    logo: 'https://via.placeholder.com/150/F5B301/FFFFFF?text=BM',
    plan: 'Enterprise SaaS',
};

export const MOCK_USER = {
    name: 'John Anderson',
    role: 'Project Manager',
    company: MOCK_COMPANY.name,
    avatar: 'https://i.pravatar.cc/150?u=john',
};

export const MOCK_PROJECTS = [
    {
        id: '1',
        name: 'Skyline Residence',
        client: 'Apex Realty Group',
        progress: 0.65,
        status: 'In Progress',
        location: 'Downtown Manhattan, NY',
        budget: '$2.4M',
        manager: 'John Anderson',
        type: 'Residential',
        team: [{ name: 'John Anderson', role: 'Project Manager' }, { name: 'Mike Foreman', role: 'Site Supervisor' }, { name: 'Mike Ross', role: 'Worker' }],
        stats: { tasks: 12, issues: 2 },
    },
    {
        id: '2',
        name: 'Harbor Warehouse',
        client: 'Logistics Hub Inc.',
        progress: 0.30,
        status: 'In Progress',
        location: 'Brooklyn Navy Yard, NY',
        budget: '$1.8M',
        manager: 'John Anderson', // Changed to John for PM View
        type: 'Industrial',
        team: [{ name: 'John Anderson', role: 'Project Manager' }, { name: 'Mike Foreman', role: 'Site Supervisor' }, { name: 'Mike Ross', role: 'Worker' }],
        stats: { tasks: 45, issues: 5 },
    },
    {
        id: '3',
        name: 'Green Oaks Mall',
        client: 'Retail Partners',
        progress: 1.0,
        status: 'Completed',
        location: 'Queens, NY',
        budget: '$5.2M',
        manager: 'David Miller',
        type: 'Commercial',
        team: [{ name: 'David Miller', role: 'Lead Architect' }],
        stats: { tasks: 0, issues: 0 },
    },
];


export const MOCK_TASKS = [
    {
        id: '1',
        title: 'Foundation Inspection',
        projectId: '1',
        dueDate: '2026-02-15',
        status: 'Pending',
        priority: 'High',
        assignedTo: 'John Anderson',
    },
    {
        id: '2',
        title: 'Install Electrical Wiring',
        projectId: '2',
        dueDate: '2026-02-14',
        status: 'In Progress',
        priority: 'Medium',
        assignedTo: 'Mike Ross',
    },
    {
        id: '3',
        title: 'Site Clearing',
        projectId: '1',
        dueDate: '2026-02-12',
        status: 'Done',
        priority: 'Low',
        assignedTo: 'Harvey Specter',
    },
    {
        id: '4',
        title: 'Safety Barrier Setup',
        projectId: '1',
        dueDate: '2026-02-16',
        status: 'Pending',
        priority: 'High',
        assignedTo: 'Mike Foreman',
    },
    {
        id: '5',
        title: 'Equipment Maintenance',
        projectId: '2',
        dueDate: '2026-02-18',
        status: 'Pending',
        priority: 'Medium',
        assignedTo: 'Mike Ross',
    },
    {
        id: '6',
        title: 'Daily Site Log',
        projectId: '2',
        dueDate: '2026-02-12',
        status: 'Done',
        priority: 'Low',
        assignedTo: 'Mike Foreman',
    },
];

export const MOCK_ISSUES = [
    {
        id: '1',
        title: 'Material Delay - Cement',
        priority: 'High',
        status: 'Open',
        assignedUser: 'John Anderson',
        projectId: '1',
    },
    {
        id: '2',
        title: 'Wrong Pipe Diameter',
        priority: 'Medium',
        status: 'Resolving',
        assignedUser: 'Mike Ross',
        projectId: '1',
    },
];

export const MOCK_PHOTOS = [
    {
        id: '1',
        uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80',
        timestamp: '2026-02-12 10:30 AM',
        employee: 'Mike Foreman',
        gps: '40.7128° N, 74.0060° W',
    },
    {
        id: '2',
        uri: 'https://images.unsplash.com/photo-1504307651254-35680f3366d4?auto=format&fit=crop&w=400&q=80',
        timestamp: '2026-02-12 09:15 AM',
        employee: 'John Anderson',
        gps: '40.7128° N, 74.0060° W',
    },
];

export const MOCK_DRAWINGS = [
    { id: '1', name: 'Floor Plan - Level 1', version: 'v2.1', date: '2026-01-20' },
    { id: '2', name: 'Electrical Schematic', version: 'v1.0', date: '2026-02-01' },
    { id: '3', name: 'Plumbing Layout', version: 'v1.4', date: '2026-02-05' },
];

export const MOCK_MESSAGES = [
    { id: '1', text: 'Hey team, cement truck is arriving in 15 mins.', sender: 'Mike Foreman', time: '10:00 AM', isMe: false },
    { id: '2', text: 'Copy that. Site is ready for pouring.', sender: 'John Anderson', time: '10:02 AM', isMe: true },
    { id: '3', text: 'Don\'t forget to sign the delivery ticket.', sender: 'Harvey Specter', time: '10:05 AM', isMe: false },
];

export const MOCK_STATS = [
    { label: 'Today\'s Tasks', value: '12', icon: 'clipboard-list' },
    { label: 'Active Projects', value: '4', icon: 'office-building' },
    { label: 'Open Issues', value: '7', icon: 'alert-circle' },
    { label: 'Outstanding Invoices', value: '$12.5k', icon: 'file-document' },
];

export const MOCK_ACTIVITY = [
    { id: '1', action: 'Uploaded a new drawing', target: 'Floor Plan v2.1', time: '2 mins ago' },
    { id: '2', action: 'Completed task', target: 'Site Clearing', time: '1 hour ago' },
    { id: '3', action: 'Reported issue', target: 'Material Delay', time: '3 hours ago' },
];
