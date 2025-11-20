const vscode = acquireVsCodeApi();
const inputBox = document.getElementById('input');
const sendBtn = document.getElementById('send');
const messagesBox = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const snippetContainer = document.getElementById('snippet-container');

let codeSnippets = [];
let generating = false;

function makeEl(tag, { clss, id, text, html, attrs = {}, on = {}, children = [] } = {}) {
    const element = document.createElement(tag);
    if (clss) element.className = clss;
    if (id) element.id = id;
    if (text) element.textContent = text;
    if (html) element.innerHTML = html;

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
        });
    });

    const copyBtn = makeElCs("button", "copy-btn", { html: "📋", attrs: { title: "Copy message" } });
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(content.innerText).then(() => {
            copyBtn.textContent = "✅";
            setTimeout(() => (copyBtn.textContent = "📋"), 1000);
        });
    };

    const timestampEl = makeElCs("div", "timestamp", {
        text: (new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    const topRow = makeElCs("div", "message-top", { children: [content, copyBtn] });

    return makeElCs("div", `message ${sender}`, { children: [topRow, timestampEl] });
}

const appendMessage = (sender, text) => {
    messagesBox.prepend(createMessageBox(sender, text));
    messagesBox.scrollTo({ top: 0, behavior: 'smooth' });
};

const sendMessage = () => {
    if (generating) return;
    const text = [...codeSnippets.map(s => "```" + s + "```"), inputBox.value.trim()]
        .filter(Boolean)
        .join("\n\n");
    codeSnippets = [];
    snippetContainer.innerHTML = "";
    inputBox.classList.remove("with-snippets");

    if (!text) return;

    inputBox.value = '';
    generating = true;
    inputBox.disabled = true;
    inputBox.classList.add('loading');
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

    const bubble = makeElCs('div', 'snippet-bubble', { children: [code, deleteBtn] });

    const removeSnippet = () => {
        snippetContainer.removeChild(bubble);
        codeSnippets = codeSnippets.filter(s => s !== text);
        if (codeSnippets.length === 0) {
            inputBox.classList.remove('with-snippets');
        }
    };
    deleteBtn.addEventListener('click', removeSnippet);

    snippetContainer.appendChild(bubble);

    codeSnippets = [...codeSnippets, text];
    inputBox.classList.add('with-snippets');
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'reply' && msg.sender === 'bot') {
        appendMessage(msg.sender, msg.text);
        generating = false;
        inputBox.disabled = false;
        inputBox.classList.remove('loading');
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
        typingIndicator.style.display = 'none';
    }

    if (msg.type === 'insert-snippet') {
        console.log(msg.code);
        if (msg.code) addCodeSnippet(msg.code);
    }
});

// Button and Ctrl+Enter handler
sendBtn.onclick = sendMessage;
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) sendMessage();
});