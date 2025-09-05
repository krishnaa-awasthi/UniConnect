// ChatScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io } from "socket.io-client";

const SOCKET_URL = "http://20.1.1.104:3000"; // update with backend

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export default function ChatScreen({ route }: any) {
  const { recipientId } = route.params; // passed from Messenger screen
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const initSocket = async () => {
      const token = await AsyncStorage.getItem("token");

      socketRef.current = io(SOCKET_URL, {
        auth: { token },
      });

      socketRef.current.emit("join_chat", { recipientId });

      socketRef.current.on("receive_message", (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [recipientId]);

  const sendMessage = () => {
    if (input.trim() === "") return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "me",
      text: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    socketRef.current.emit("send_message", { recipientId, text: input });
    setInput("");
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender === "me";
    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.theirMessage,
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Text style={{ color: "white", fontWeight: "bold" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  messageContainer: {
    maxWidth: "75%",
    marginVertical: 4,
    padding: 10,
    borderRadius: 12,
  },
  myMessage: {
    backgroundColor: "#0078ff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 0,
  },
  theirMessage: {
    backgroundColor: "#e5e5ea",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 0,
  },
  messageText: { fontSize: 16, color: "#fff" },
  timestamp: {
    fontSize: 10,
    color: "#ddd",
    marginTop: 4,
    textAlign: "right",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f1f1f1",
    borderRadius: 20,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#0078ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
