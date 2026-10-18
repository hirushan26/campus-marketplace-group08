import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { ChatMessage, Conversation } from "../types";

interface ChatRoomModalProps {
  visible: boolean;
  conversation: Conversation | null;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
}

export function ChatRoomModal({
  visible,
  conversation,
  currentUserId,
  currentUserName,
  onClose,
}: ChatRoomModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Determine other participant's display name
  const otherUserId = conversation?.memberIds.find((id) => id !== currentUserId);
  const otherUserName =
    (otherUserId && conversation?.memberNames?.[otherUserId]) || "Campus Seller";

  // Real-time listener for subcollection messages
  useEffect(() => {
    if (!visible || !conversation) return;

    if (db) {
      const messagesRef = collection(
        db,
        "conversations",
        conversation.id,
        "messages"
      );
      const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const list: ChatMessage[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ChatMessage, "id">),
          }));
          setMessages(list);
        },
        (error) => {
          console.warn("Error listening to chat messages:", error);
        }
      );

      return () => unsubscribe();
    } else {
      // Demo / Mock messages when Firebase is offline
      setMessages([
        {
          id: "m1",
          senderId: otherUserId || "seller",
          senderName: otherUserName,
          text: `Hi! Thanks for asking about "${conversation.listingTitle}". Is there anything you'd like to know?`,
          createdAt: Date.now() - 60000,
        },
      ]);
    }
  }, [visible, conversation, otherUserId, otherUserName]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !conversation) return;

    setInputText("");

    const newMsg: ChatMessage = {
      id: "temp_" + Date.now(),
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      createdAt: Date.now(),
    };

    if (db) {
      try {
        const messagesRef = collection(
          db,
          "conversations",
          conversation.id,
          "messages"
        );
        await addDoc(messagesRef, {
          senderId: currentUserId,
          senderName: currentUserName,
          text,
          createdAt: serverTimestamp(),
        });

        // Update conversation summary
        const convRef = doc(db, "conversations", conversation.id);
        await updateDoc(convRef, {
          lastMessage: text,
          lastSenderId: currentUserId,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Failed to send message:", error);
      }
    } else {
      // Offline / Demo state update
      setMessages((prev) => [...prev, newMsg]);
    }
  };

  if (!conversation) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeContainer}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={onClose}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{otherUserName}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Re: {conversation.listingTitle}
              </Text>
            </View>
            {conversation.listingImage ? (
              <Image
                source={{ uri: conversation.listingImage }}
                style={styles.headerImage}
              />
            ) : null}
          </View>

          {/* Chat Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.senderId === currentUserId;
              return (
                <View
                  style={[
                    styles.bubbleContainer,
                    isMe ? styles.bubbleRight : styles.bubbleLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isMe ? styles.bubbleMe : styles.bubbleOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isMe ? styles.messageTextMe : styles.messageTextOther,
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>
                    {isMe ? "You" : item.senderName}
                  </Text>
                </View>
              );
            }}
          />

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#87918C"
              style={styles.textInput}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <Pressable
              onPress={handleSendMessage}
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#F8F8F4",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8F8F4",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE5",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backText: {
    fontSize: 24,
    color: "#173C34",
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#173C34",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#65766D",
    marginTop: 2,
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 10,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleContainer: {
    marginVertical: 6,
    maxWidth: "80%",
  },
  bubbleRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: "#1F5D4C",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E6DF",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: "#FFF",
  },
  messageTextOther: {
    color: "#173C34",
  },
  timeText: {
    fontSize: 10,
    color: "#87918C",
    marginTop: 4,
    marginHorizontal: 4,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EBE5",
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#F4F6F2",
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#173C34",
  },
  sendButton: {
    backgroundColor: "#1F5D4C",
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
