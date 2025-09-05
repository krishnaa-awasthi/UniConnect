// app/messenger.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import io, { Socket } from "socket.io-client";
import { API_BASE } from "./config/api";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  avatar?: string;
}

export default function Messenger() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // ✅ Socket connection
  useEffect(() => {
    let activeSocket: Socket | null = null;

    const connectSocket = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          setLoading(false);
          return;
        }

        activeSocket = io(API_BASE, {
          auth: { token: `Bearer ${token}` },
          transports: ["websocket"],
        });

        setSocket(activeSocket);

        activeSocket.on("connect", () => {
          console.log("✅ Connected to chat server");
        });

        activeSocket.on("chats", (chatList: Chat[]) => {
          setChats(chatList);
          setFilteredChats(chatList);
          setLoading(false);
        });

        activeSocket.on("new_message", (newChat: Chat) => {
          setChats((prev) => {
            const updated = [newChat, ...prev.filter((c) => c.id !== newChat.id)];
            setFilteredChats(updated);
            return updated;
          });
        });
      } catch (err) {
        console.error("Socket error:", err);
        setLoading(false);
      }
    };

    connectSocket();

    return () => {
      if (activeSocket) {
        activeSocket.removeAllListeners();
        activeSocket.disconnect();
      }
    };
  }, []);

  // ✅ Filter chats when search changes
  useEffect(() => {
    if (search.trim() === "") {
      setFilteredChats(chats);
    } else {
      setFilteredChats(
        chats.filter((chat) =>
          chat.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, chats]);

  // ✅ Render each chat row
  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity style={styles.chatCard}>
      <Image
        source={{ uri: item.avatar || "https://via.placeholder.com/50" }}
        style={styles.avatar}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.chatName}>{item.name || "Unknown User"}</Text>
        <Text style={styles.chatMessage} numberOfLines={1}>
          {item.lastMessage || "No messages yet"}
        </Text>
      </View>
      <Text style={styles.chatTime}>
        {item.timestamp
          ? new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </Text>
    </TouchableOpacity>
  );

  // ✅ Status Bar (Stories-like)
  const renderStatusBar = () => (
    <View style={styles.statusBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[...Array(8)].map((_, index) => (
          <View key={index} style={styles.statusItem}>
            <Image
              source={{
                uri:
                  "https://randomuser.me/api/portraits/men/" +
                  (index + 1) +
                  ".jpg",
              }}
              style={styles.statusAvatar}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              User {index + 1}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 🔝 Header with Back Arrow */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* 🔍 Search Bar */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search messages"
        value={search}
        onChangeText={setSearch}
      />

      {/* 🔝 Status/Stories Bar */}
      {renderStatusBar()}

      {/* 💬 Chat List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={{ marginTop: 50 }}
        />
      ) : filteredChats.length === 0 ? (
        <Text style={styles.noChats}>No conversations yet</Text>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // 🔝 Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 15,
    color: "#222",
  },

  // 🔍 Search Bar
  searchBar: {
    backgroundColor: "#f2f2f2",
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    margin: 15,
  },

  // 👤 Status Bar
  statusBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
  },
  statusItem: {
    alignItems: "center",
    marginHorizontal: 10,
  },
  statusAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#e73636ff",
  },
  statusText: {
    marginTop: 5,
    fontSize: 12,
    color: "#333",
    maxWidth: 60,
    textAlign: "center",
  },

  // 💬 Chat list
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatName: { fontSize: 16, fontWeight: "600", color: "#222" },
  chatMessage: { fontSize: 14, color: "#666", marginTop: 2 },
  chatTime: { fontSize: 12, color: "#999", marginLeft: 10 },
  noChats: { textAlign: "center", marginTop: 50, fontSize: 16, color: "#888" },
});
