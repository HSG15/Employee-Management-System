const API_URL = '/api';

// Utility to get current user
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Redirect if not logged in
function checkAuth() {
    const user = getUser();
    if (!user && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
    }
    if (user && window.location.pathname.endsWith('index.html')) {
        window.location.href = 'dashboard.html';
    }
}

// Run check on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const user = getUser();

    // Login Page Logic
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.username.value;
            const password = loginForm.password.value;
            const errorDiv = document.getElementById('login-error');

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('user', JSON.stringify(data));
                    window.location.href = 'dashboard.html';
                } else {
                    errorDiv.textContent = data.message || 'Login failed';
                }
            } catch (err) {
                errorDiv.textContent = 'Network error: ' + err.message;
            }
        });
    }

    // Dashboard Logic
    if (user && window.location.pathname.endsWith('dashboard.html')) {
        // Setup User Info
        document.getElementById('user-name').textContent = user.username;
        document.getElementById('user-role').textContent = user.role.toUpperCase();

        // Update Balance Display immediately from local storage (or fetch fresh)
        updateBalanceDisplay(user);

        // Fetch latest balance
        fetchBalance(user.id);

        // Initial Load of Leaves
        loadLeaves(user);

        // Manager Specific Views
        if (user.role === 'manager') {
            document.getElementById('manager-section').style.display = 'block';
            document.getElementById('calendar-section').style.display = 'block';
            loadAllLeaves();
        }

        // Handle Leave Submission
        const requestForm = document.getElementById('leave-request-form');
        if (requestForm) {
            requestForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const payload = {
                    user_id: user.id,
                    leave_type: document.getElementById('leave-type').value,
                    start_date: document.getElementById('start-date').value,
                    end_date: document.getElementById('end-date').value,
                    reason: document.getElementById('reason').value
                };

                try {
                    const res = await fetch(`${API_URL}/leaves`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        alert('Leave Request Submitted!');
                        requestForm.reset();
                        loadLeaves(user); // Refresh my list
                        if (user.role === 'manager') loadAllLeaves(); // Refresh manager list too if self-approving
                    } else {
                        const data = await res.json();
                        alert('Error: ' + data.error);
                    }
                } catch (err) {
                    alert('Error submitting request');
                }
            });
        }
    }
});

async function fetchBalance(userId) {
    try {
        const res = await fetch(`${API_URL}/users/${userId}/balance`);
        if (res.ok) {
            const balance = await res.json();
            updateBalanceDisplay(balance);
            // Optionally update local storage user object
            const user = getUser();
            user.vacation_balance = balance.vacation_balance;
            user.sick_leave_balance = balance.sick_leave_balance;
            localStorage.setItem('user', JSON.stringify(user));
        }
    } catch (err) {
        console.error('Failed to fetch balance', err);
    }
}

function updateBalanceDisplay(data) {
    document.getElementById('vacation-balance').textContent = data.vacation_balance;
    document.getElementById('sick-balance').textContent = data.sick_leave_balance;
}

async function loadLeaves(user) {
    try {
        const res = await fetch(`${API_URL}/leaves?user_id=${user.id}`);
        const leaves = await res.json();
        const list = document.getElementById('my-leaves-list');
        list.innerHTML = leaves.map(renderLeaveItem).join('');
    } catch (err) {
        console.error('Failed to load leaves', err);
    }
}

async function loadAllLeaves() {
    try {
        const res = await fetch(`${API_URL}/leaves?role=manager`);
        const leaves = await res.json();
        const list = document.getElementById('all-leaves-list');
        list.innerHTML = leaves.map(leave => renderLeaveItem(leave, true)).join('');

        // Calendar Logic
        renderCalendar(leaves);
    } catch (err) {
        console.error('Failed to load all leaves');
    }
}

let currentDate = new Date();

function renderCalendar(leaves) {
    const calendarView = document.getElementById('calendar-view');
    calendarView.innerHTML = '';

    // Controls
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
        <button onclick="changeMonth(-1)" class="btn" style="width: auto;"><</button>
        <h3>${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onclick="changeMonth(1)" class="btn" style="width: auto;">></button>
    `;
    calendarView.appendChild(header);

    // Grid Container
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const d = document.createElement('div');
        d.className = 'calendar-day-header';
        d.textContent = day;
        grid.appendChild(d);
    });

    // Days calculation
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    // Previous month padding
    for (let i = 0; i < startDayIndex; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        grid.appendChild(d);
    }

    // Days
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        let content = `<span class="day-number">${day}</span>`;

        const cellDate = new Date(year, month, day);

        // Find leaves for this day
        // Approved leaves only ideally, but let's show pending in a lighter shade or distinct way?
        // Requirement said "Highlight approved leave requests"
        const daysLeaves = leaves.filter(l => {
            if (l.status !== 'approved') return false;
            const start = new Date(l.start_date);
            const end = new Date(l.end_date);
            return cellDate >= start && cellDate <= end;
        });

        daysLeaves.forEach(l => {
            content += `<div class="calendar-event event-${l.leave_type}" title="${l.username}: ${l.reason}">
                ${l.username}
            </div>`;
        });

        cell.innerHTML = content;
        grid.appendChild(cell);
    }

    calendarView.appendChild(grid);
}

window.changeMonth = function (delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    // Reload leaves to refresh calendar (or just re-render if we kept the data)
    // To keep it simple, we'll re-fetch. Ideally we store 'allLeaves' globally.
    loadAllLeaves();
};


function renderLeaveItem(leave, isManagerView = false) {
    const isPending = leave.status === 'pending';

    let actions = '';
    if (isManagerView && isPending) {
        actions = `
            <div class="action-buttons">
                <button onclick="updateStatus(${leave.id}, 'approved')" class="btn btn-approve">Approve</button>
                <button onclick="updateStatus(${leave.id}, 'rejected')" class="btn btn-reject">Reject</button>
            </div>
        `;
    }

    return `
        <li class="leave-item">
            <div>
                <strong>${leave.leave_type.toUpperCase()}</strong> 
                ${isManagerView ? `by <strong>${leave.username || 'User ' + leave.user_id}</strong>` : ''}
                <br>
                <small>${new Date(leave.start_date).toLocaleDateString()} to ${new Date(leave.end_date).toLocaleDateString()}</small>
                <p style="font-size: 0.9em; color: #666;">${leave.reason}</p>
                 ${leave.manager_comment ? `<p style="font-size: 0.8em; color: var(--primary-color);">Manager: ${leave.manager_comment}</p>` : ''}
            </div>
            <div style="text-align: right;">
                <span class="status-badge status-${leave.status}">${leave.status.toUpperCase()}</span>
                <div style="margin-top: 5px;">${actions}</div>
            </div>
        </li>
    `;
}

async function updateStatus(id, status) {
    const comment = prompt(`Add a comment for ${status} (optional):`) || '';
    try {
        const res = await fetch(`${API_URL}/leaves/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, manager_comment: comment })
        });

        if (res.ok) {
            loadAllLeaves();
            // Also refresh own list in case the manager approved their own request
            const user = getUser();
            loadLeaves(user);
        } else {
            alert('Failed to update status');
        }
    } catch (err) {
        alert('Error updating status');
    }
}
