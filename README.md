# browser-agent

A slightly unhinged experiment: turning Google Chrome into an AI-assisted browser **without calling proprietary APIs**, relying instead on a public AI assistant with strong vision capabilities.

The goal is not to build a chatbot bolted onto a browser, but a browser that can *see*, *reason*, and *act* on the web the way a human does—clicking, scrolling, reading, and navigating real pages.

---

## Philosophy

Most "AI browsers" are thin wrappers around APIs. This project deliberately avoids that path.

Instead:

* The browser itself is the environment
* Vision is the primary input
* Automation is grounded in real DOM interaction

This makes the system slower, messier, and far more interesting—and closer to how humans actually browse.

---

## Stack Overview

* **Node.js** – Core runtime and orchestration layer
* **Puppeteer** – Direct control over Chrome (navigation, interaction, screenshots)
* **Flutter** – Web-based control panel UI
* **Qwen** – Chosen AI model due to strong vision and multimodal reasoning
* **Quasar (optional)** – Used for building a Chrome extension if advanced browser-side features are needed

---

## Architecture

* **Puppeteer** controls the Chrome instance and exposes browser actions
* **Node backend** acts as the brainstem, coordinating AI reasoning and browser actions
* **Flutter web control panel** provides a visual interface to monitor and steer the agent
* **Chrome extension (Quasar)** is optional and only introduced if browser-native features (like advanced tab management) become necessary

The extension, if used, communicates with the Node backend rather than embedding logic inside Chrome.

---

## Installation

Install dependencies using Bun:

```bash
bun install
```

---

## Running the Project

Start the agent with:

```bash
bun run index.ts
```

This will:

* Launch the Node backend
* Start Puppeteer-controlled Chrome
* Enable the Flutter web control panel

---

## Status

This is an experimental project.

Expect:

* Rough edges
* Rapid architectural changes
* Strange but enlightening failures

The purpose is exploration, not polish.

---

## Future Directions

* Smarter perception loops (less screenshot spam)
* Persistent memory across browsing sessions
* Extension-based tab and context management
* More autonomy, fewer hard-coded flows

The browser is the world. The agent just needs better senses.
