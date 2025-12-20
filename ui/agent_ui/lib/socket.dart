import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/html.dart'; // For web only!

// For web testing - SIMPLIFIED VERSION
WebSocketChannel? _channel;
bool _isConnected = false;
final _messageControllers = <String, StreamController<dynamic>>{};
final _generalListeners = <Function(dynamic)>[];

Future<void> initWebSocket({String url = 'ws://localhost:8080'}) async {
  if (_isConnected) return;

  try {
    print('🔄 Connecting to WebSocket at $url...');

    // For WEB platform only (what you're testing on)
    _channel = WebSocketChannel.connect(
      Uri.parse(url),
      protocols: ['chat', 'json'],
    );

    // Listen for messages
    _channel!.stream.listen(
      (message) {
        print('📨 Raw: $message');
        _handleIncomingMessage(message);
      },
      onError: (error) {
        print('❌ WebSocket error: $error');
        _isConnected = false;
      },
      onDone: () {
        print('🔌 Connection closed');
        _isConnected = false;
      },
    );

    _isConnected = true;
    print('✅ WebSocket connection established');
  } catch (e) {
    print('❌ Failed to connect: $e');
    rethrow;
  }
}

void _handleIncomingMessage(dynamic rawMessage) {
  try {
    final message = jsonDecode(rawMessage.toString());

    // Notify general listeners
    for (final listener in _generalListeners) {
      listener(message);
    }

    // Check for specific event handlers
    final event = message['event']?.toString();
    if (event != null && _messageControllers.containsKey(event)) {
      _messageControllers[event]!.add(message['data']);
    }
  } catch (e) {
    print('Error parsing message: $e');
  }
}

// Public API
Future<void> send(String event, dynamic data) async {
  if (!_isConnected) {
    await initWebSocket();
  }

  final payload = jsonEncode({
    'event': event,
    'data': data,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
  });

  _channel!.sink.add(payload);
  print('📤 Sent: $event');
}

Future<dynamic> sendAndWait(
  String event,
  dynamic data, {
  Duration timeout = const Duration(seconds: 60),
}) async {
  if (!_isConnected) {
    await initWebSocket();
  }

  final completer = Completer<dynamic>();
  final requestId = 'req_${DateTime.now().millisecondsSinceEpoch}';

  // Create a temporary listener for this specific response
  void tempListener(dynamic message) {
    if (message['requestId'] == requestId) {
      completer.complete(message['data']);
    }
  }

  addMessageListener(tempListener);

  final payload = jsonEncode({
    'event': event,
    'data': data,
    'requestId': requestId,
  });

  _channel!.sink.add(payload);
  print('📤 Sent (waiting): $event [ID: $requestId]');

  // Set timeout
  Timer(timeout, () {
    if (!completer.isCompleted) {
      completer.completeError(
        TimeoutException('No response received for $event'),
      );
    }
  });

  try {
    final result = await completer.future;
    removeMessageListener(tempListener);
    return result;
  } catch (e) {
    removeMessageListener(tempListener);
    rethrow;
  }
}

void addMessageListener(Function(dynamic) listener) {
  _generalListeners.add(listener);
}

void removeMessageListener(Function(dynamic) listener) {
  _generalListeners.remove(listener);
}

Future<void> disconnect() async {
  await _channel?.sink.close();
  _channel = null;
  _isConnected = false;
  _generalListeners.clear();
  print('🔌 Disconnected');
}

bool get isConnected => _isConnected;
