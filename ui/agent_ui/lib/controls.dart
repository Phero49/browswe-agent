import 'package:agent_ui/socket.dart';
import 'package:flutter/material.dart';

class Controls extends StatefulWidget {
  const Controls({super.key});

  @override
  State<Controls> createState() => _ControlsState();
}

class _ControlsState extends State<Controls> {
  // Controller for the message input field
  final TextEditingController _messageController = TextEditingController();

  // Simple in-memory list of messages
  final List<String> _messages = [];
  bool isAgentMode = false;
  bool captureScreen = false;

  void _toggleAgentMode() {
    setState(() {
      isAgentMode = !isAgentMode;
    });
  }

  @override
  void dispose() {
    // Always dispose controllers to avoid memory leaks
    _messageController.dispose();
    super.dispose();
  }

  // Adds a message to the chat list
  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      send("message", {
        "message": text,
        "agentMode": isAgentMode,
        'captureScreen': captureScreen,
      });
      _messages.add(text);
    });

    _messageController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          IconButton(
            onPressed: () {
              // Open menu or settings
            },
            icon: const Icon(Icons.more_vert),
          ),
        ],
      ),
      body: Column(
        children: [
          // Chat messages list
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                return Align(
                  // Align messages to the right (sender-style UI)
                  alignment: Alignment.centerRight,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade600,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _messages[index],
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                );
              },
            ),
          ),

          // Message input area
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      decoration: InputDecoration(
                        prefixIcon: PopupMenuButton(
                          icon: Icon(Icons.add),
                          itemBuilder: (context) => [
                            PopupMenuItem(
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Agent Mode',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  SizedBox(width: 10),

                                  Switch(
                                    value: isAgentMode,
                                    onChanged: (val) {
                                      _toggleAgentMode();

                                      Navigator.pop(
                                        context,
                                      ); // close menu after toggle
                                    },
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuItem(
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Capture screen',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  SizedBox(width: 10),

                                  Switch(
                                    value: isAgentMode,
                                    onChanged: (val) {
                                      setState(() {
                                        captureScreen = !captureScreen;
                                      });

                                      Navigator.pop(
                                        context,
                                      ); // close menu after toggle
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        hintText: 'Type a message',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _sendMessage,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
