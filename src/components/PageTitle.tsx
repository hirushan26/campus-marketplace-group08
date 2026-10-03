import { StyleSheet, Text, View } from "react-native";
export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingTop: 30, paddingBottom: 26 },
  title: { color: "#173C34", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#87918C", fontSize: 12, marginTop: 5 },
});
