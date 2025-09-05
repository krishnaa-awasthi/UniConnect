// app/createPost.tsx
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  ScrollView 
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

export default function CreatePost() {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Post</Text>
      </View>

      {/* Caption Input */}
      <TextInput
        style={styles.captionInput}
        placeholder="Write a caption..."
        placeholderTextColor="#999"
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      {/* Media Preview */}
      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={22} color="#333" />
          <Text style={styles.btnText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.postBtn]}>
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={[styles.btnText, { color: "#fff" }]}>Post</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
  },
  captionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: "top",
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnText: {
    fontSize: 16,
    color: "#333",
  },
  postBtn: {
    backgroundColor: "#e73636",
    borderColor: "#e73636",
  },
});
