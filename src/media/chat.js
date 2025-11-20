const vscode = acquireVsCodeApi();
const inputBox = document.getElementById('input');
const sendBtn = document.getElementById('send');
const messagesBox = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const snippetContainer = document.getElementById('snippet-container');

let codeSnippets = [];
let generating = false;

const appendMessage = (sender, text) => {
    const div = document.createElement('div');
    div.classList.add('message', sender);

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <span class="content">${marked.parse(text)}</span>
            <button class="copy-btn" title="Copy message">📋</button>
        </div>
        <div style="font-size:0.7em; color:#aaa; margin-top:4px;">${timestamp}</div>
    `;

    messagesBox.prepend(div);

    div.querySelector('.copy-btn').onclick = () => {
        const content = div.querySelector('.content').innerText;
        navigator.clipboard.writeText(content).then(() => {
            const btn = div.querySelector('.copy-btn');
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1000);
        });
    };
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
    codeSnippets.push(text);

    const bubble = document.createElement("div");
    bubble.className = "snippet-bubble";

    bubble.innerHTML = `
        <code>${text}</code>
        <span class="snippet-delete">×</span>
    `;

    const deleteBtn = bubble.querySelector(".snippet-delete");

    deleteBtn.onclick = () => {
        snippetContainer.removeChild(bubble);
        codeSnippets = codeSnippets.filter(s => s !== text);
        if (codeSnippets.length === 0) {
            inputBox.classList.remove("with-snippets");
        }
    };

    snippetContainer.appendChild(bubble);
    inputBox.classList.add("with-snippets");
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