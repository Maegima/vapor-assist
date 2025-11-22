const vscode = acquireVsCodeApi();
const customInput = document.getElementById('custom-input');
const inputWrapper = document.getElementById('input-wrapper');
const sendBtn = document.getElementById('send');
const messagesBox = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const snippetContainer = document.getElementById('snippet-container');

let codeSnippets = [];
let generating = false;

function copyIcon() {
    return `
    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path>
    </svg>`;
}

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
            const btn = makeElCs('button', 'copy-btn', {html: copyIcon()});
            btn.onclick = () => {
                navigator.clipboard.writeText(block.innerText);
            }
            block.before(makeElCs("div", "btn-container", { children: [btn] }));
        });
    });

    const copyBtn = makeElCs("button", "copy-btn", { html: copyIcon(), attrs: { title: "Copy message" } });
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
    if (msg.type === 'reply' && msg.sender === 'bot') {
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
});

sendBtn.onclick = sendMessage;
inputWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) sendMessage();
});