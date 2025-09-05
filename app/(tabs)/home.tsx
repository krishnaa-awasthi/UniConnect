// app/(tabs)/home.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { API_BASE } from "../config/api";

interface Media {
  uri: string;
  type: "image" | "video";
}
interface Post {
  id?: string;
  caption?: string;
  media?: Media;
  author: { name: string; username: string; avatar: string };
  timestamp?: string;
  likes?: number;
  comments?: number;
}

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [newPost, setNewPost] = useState<{ caption: string; media: Media | null }>({
    caption: "",
    media: null,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();


  /* -------------------- Fetch Posts -------------------- */
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/posts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Media Picker -------------------- */
  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setNewPost({
          ...newPost,
          media: {
            uri: asset.uri,
            type: asset.type === "video" ? "video" : "image",
          },
        });
      }
    } catch (err) {
      console.error("Media pick error:", err);
      Alert.alert("Error", "Unable to pick media.");
    }
  };

  /* -------------------- Submit Post -------------------- */
  const submitPost = async () => {
    if (!newPost.caption.trim() && !newPost.media) {
      Alert.alert("Error", "Please write something or add media.");
      return;
    }

    try {
      const loggedInUser = await AsyncStorage.getItem("loggedInUser");
      const token = await AsyncStorage.getItem("token");
      if (!loggedInUser || !token) {
        Alert.alert("Error", "You must be logged in to post.");
        return;
      }

      const res = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caption: newPost.caption,
          media: newPost.media
            ? { uri: newPost.media.uri, type: newPost.media.type }
            : null,
          author: {
            name: loggedInUser,
            username: loggedInUser.toLowerCase(),
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              loggedInUser
            )}`,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to post");
      await fetchPosts(); // refresh feed
      setNewPost({ caption: "", media: null });
      setModalVisible(false);
    } catch (error) {
      console.error("Error submitting post:", error);
      Alert.alert("Error", "Could not submit post.");
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#C62828"
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
         {/* Top Bar */}
<View style={styles.topBar}>
  <Text style={styles.logo}>
    <Text style={{ color: "#d63333ff", fontWeight: "bold" }}>Uni</Text>
    <Text style={{ color: "#000", fontWeight: "bold" }}>Connect</Text>
  </Text>

  <View style={styles.actions}>
    {/* 🔎 Search icon → opens search.tsx */}
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => router.push("/(tabs)/search")}
    >
      <Ionicons name="search-outline" size={22} color="#333" />
    </TouchableOpacity>

    {/* 💬 Messenger icon */}
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => router.push("/messenger")}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={22} color="#333" />
    </TouchableOpacity>

    {/* ➕ Add post icon */}
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => setModalVisible(true)}
    >
      <Ionicons name="add" size={24} color="#b44" />
    </TouchableOpacity>
  </View>
</View>

          {/* Posts Feed */}
          <View style={{ padding: 15 }}>
            {posts.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#666" }}>
                No posts yet.
              </Text>
            ) : (
              posts.map((post) => (
                <View
                  key={post.id || `${post.author.username}-${Math.random()}`}
                  style={styles.tweetCard}
                >
                  {/* Header */}
                  <View style={styles.tweetHeader}>
                    <Image
                      source={{
                        uri:
                          post.author?.avatar ||
                          "https://via.placeholder.com/100",
                      }}
                      style={styles.avatar}
                    />
                    <View>
                      <Text style={styles.tweetName}>
                        {post.author?.name || "Unknown"}
                      </Text>
                      <Text style={styles.handle}>
                        @{post.author?.username || "user"} ·{" "}
                        {post.timestamp || "just now"}
                      </Text>
                    </View>
                  </View>

                  {/* Caption */}
                  {post.caption ? (
                    <Text style={styles.tweetText}>{post.caption}</Text>
                  ) : null}

                  {/* Media */}
                  {post.media?.uri && (
                    <Image
                      source={{ uri: post.media.uri }}
                      style={styles.tweetImage}
                    />
                  )}

                  {/* Footer */}
                  <View style={styles.tweetFooter}>
                    <Text style={styles.footerText}>
                      {post.likes || 0} Likes
                    </Text>
                    <Text style={styles.footerText}>
                      {post.comments || 0} Comments
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Create Post Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create Post</Text>

          <TextInput
            style={styles.captionInput}
            placeholder="What's on your mind? #hashtags @mentions"
            value={newPost.caption}
            onChangeText={(text) => setNewPost({ ...newPost, caption: text })}
            multiline
          />

          {newPost.media && (
            <Image source={{ uri: newPost.media.uri }} style={styles.preview} />
          )}

          <TouchableOpacity style={styles.mediaBtn} onPress={pickMedia}>
            <Text style={styles.mediaBtnText}>Add Photo/Video</Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#999" }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#C62828" }]}
              onPress={submitPost}
            >
              <Text style={styles.btnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },

  // Top Bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingTop: 50,
    marginBottom: 15,
  },
  logo: { fontSize: 18, fontWeight: "bold" },
  actions: { flexDirection: "row", alignItems: "center" },
  iconButton: { marginLeft: 12, padding: 6 },
  searchInput: {
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 14,
  },

  // Post Card
  tweetCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tweetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 8 },
  tweetName: { fontWeight: "bold", fontSize: 14, color: "#000" },
  handle: { color: "#666", fontSize: 12 },
  tweetText: { fontSize: 14, color: "#000", marginBottom: 8 },
  tweetImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  tweetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  footerText: { fontSize: 12, color: "#666" },

  // Modal
  modalContainer: { flex: 1, padding: 20, backgroundColor: "#fff" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  captionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  preview: { width: "100%", height: 200, borderRadius: 10, marginBottom: 10 },
  mediaBtn: {
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  mediaBtnText: { color: "#333", fontWeight: "bold" },
  modalActions: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold" },
});