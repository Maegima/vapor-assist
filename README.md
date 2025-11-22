# 🚀 Vapor Assist
A lightweight AI-powered coding assistant for Visual Studio Code

Vapor Assist brings an intelligent, developer-focused chat panel directly into your VS Code sidebar.

Ask questions, analyze code, generate snippets, refactor functions, or get help with your project — all without leaving your editor.

## ✨ Features
💬 Side-panel AI chat integrated directly into the Activity Bar

🧠 Works with local LLMs (Ollama) or remote APIs

⚡ Fast, clean UI designed to stay out of your way

🔍 Send selected code with a single keybinding ( Ctrl + L )

📂 Project-based config using .vapor/config.yaml
🛠 Supports multiple model types : ollama, ollama-chat, API endpoints

📝 Snippet support for sending partial code blocks to the assistant

## 📦 Installation

Search for "Vapor Assist" in the VS Code Marketplace

or install manually by loading the .vsix file.

## 🧰 Usage
### Open the Assist Panel
From the command palette:

`Vapor Assist: Open Chat Panel`

Or click the Assist icon in the VS Code Activity Bar.

### Send Selected Code

Highlight any code in the editor and press:

`Ctrl + L`

This sends the selected snippet directly into the chat panel.

## ⚙️ Configuration

Vapor Assist uses a project-local configuration file:

`vapor-config.yaml`

#### Example:
```yaml
endpoint: "http://localhost:11434/api/chat"
type: "ollama-chat"
model: "llama3"
```

### Supported fields:
#### Key Description
- `endpoint`: API or local endpoint for your LLM
- `type`: ollama, ollama-chat, ollama-generate, api
- `model`: Name of the model to use

If the workspace config is missing, Vapor Assist falls back to the extension’s default config.yaml .

## 🔌 Commands
|Command|Description|
|---|---|
| vaporAssist.openPanel | Opens the Vapor Assist chat panel |
| vaporAssist.addSelectedCode | Sends selected text as a snippet |

### ⌨️ Keybindings
|Shortcut|Action|
|---|---|
| Ctrl + L | Send selected code snippet |

## 🛠 Development
### Watch mode for development:
```bash
npm install
npm run watch
```

### To build:
```bash
npm run compile
```

## 🤝 Contributing

Contributions are welcome!

Feel free to open issues, submit pull requests, or share ideas.

## 📄 License

This extension is licensed under the [MIT License](LICENSE).