// app/(tabs)/search.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE } from "../config/api"; // ✅ central API config

interface Profile {
  id: string;
  name: string;
  headline: string;
  avatar?: string;
}

interface Post {
  id: string;
  mediaUrl: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  /* ------------------ Fetch Search Results ------------------ */
  const fetchResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProfiles([]);
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/search?query=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      setProfiles(data.users || []);
      setPosts(data.posts || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Debounced search
  const debouncedSearch = useCallback(debounce(fetchResults, 400), []);

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query]);

  /* ------------------ Render Profile ------------------ */
  const renderProfile = (item: Profile) => (
    <TouchableOpacity
      style={styles.profileCard}
      onPress={() =>
        router.push({ pathname: "/profile", params: { id: item.id } })
      }
    >
      <Image
        source={{ uri: item.avatar || "https://via.placeholder.com/50" }}
        style={styles.profileImage}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.profileName}>{item.name}</Text>
        <Text style={styles.profileHeadline}>{item.headline}</Text>
      </View>
      <TouchableOpacity style={styles.connectBtn}>
        <Text style={styles.connectText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  /* ------------------ Render Post ------------------ */
  const IMAGE_SIZE = (Dimensions.get("window").width - 48) / 3; // dynamic grid size
  const renderPostsGrid = (posts: Post[]) => (
    <View style={styles.gridContainer}>
      {posts.map((p) => (
        <Image
          key={p.id}
          source={{ uri: p.mediaUrl }}
          style={[styles.gridImage, { width: IMAGE_SIZE, height: IMAGE_SIZE }]}
        />
      ))}
    </View>
  );

  /* ------------------ Sections Data ------------------ */
  const sections = [];
  if (profiles.length > 0) {
    sections.push({ title: "People", data: profiles });
  }
  if (posts.length > 0) {
    sections.push({ title: "Explore", data: [{ type: "posts" }] });
  }

  return (
    <View style={styles.container}>
      {/* Header with Back + Search Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#555" />
          <TextInput
            style={styles.input}
            placeholder="Search people, jobs, posts..."
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#C62828"
          style={{ marginTop: 20 }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id ?? `post-${index}`}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionTitle}>{title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.title === "People"
              ? renderProfile(item as Profile)
              : renderPostsGrid(posts)
          }
          ListEmptyComponent={
            query.trim() &&
            !loading && (
              <Text style={styles.emptyText}>
                No results found for "{query}"
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

/* ------------------ Styles ------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f1f1",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  input: { flex: 1, padding: 8, fontSize: 16, marginLeft: 6 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 10,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  profileImage: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  profileName: { fontSize: 16, fontWeight: "600" },
  profileHeadline: { fontSize: 13, color: "#666" },
  connectBtn: {
    backgroundColor: "#C62828",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  connectText: { color: "#fff", fontWeight: "500" },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridImage: {
    borderRadius: 8,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
  },
});
