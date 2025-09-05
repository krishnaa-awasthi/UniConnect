import { StyleSheet, Text, View } from "react-native";

export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20 }
});
