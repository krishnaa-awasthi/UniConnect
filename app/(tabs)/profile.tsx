// app/(tabs)/profile.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE } from "../config/api";

const { width } = Dimensions.get("window");

interface Post {
  caption: string;
  image?: string;
  createdAt?: string;
  liked?: boolean;
  likeCount?: number;
}

interface ProfileData {
  collegeId: string;
  username: string;
  bio: string;
  profilePic?: string;
  coverPic?: string;
  posts: Post[];
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newBio, setNewBio] = useState("");
  const [username, setUsername] = useState("");

  const isFocused = useIsFocused();

  /* -------------------- Load Logged In User -------------------- */
  useEffect(() => {
    const loadUser = async () => {
      const savedUser = await AsyncStorage.getItem("loggedInUser");
      if (savedUser) setUsername(savedUser);
      else setLoading(false);
    };
    loadUser();
  }, []);

  /* -------------------- Fetch Profile -------------------- */
  useEffect(() => {
    if (username) fetchProfile();
  }, [username]);

  /* -------------------- Refresh on Focus -------------------- */
  useEffect(() => {
    if (isFocused && username) {
      fetchProfile(false); // fetch without loading spinner
    }
  }, [isFocused]);

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/profile?username=${username}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.profile) throw new Error(data.message || "Invalid response");

      const user: ProfileData = {
        ...data.profile,
        posts: Array.isArray(data.profile.posts)
          ? data.profile.posts.map((p) => ({ ...p, liked: false, likeCount: 0 }))
          : [],
      };

      setProfile(user);
      setNewUsername(user.username || "");
      setNewBio(user.bio || "");
    } catch (err) {
      console.error("Profile fetch error:", err);
      Alert.alert("Error", "Failed to load profile.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  /* -------------------- Pull-to-Refresh -------------------- */
  const onRefresh = async () => {
    if (!username) return;
    setRefreshing(true);
    try {
      await fetchProfile(false);
    } finally {
      setRefreshing(false);
    }
  };

  /* -------------------- Update Profile -------------------- */
  const updateProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Error", "Missing token, please log in again.");

      const res = await fetch(`${API_BASE}/profile/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newUsername, bio: newBio }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        const updated: ProfileData = {
          ...data.profile,
          posts: Array.isArray(data.profile.posts)
            ? data.profile.posts.map((p) => ({ ...p, liked: false, likeCount: 0 }))
            : [],
        };
        setProfile(updated);
        setEditing(false);

        if (updated.username) {
          await AsyncStorage.setItem("loggedInUser", updated.username);
          setUsername(updated.username);
        }
      } else {
        Alert.alert("Error", data.message || "Update failed");
      }
    } catch (err) {
      console.error("Update error:", err);
      Alert.alert("Update Error", String(err));
    }
  };

  /* -------------------- Image Picker & Upload -------------------- */
  const pickImage = async (type: "profile" | "cover") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === "cover" ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const token = await AsyncStorage.getItem("token");
        if (!token) return Alert.alert("Error", "Missing token, please log in again.");

        const formData = new FormData();
        formData.append(
          type === "profile" ? "profilePic" : "coverPic",
          {
            uri: result.assets[0].uri,
            name: `${type}.jpg`,
            type: "image/jpeg",
          } as any
        );

        const endpoint =
          type === "profile"
            ? `${API_BASE}/profile/upload-pic`
            : `${API_BASE}/profile/upload-cover`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (data.success) await fetchProfile(false);
        else Alert.alert("Error", data.message || "Image upload failed");
      }
    } catch (err) {
      console.error("Image pick/upload error:", err);
      Alert.alert("Upload Error", String(err));
    }
  };

  /* -------------------- Toggle Like -------------------- */
  const toggleLike = (index: number) => {
    if (!profile) return;
    const updatedPosts = [...profile.posts];
    const post = updatedPosts[index];
    post.liked = !post.liked;
    post.likeCount = post.liked ? (post.likeCount || 0) + 1 : (post.likeCount || 1) - 1;
    setProfile({ ...profile, posts: updatedPosts });
  };

  /* -------------------- Logout -------------------- */
  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("loggedInUser");
    Alert.alert("Logged out", "You have been logged out.");
  };

  /* -------------------- Loading / Error State -------------------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#d6336c" />
        <Text style={{ marginTop: 10, color: "#555" }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.loader}>
        <Text style={{ color: "red" }}>Failed to load profile.</Text>
      </SafeAreaView>
    );
  }

  /* -------------------- Main UI -------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Cover Photo */}
        <TouchableOpacity onPress={() => pickImage("cover")}>
          <Image
            source={{
              uri: profile.coverPic
                ? profile.coverPic.startsWith("http")
                  ? profile.coverPic
                  : `${API_BASE}${profile.coverPic}`
                : "https://via.placeholder.com/800x400.png?text=Cover+Photo",
            }}
            style={styles.coverPhoto}
          />
        </TouchableOpacity>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => pickImage("profile")}>
            <Image
              source={{
                uri: profile.profilePic
                  ? profile.profilePic.startsWith("http")
                    ? profile.profilePic
                    : `${API_BASE}${profile.profilePic}`
                  : "https://ui-avatars.com/api/?name=" + encodeURIComponent(profile.username),
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>

          {editing ? (
            <>
              <TextInput
                style={styles.input}
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder="Username"
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={newBio}
                onChangeText={setNewBio}
                placeholder="Bio"
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={updateProfile}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.name}>{profile.username}</Text>
              <Text style={styles.subText}>{profile.bio}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editText}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Posts & Blogs</Text>
          {profile.posts.length === 0 ? (
            <Text style={styles.noPosts}>No posts yet</Text>
          ) : (
            profile.posts.map((post, idx) => (
              <View key={idx} style={styles.postCard}>
                {post.image && (
                  <Image
                    source={{ uri: post.image.startsWith("http") ? post.image : `${API_BASE}${post.image}` }}
                    style={styles.postImage}
                  />
                )}
                <View style={styles.postContent}>
                  <Text style={styles.postCaption}>{post.caption}</Text>
                  <View style={styles.postActions}>
                    <TouchableOpacity onPress={() => toggleLike(idx)}>
                      <Text style={[styles.actionText, { color: post.liked ? "#d6336c" : "#555" }]}>
                        ❤️ {post.likeCount || 0}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Text style={styles.actionText}>💬 Comment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Text style={styles.actionText}>🔗 Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingsItem} onPress={() => setEditing(true)}>
            <Ionicons name="person-outline" size={22} color="#555" />
            <Text style={styles.settingsText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert("Change Password")}>
            <Ionicons name="key-outline" size={22} color="#555" />
            <Text style={styles.settingsText}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert("Privacy Settings")}>
            <Ionicons name="lock-closed-outline" size={22} color="#555" />
            <Text style={styles.settingsText}>Privacy Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert("Notification Settings")}>
            <Ionicons name="notifications-outline" size={22} color="#555" />
            <Text style={styles.settingsText}>Notification Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color="#d6336c" />
            <Text style={[styles.settingsText, { color: "#d6336c" }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fafafa" },
  coverPhoto: { width: width, height: 200, backgroundColor: "#ccc" },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    padding: 20,
    elevation: 3,
    marginHorizontal: 15,
    marginTop: -60,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#fff", marginBottom: 10 },
  name: { fontSize: 20, fontWeight: "bold" },
  subText: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 5 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8, marginTop: 10, width: "100%" },
  editBtn: { backgroundColor: "#d6336c", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginTop: 10 },
  editText: { color: "#fff", fontWeight: "bold" },
  saveBtn: { backgroundColor: "#28a745", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginTop: 10 },
  saveText: { color: "#fff", fontWeight: "bold" },
  postsSection: { marginTop: 20, paddingHorizontal: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  noPosts: { color: "#777", textAlign: "center", marginTop: 20 },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  postImage: { width: "100%", height: 200, borderRadius: 10, marginBottom: 10 },
  postContent: { paddingHorizontal: 5 },
  postCaption: { fontSize: 14, color: "#333" },
  postActions: { flexDirection: "row", marginTop: 10, justifyContent: "space-around" },
  actionText: { fontSize: 14, fontWeight: "bold" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* Settings */
  settingsSection: { marginTop: 30, paddingHorizontal: 15 },
  settingsItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderColor: "#ccc" },
  settingsText: { marginLeft: 15, fontSize: 16, color: "#555" },
});
