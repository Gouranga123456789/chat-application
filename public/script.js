document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element Selectors ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const loginError = document.getElementById('login-error');
    const roomList = document.getElementById('room-list');
    const userList = document.getElementById('user-list');
    const createRoomForm = document.getElementById('create-room-form');
    const newRoomInput = document.getElementById('new-room-input');
    const roomNameDisplay = document.getElementById('room-name');
    const displayUsername = document.getElementById('display-username');
    const messageDisplayArea = document.getElementById('message-display-area');
    const welcomeMessage = document.querySelector('.welcome-message');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = messageForm.querySelector('button');

    // New selectors for responsive sidebar
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebarLeft = document.getElementById('sidebar-left');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // --- State Management ---
    let username = '';
    let currentRoom = '';
    let ws;

    // --- WebSocket Connection ---
    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${protocol}://${window.location.host}`);
        ws.onopen = () => console.log('Connected to server');
        ws.onclose = () => console.log('Disconnected from server');
        ws.onmessage = handleServerMessage;
    }

    // --- Event Listeners ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            ws.send(JSON.stringify({ type: 'login', username: enteredUsername }));
        }
    });

    createRoomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const roomName = newRoomInput.value.trim();
        if (roomName) {
            ws.send(JSON.stringify({ type: 'create_room', room: roomName }));
            newRoomInput.value = '';
        }
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message && currentRoom) {
            ws.send(JSON.stringify({ type: 'send_message', message }));
            messageInput.value = '';
        }
    });

    // Event listeners for hamburger menu
    hamburgerBtn.addEventListener('click', () => {
        sidebarLeft.classList.toggle('sidebar-open');
        sidebarOverlay.classList.toggle('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebarLeft.classList.remove('sidebar-open');
        sidebarOverlay.classList.remove('active');
    });

    // --- Core Functions ---
    function handleServerMessage(event) {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'login_success': handleLogin(data.username); break;
            case 'login_error': loginError.textContent = data.message; break;
            case 'room_list': updateRoomList(data.rooms); break;
            case 'user_list': updateUserList(data.users); break;
            case 'new_message': displayMessage(data); break;
            case 'system_message': displaySystemMessage(data.message); break;
        }
    }

    function handleLogin(name) {
        username = name;
        displayUsername.textContent = username;
        loginOverlay.classList.remove('active');
    }

    function joinRoom(roomName) {
        if (roomName === currentRoom) return;
        currentRoom = roomName;
        ws.send(JSON.stringify({ type: 'join_room', room: roomName }));

        // Update UI
        roomNameDisplay.textContent = roomName;
        messageDisplayArea.innerHTML = '';
        welcomeMessage.style.display = 'none';
        messageInput.disabled = false;
        sendButton.disabled = false;
        
        document.querySelectorAll('#room-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.room === roomName);
        });

        // Close mobile sidebar after room selection
        if (sidebarLeft.classList.contains('sidebar-open')) {
            sidebarLeft.classList.remove('sidebar-open');
            sidebarOverlay.classList.remove('active');
        }
    }

    // --- UI Update Functions ---
    function updateRoomList(rooms) {
        roomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room;
            li.dataset.room = room;
            li.onclick = () => joinRoom(room);
            if (room === currentRoom) li.classList.add('active');
            roomList.appendChild(li);
        });
    }

    function updateUserList(users) {
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="online-dot"></span>${user}${user === username ? ' (You)' : ''}`;
            userList.appendChild(li);
        });
    }

    function displayMessage(data) {
        const { username: msgUser, message, timestamp } = data;
        const isMine = msgUser === username;
        
        const messageEl = document.createElement('div');
        messageEl.className = isMine ? 'message mine' : 'message other';

        messageEl.innerHTML = `
            <div class="message-meta">${isMine ? '' : `<strong>${msgUser}</strong>`} at ${timestamp}</div>
            <div class="message-bubble">${formatMessageText(message)}</div>
        `;
        messageDisplayArea.appendChild(messageEl);
        messageDisplayArea.scrollTop = messageDisplayArea.scrollHeight;
    }
    
    function displaySystemMessage(message) {
        const el = document.createElement('div');
        el.className = 'system-message';
        el.textContent = message;
        messageDisplayArea.appendChild(el);
        messageDisplayArea.scrollTop = messageDisplayArea.scrollHeight;
    }

    function formatMessageText(text) {
        let escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escapedText = escapedText.replace(/\*(.*?)\*/g, '<strong>$1</strong>'); // Bold
        escapedText = escapedText.replace(/_(.*?)_/g, '<em>$1</em>');     // Italics
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return escapedText.replace(urlRegex, '<a href="$1" target="_blank">$1</a>'); // Links
    }

    // --- Initial Connection ---
    connect();

});
