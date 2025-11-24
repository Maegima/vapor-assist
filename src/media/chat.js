const vscode = acquireVsCodeApi();
const customInput = document.getElementById('custom-input');
const inputWrapper = document.getElementById('input-wrapper');
const sendBtn = document.getElementById('send');
const messagesBox = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const snippetContainer = document.getElementById('snippet-container');

let codeSnippets = [];
let generating = false;

function makeEl(tag, { clss, id, text, html, icon, attrs = {}, on = {}, children = [] } = {}) {
    const element = document.createElement(tag);
    if (clss) element.className = clss;
    if (id) element.id = id;
    if (text) element.textContent = text;
    if (html) element.innerHTML = html;
    if (icon) {
        const iconEl = makeEl('i', { attrs: { 'data-lucide': icon } });
        element.appendChild(iconEl);
        lucide.createIcons({ root: element });
    }

    for (const [key, value] of Object.entries(attrs)) {
        element.setAttribute(key, value);
    }

    for (const [event, handler] of Object.entries(on)) {
        element.addEventListener(event, handler);
    }

    for (const child of children) {
        if (child) element.appendChild(child);
    }
    return element;
}

function makeElCs(tag, clss = "", attr = {}) {
    attr.clss = clss;
    return makeEl(tag, attr);
}

function makeElCsId(tag, clss = "", id = "", attr = {}) {
    attr.clss = clss;
    attr.id = id;
    return makeEl(tag, attr);
}

function createMessageBox(sender, text) {
    const content = makeElCs("span", "content", { html: marked.parse(text) });
    setTimeout(() => {
        content.querySelectorAll("pre code").forEach(block => {
            hljs.highlightElement(block);
            const btn = makeElCs('button', 'copy-btn', { icon: 'copy' });
            btn.onclick = () => {
                navigator.clipboard.writeText(block.innerText);
            }
            block.before(makeElCs("div", "btn-container", { children: [btn] }));
        });
    });

    const copyBtn = makeElCs("button", "copy-btn", { icon: 'copy', attrs: { title: "Copy message" } });
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(content.innerText);
    };

    const timestampEl = makeElCs("div", "timestamp", {
        text: (new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    const topRow = makeElCs("div", "message-top", { children: [copyBtn, content] });

    return makeElCs("div", `message ${sender}`, { children: [topRow, timestampEl] });
}

const appendMessage = (sender, text) => {
    messagesBox.prepend(createMessageBox(sender, text));
    messagesBox.scrollTo({ top: 0, behavior: 'smooth' });
};

const sendMessage = () => {
    if (generating) return;
    const text = [
        ...codeSnippets.map(s => "```" + s + "```"),
        customInput.innerText.trim()
    ].filter(Boolean).join("\n\n");

    codeSnippets = [];
    snippetContainer.innerHTML = "";
    customInput.innerText = "";

    if (!text) return;

    generating = true;
    inputWrapper.classList.add('loading');
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    typingIndicator.style.display = 'block'; // show animated typing
    appendMessage('user', text);
    vscode.postMessage({ type: 'send', text });
};

function addCodeSnippet(text) {
    const deleteBtn = makeElCs('span', 'snippet-delete', { text: '×' });

    const code = makeEl('pre', { children: [makeEl('code', { text })] });
    hljs.highlightElement(code);

    const bubble = makeElCs('div', 'snippet-bubble', { children: [deleteBtn, code] });

    const removeSnippet = () => {
        snippetContainer.removeChild(bubble);
        codeSnippets = codeSnippets.filter(s => s !== text);
    };
    deleteBtn.addEventListener('click', removeSnippet);

    snippetContainer.appendChild(bubble);

    codeSnippets = [...codeSnippets, text];

    customInput.focus();
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'reply') {
        appendMessage(msg.sender, msg.text);
        generating = false;
        inputWrapper.classList.remove('loading');
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
        typingIndicator.style.display = 'none';
    }

    if (msg.type === 'insert-snippet') {
        if (msg.code) addCodeSnippet(msg.code);
    }

    if (msg.type === 'restore-history') {
        while (messagesBox.firstChild) {
            messagesBox.removeChild(messagesBox.lastChild);
        }
        msg.history.forEach(entry => {
            appendMessage(entry.sender, entry.text);
        });
    }

    if (msg.type === 'show-sessions') {
        renderSessions(msg.sessions, msg.currentSessionId);
        sessionPanel.classList.add('visible');
        sessionPanel.classList.remove('hidden');
    }

    if (msg.type === 'session-changed') {
        sessionPanel.classList.remove('visible');
        setTimeout(() => sessionPanel.classList.add('hidden'), 180);
    }
});

const sessionPanel = document.getElementById('session-panel');
const sessionsList = document.getElementById('sessions-list');
const newSessionBtn = document.getElementById('new-session-btn');
const closeSessionPanel = document.getElementById('close-session-panel');

let sessionSearchValue = '';

function renderSessions(sessions, currentId) {
    sessionsList.innerHTML = '';
    const filtered = Object.entries(sessions).filter(([key, val]) =>
        val.title.toLowerCase().includes(sessionSearchValue.toLowerCase())
    );
    filtered.forEach(([key, val]) => {
        const row = makeElCs('div', `session-item session-row ${key === currentId ? ' active' : ''}`);
        row.addEventListener('click', () => {
            vscode.postMessage({ type: 'switch-session', id: key });
        });
        const titleSpan = makeElCs('div', 'session-title', { html: val.title || ('Session ' + key.slice(0, 6)) });
        const titleInput = makeElCs('input', 'session-title-input hidden', { value: val.title });
        titleInput.addEventListener('click', (e) => { e.stopPropagation(); });
        titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleInput.blur(); });
        titleInput.addEventListener('blur', () => {
            const newName = titleInput.value.trim();
            titleInput.classList.add('hidden');
            titleSpan.classList.remove('hidden');
            if (newName && newName !== val.title) {
                vscode.postMessage({ type: 'rename-session', id: key, title: newName });
            }
        });
        const controls = makeElCs('div', 'session-controls');
        const editBtn = makeElCs('button', 'session-btn edit', { icon: 'file-input' });
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            titleSpan.classList.add('hidden');
            titleInput.classList.remove('hidden');
            titleInput.focus();
        });
        const deleteBtn = makeElCs('button', 'session-btn delete', { icon: 'file-x' });
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: 'delete-session', id: key });
        });
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
        row.appendChild(titleSpan);
        row.appendChild(titleInput);
        row.appendChild(controls);
        sessionsList.appendChild(row);
    });
}

function openSessionsPanel(sessions, currentId) {
    renderSessions(sessions, currentId);
    sessionPanel.classList.add('visible');
    sessionPanel.classList.remove('hidden');
}

sendBtn.onclick = sendMessage;
inputWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) sendMessage();
});

closeSessionPanel.addEventListener('click', () => {
    sessionPanel.classList.remove('visible');
    setTimeout(() => sessionPanel.classList.add('hidden'), 180);
    vscode.setState({ ...vscode.getState(), sessionsOpen: false });
});

newSessionBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'new-session' });
});

document.getElementById('session-search').addEventListener('input', (e) => {
    sessionSearchValue = e.target.value;
    vscode.setState({ ...vscode.getState(), sessionSearchValue });
    vscode.postMessage({ type: 'request-session-list' });
});

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const state = vscode.getState() || {};
    sessionSearchValue = state.sessionSearchValue || '';
    if (state.sessionsOpen) {
        vscode.postMessage({ type: 'request-session-list' });
    }
    vscode.postMessage({ type: 'ready' });
});