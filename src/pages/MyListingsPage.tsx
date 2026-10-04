import React from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState } from "../components/EmptyState";
import { PageTitle } from "../components/PageTitle";
import { Listing } from "../types";

interface MyListingsPageProps {
  items: Listing[];
  onOpen: (item: Listing) => void;
  onSell: () => void;
  onDelete?: (id: string) => void;
}

export function MyListingsPage({
  items,
  onOpen,
  onSell,
  onDelete,
}: MyListingsPageProps) {
  const handleDeletePrompt = (item: Listing) => {
    if (!onDelete) return;

    // Check if web or native
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
        onDelete(item.id);
      }
    } else {
      Alert.alert(
        "Delete Listing",
        `Are you sure you want to delete "${item.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(item.id),
          },
        ]
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PageTitle
        title="My listings"
        subtitle="Items you have posted to campus marketplace"
      />
      {items.length === 0 ? (
        <EmptyState
          title="No listings yet"
          message="Publish an item and it will appear here for other students to buy."
          action="Sell an item"
          onAction={onSell}
        />
      ) : (
        <FlatList
          data={items}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.cardContent}
                onPress={() => onOpen(item)}
              >
                <Image source={{ uri: item.image }} style={styles.image} />
                <View style={styles.info}>
                  <Text style={styles.category}>{item.category.toUpperCase()}</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.price}>${item.price}</Text>
                  <Text style={styles.muted}>{item.condition} · {item.campus}</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeletePrompt(item)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },
  list: { gap: 14, marginTop: 8 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E9ECE6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#ECEFE9",
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  category: {
    fontSize: 10,
    fontWeight: "800",
    color: "#23775D",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#173C34",
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C7057",
    marginTop: 2,
  },
  muted: {
    fontSize: 11,
    color: "#87918C",
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FDF0F0",
    borderWidth: 1,
    borderColor: "#F7D7D9",
  },
  deleteText: {
    color: "#B64950",
    fontSize: 12,
    fontWeight: "700",
  },
});
