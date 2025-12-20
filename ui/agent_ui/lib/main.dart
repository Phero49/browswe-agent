import 'dart:io';
import 'dart:js_interop';

import 'package:agent_ui/controls.dart';
import 'package:agent_ui/socket.dart';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:web/web.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        // This is the theme of your application.
        //
        // TRY THIS: Try running your application with "flutter run". You'll see
        // the application has a purple toolbar. Then, without quitting the app,
        // try changing the seedColor in the colorScheme below to Colors.green
        // and then invoke "hot reload" (save your changes or press the "hot
        // reload" button in a Flutter-supported IDE, or press "r" if you used
        // the command line to start the app).
        //
        // Notice that the counter didn't reset back to zero; the application
        // state is not lost during the reload. To reset the state, use hot
        // restart instead.
        //
        // This works for code too, not just values: Most code changes can be
        // tested with just a hot reload.
        colorScheme: .fromSeed(seedColor: Colors.deepPurple),
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  // This widget is the home page of your application. It is stateful, meaning
  // that it has a State object (defined below) that contains fields that affect
  // how it looks.

  // This class is the configuration for the state. It holds the values (in this
  // case the title) provided by the parent (in this case the App widget) and
  // used by the build method of the State. Fields in a Widget subclass are
  // always marked "final".

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  bool showControls = false;
  Future<WebSocketChannel> connectToWebSocket() async {
    try {
      print('🔄 Connecting to WebSocket...');

      // Use ws:// protocol (not TCP!)
      final channel = IOWebSocketChannel.connect(
        'ws://127.0.0.1:8080', // or 'ws://10.0.2.2:8080' for Android emulator
        protocols: ['chat', 'json'],
      );

      print('✅ WebSocket connection established');

      // Listen to incoming messages
      channel.stream.listen(
        (message) {
          print('📨 Received: $message');
        },
        onError: (error) {
          print('❌ WebSocket error: $error');
        },
        onDone: () {
          print('🔌 WebSocket connection closed');
        },
      );

      return channel;
    } catch (e) {
      print('❌ Failed to connect: $e');
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    // This method is rerun every time setState is called, for instance as done
    // by the _incrementCounter method above.
    //
    // The Flutter framework has been optimized to make rerunning build methods
    // fast, so that you can just rebuild anything that needs updating rather
    // than having to individually change instances of widgets.
    if (showControls) {
      return Controls();
    }
    return Scaffold(
      body: Center(
        child: Container(
          alignment: Alignment.center,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              shape: const CircleBorder(),
              elevation: 12,
              padding: const EdgeInsets.all(20),
              backgroundColor: Theme.of(context).colorScheme.primary,
              shadowColor: Colors.black54,
            ),
            onPressed: () async {
              var search = window.location.search;
              if (search.isNotEmpty) {
                var index = search.split('=')[1];
                var launched = await send("open-controls", {"index": index});
                setState(() {
                  print('change url');
                  showControls = true;
                });
              } else {
                print("tab id not found");
              }
            },
            child: const FaIcon(
              FontAwesomeIcons.wandMagicSparkles, // Sparkles icon
              size: 50,
            ),
          ),
        ),
      ),
    );
  }
}
