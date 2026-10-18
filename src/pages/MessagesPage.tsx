import React from "react";
import {
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
import { Conversation } from "../types";

interface MessagesPageProps {
  conversations: Conversation[];
  currentUserId: string;
  onOpenConversation: (conversation: Conversation) => void;
  onBrowse: () => void;
}

export function MessagesPage({
  conversations,
  currentUserId,
  onOpenConversation,
  onBrowse,
}: MessagesPageProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PageTitle title="Messages" subtitle="Keep campus meetups simple" />

      {conversations.length === 0 ? (
        <EmptyState
          title="Your inbox is quiet"
          message="When you message a seller or receive inquiries, conversations will show up here."
          action="Browse listings"
          onAction={onBrowse}
        />
      ) : (
        <FlatList
          data={conversations}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const otherUserId = item.memberIds.find((id) => id !== currentUserId);
            const otherName =
              (otherUserId && item.memberNames?.[otherUserId]) || "Campus User";

            return (
              <Pressable
                style={styles.conversationCard}
                onPress={() => onOpenConversation(item)}
              >
                {item.listingImage ? (
                  <Image
                    source={{ uri: item.listingImage }}
                    style={styles.listingThumbnail}
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Text style={styles.thumbnailText}>💬</Text>
                  </View>
                )}
                <View style={styles.conversationInfo}>
                  <View style={styles.topRow}>
                    <Text style={styles.userName}>{otherName}</Text>
                    <Text style={styles.listingTag} numberOfLines={1}>
                      {item.listingTitle}
                    </Text>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage || "Started a conversation"}
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  list: {
    gap: 12,
    marginTop: 8,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8EBE5",
  },
  listingThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#ECEFE9",
  },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#D6E5D7",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailText: {
    fontSize: 20,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#173C34",
  },
  listingTag: {
    fontSize: 11,
    color: "#23775D",
    fontWeight: "600",
    maxWidth: "50%",
  },
  lastMessage: {
    fontSize: 13,
    color: "#65766D",
  },
  arrow: {
    fontSize: 22,
    color: "#9BA59F",
    fontWeight: "600",
  },
});
