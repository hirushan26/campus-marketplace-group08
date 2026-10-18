import { StatusBar } from "expo-status-bar";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChatRoomModal } from "./components/ChatRoomModal";
import { ExplorePage } from "./pages/ExplorePage";
import { MessagesPage } from "./pages/MessagesPage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SavedPage } from "./pages/SavedPage";
import { categories, seedListings } from "./data";
import { auth, db, firebaseConfigured } from "./firebase";
import { Conversation, Listing, Tab } from "./types";

/**
 * Slide 16: Executing First-Login User Registration
 * Provisions a safe, idempotent user profile in Firestore
 */
async function registerUser(user: User) {
  if (!db) return;
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        displayName:
          user.displayName || user.email?.split("@")[0] || "Campus student",
        email: user.email || "",
        photoURL: user.photoURL || null,
        campus: "North Campus",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Failed to register user in Firestore:", error);
    throw error;
  }
}

export default function App() {
  // Navigation & Core State
  const [tab, setTab] = useState<Tab>("Explore");
  const [items, setItems] = useState<Listing[]>(seedListings);
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState("All items");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);

  // Authentication State
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [pendingAction, setPendingAction] = useState<"sell" | "contact" | null>(null);

  // Messaging & Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);


  // Slide 15 & 17: User Authentication Lifecycle Management
  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) return;

    const handleUser = (nextUser: User | null) => {
      setUser(nextUser);
      if (nextUser) {
        registerUser(nextUser)
          .then(() => setProfileReady(true))
          .catch((error) => {
            console.warn("Error creating user profile:", error);
            setAuthError(
              error instanceof Error
                ? error.message
                : "Could not create profile."
            );
          });
      } else {
        setProfileReady(false);
        setSavedIds([]);
      }
    };

    let unsubscribe: () => void = () => undefined;
    if (Platform.OS === "web") {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => {
          unsubscribe = onAuthStateChanged(firebaseAuth, handleUser);
          return getRedirectResult(firebaseAuth);
        })
        .then((result) => {
          if (result?.user) handleUser(result.user);
        })
        .catch((error) => {
          console.warn("Auth persistence / redirect error:", error);
          setAuthError(
            error instanceof Error
              ? error.message
              : "Google sign-in could not be completed."
          );
        });
    } else {
      unsubscribe = onAuthStateChanged(firebaseAuth, handleUser);
    }

    return () => unsubscribe();
  }, []);

  // Slide 13: Establishing Firestore Real-time Sync for Listings Feed
  useEffect(() => {
    if (!db) return;
    const listingsQuery = query(
      collection(db, "listings"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      listingsQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setItems(seedListings);
        } else {
          const fetchedItems = snapshot.docs.map(
            (entry) => ({ id: entry.id, ...entry.data() }) as Listing
          );
          setItems(fetchedItems);
        }
      },
      (error) => {
        console.warn("Error fetching real-time listings from Firestore:", error);
        setItems(seedListings);
      }
    );

    return () => unsubscribe();
  }, []);

  // Slide 20 & 21: Real-time Listener for User's Active Conversations
  useEffect(() => {
    if (!db || !user) {
      // Offline / Demo conversation placeholder
      if (user) {
        setConversations([
          {
            id: "demo_conv_1",
            memberIds: [user.uid, "seller_maya"],
            memberNames: {
              [user.uid]: user.displayName || "You",
              seller_maya: "Maya R.",
            },
            listingId: "1",
            listingTitle: "Calculus: Early Transcendentals",
            listingImage:
              "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800",
            lastMessage: "Is this textbook still available for pickup?",
            updatedAt: Date.now(),
          },
        ]);
      } else {
        setConversations([]);
      }
      return;
    }

    const conversationsQuery = query(
      collection(db, "conversations"),
      where("memberIds", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const list = snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Conversation
        );
        list.sort((a, b) => {
          const aTime =
            typeof a.updatedAt === "number"
              ? a.updatedAt
              : a.updatedAt?.toMillis?.() || 0;
          const bTime =
            typeof b.updatedAt === "number"
              ? b.updatedAt
              : b.updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setConversations(list);
      },
      (error) => {
        console.warn("Error fetching conversations:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Slide 28: Sync Saved Bookmarks with Firestore
  useEffect(() => {
    if (!db || !user) return;

    const savedRef = collection(db, "users", user.uid, "saved");
    const unsubscribe = onSnapshot(
      savedRef,
      (snapshot) => {
        const ids = snapshot.docs.map((d) => d.id);
        setSavedIds(ids);
      },
      (error) => {
        console.warn("Error syncing saved items from Firestore:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Slide 14: Client-side Search & Filtering using useMemo
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat =
        category === "All items" || item.category === category;
      const matchQuery =
        item.title.toLowerCase().includes(queryText.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(queryText.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [category, items, queryText]);

  // Slide 19: My Listings filtered for active authenticated seller
  const myListings = useMemo(() => {
    return user ? items.filter((item) => item.sellerId === user.uid) : [];
  }, [items, user]);

  // Bookmark / Save toggle handler
  const toggleSaved = async (id: string) => {
    const isCurrentlySaved = savedIds.includes(id);

    // Optimistic UI state update
    setSavedIds((current) =>
      isCurrentlySaved
        ? current.filter((value) => value !== id)
        : [...current, id]
    );

    if (db && user) {
      try {
        const itemDoc = doc(db, "users", user.uid, "saved", id);
        if (isCurrentlySaved) {
          await deleteDoc(itemDoc);
        } else {
          await setDoc(itemDoc, {
            listingId: id,
            savedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.warn("Failed to update saved item in Firestore:", error);
      }
    }
  };

  // Google OAuth Login Flow + Demo Fallback
  const signInWithGoogle = async () => {
    setAuthError("");

    // If Firebase is not yet configured with API keys in .env, run demo sign-in
    if (!auth) {
      const demoUser = {
        uid: "demo_student_1",
        displayName: "Student Developer",
        email: "student@campus.edu",
        photoURL: null,
      } as unknown as User;

      setUser(demoUser);
      setProfileReady(true);
      setAuthOpen(false);

      if (pendingAction === "sell") {
        setPendingAction(null);
        setSellOpen(true);
      }
      return;
    }

    try {
      if (Platform.OS === "web") {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await registerUser(result.user);
        setUser(result.user);
        setProfileReady(true);
        setAuthOpen(false);

        if (pendingAction === "sell") {
          setPendingAction(null);
          setSellOpen(true);
        }
      } else {
        const res = await signInAnonymously(auth);
        await registerUser(res.user);
        setUser(res.user);
        setProfileReady(true);
        setAuthOpen(false);

        if (pendingAction === "sell") {
          setPendingAction(null);
          setSellOpen(true);
        }
      }
    } catch (error) {
      console.warn("Authentication error:", error);
      const code =
        error instanceof Error ? error.message : "Authentication failed.";
      if (
        Platform.OS === "web" &&
        /popup|cancelled-popup-request/i.test(code)
      ) {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirError) {
          console.warn("Sign in redirect fallback error:", redirError);
        }
      }
      if (/admin-restricted-operation/i.test(code)) {
        setAuthError(
          "Anonymous sign-in is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method."
        );
      } else {
        setAuthError(code);
      }
    }
  };

  const handleOpenSell = () => {
    if (user) {
      setSellOpen(true);
    } else {
      setPendingAction("sell");
      setAuthOpen(true);
    }
  };

  // Slide 18: Publishing Listings with Client-Side Gating
  const publish = async (
    title: string,
    price: string,
    listingCategory: string,
    campus: string,
    condition: string,
    description: string,
    imageUrl: string
  ) => {
    if (!user) {
      setSellOpen(false);
      setPendingAction("sell");
      setAuthOpen(true);
      return;
    }

    const newListingData: Omit<Listing, "id"> = {
      title,
      price: Number(price),
      category: listingCategory,
      seller: user.displayName || user.email?.split("@")[0] || "Campus Student",
      sellerId: user.uid,
      campus: campus || "North Campus",
      condition: condition || "Good condition",
      image:
        imageUrl.trim() ||
        seedListings[Math.floor(Math.random() * seedListings.length)].image,
      description: description.trim() || "No description provided.",
      createdAt: Date.now(),
    };

    if (db) {
      try {
        await addDoc(collection(db, "listings"), {
          ...newListingData,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Failed to publish listing to Firestore:", error);
        Alert.alert("Error", "Could not publish listing. Please check connection.");
      }
    } else {
      // Local fallback in demo mode
      const localListing: Listing = {
        id: "local_" + Date.now(),
        ...newListingData,
      };
      setItems((prev) => [localListing, ...prev]);
    }
    setSellOpen(false);
  };

  // Delete listing from seller inventory
  const handleDeleteListing = async (listingId: string) => {
    if (db) {
      try {
        await deleteDoc(doc(db, "listings", listingId));
      } catch (error) {
        console.warn("Failed to delete listing:", error);
        Alert.alert("Error", "Failed to delete listing.");
      }
    } else {
      setItems((prev) => prev.filter((item) => item.id !== listingId));
    }
  };

  // Slide 20: Navigate Seller Contact & Open Chat Room
  const contactSeller = async () => {
    if (!user) {
      setPendingAction("contact");
      setAuthOpen(true);
      return;
    }

    if (!selected) return;

    // Prevent contacting self
    if (selected.sellerId && selected.sellerId === user.uid) {
      Alert.alert("Self Contact", "This is your own listing!");
      return;
    }

    const sellerId = selected.sellerId || "seller_" + selected.id;
    const sellerName = selected.seller;
    const conversationId = `${user.uid}_${sellerId}_${selected.id}`.replace(
      /[.#$/\[\]]/g,
      "_"
    );

    const targetConv: Conversation = {
      id: conversationId,
      memberIds: [user.uid, sellerId],
      memberNames: {
        [user.uid]: user.displayName || "Buyer",
        [sellerId]: sellerName,
      },
      listingId: selected.id,
      listingTitle: selected.title,
      listingImage: selected.image,
      lastMessage: `Inquired about ${selected.title}`,
      lastSenderId: user.uid,
      updatedAt: Date.now(),
    };

    if (db) {
      try {
        const convRef = doc(db, "conversations", conversationId);
        await setDoc(
          convRef,
          {
            ...targetConv,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn("Error initiating conversation in Firestore:", error);
      }
    }

    setSelected(null);
    setActiveChat(targetConv);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* View Pages */}
      {tab === "Explore" && (
        <ExplorePage
          items={filteredItems}
          query={queryText}
          category={category}
          savedIds={savedIds}
          onQueryChange={setQueryText}
          onCategoryChange={setCategory}
          onSave={toggleSaved}
          onOpen={setSelected}
          onProfile={() => setTab("Profile")}
        />
      )}

      {tab === "Saved" && (
        <SavedPage
          items={items.filter((item) => savedIds.includes(item.id))}
          onSave={toggleSaved}
          onOpen={setSelected}
        />
      )}

      {tab === "Messages" && (
        <MessagesPage
          conversations={conversations}
          currentUserId={user ? user.uid : ""}
          onOpenConversation={(conv) => setActiveChat(conv)}
          onBrowse={() => setTab("Explore")}
        />
      )}

      {tab === "MyListings" && (
        <MyListingsPage
          items={myListings}
          onOpen={setSelected}
          onSell={handleOpenSell}
          onDelete={handleDeleteListing}
        />
      )}

      {tab === "Profile" && (
        <ProfilePage
          user={user}
          savedCount={savedIds.length}
          listingCount={myListings.length}
          firebaseConfigured={firebaseConfigured}
          profileReady={profileReady}
          error={authError}
          onMyListings={() =>
            user ? setTab("MyListings") : setAuthOpen(true)
          }
          onSaved={() => setTab("Saved")}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={() => {
            if (auth) {
              signOut(auth).catch((err) =>
                console.warn("Sign out error:", err)
              );
            } else {
              setUser(null);
            }
          }}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav
        tab={tab}
        savedCount={savedIds.length}
        onChange={setTab}
        onSell={handleOpenSell}
      />

      {/* Listing Detail Modal */}
      <ListingModal
        item={selected}
        user={user}
        onClose={() => setSelected(null)}
        onContact={contactSeller}
      />

      {/* Authentication Modal */}
      <AuthModal
        visible={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingAction(null);
        }}
        onSignIn={signInWithGoogle}
        error={authError}
        firebaseConfigured={firebaseConfigured}
      />

      {/* Sell Listing Modal */}
      <SellModal
        visible={sellOpen}
        onClose={() => setSellOpen(false)}
        onSubmit={publish}
      />

      {/* Real-time Chat Room Modal */}
      <ChatRoomModal
        visible={activeChat !== null}
        conversation={activeChat}
        currentUserId={user ? user.uid : "guest_user"}
        currentUserName={user?.displayName || "Student Buyer"}
        onClose={() => setActiveChat(null)}
      />
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// Component: Bottom Navigation Bar
// -------------------------------------------------------------
function BottomNav({
  tab,
  savedCount,
  onChange,
  onSell,
}: {
  tab: Tab;
  savedCount: number;
  onChange: (tab: Tab) => void;
  onSell: () => void;
}) {
  return (
    <View style={styles.nav}>
      <NavItem
        label="Explore"
        icon="⌂"
        active={tab === "Explore"}
        onPress={() => onChange("Explore")}
      />
      <NavItem
        label="Saved"
        icon="♡"
        active={tab === "Saved"}
        badge={savedCount}
        onPress={() => onChange("Saved")}
      />
      <NavItem
        label="Messages"
        icon="□"
        active={tab === "Messages"}
        onPress={() => onChange("Messages")}
      />
      <Pressable style={styles.sellButton} onPress={onSell}>
        <Text style={styles.sellPlus}>＋</Text>
        <Text style={styles.sellText}>Sell</Text>
      </Pressable>
    </View>
  );
}

function NavItem({
  label,
  icon,
  active,
  badge,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <View>
        <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
    </Pressable>
  );
}

// -------------------------------------------------------------
// Component: Listing Details Modal
// -------------------------------------------------------------
function ListingModal({
  item,
  user,
  onClose,
  onContact,
}: {
  item: Listing | null;
  user: User | null;
  onClose: () => void;
  onContact: () => void;
}) {
  if (!item) return null;

  const isMyListing = user && item.sellerId === user.uid;

  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.detail}>
          <Image source={{ uri: item.image }} style={styles.detailImage} />
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailBody}>
            <Text style={styles.detailCategory}>
              {item.category.toUpperCase()}
            </Text>
            <Text style={styles.detailTitle}>{item.title}</Text>
            <Text style={styles.detailPrice}>${item.price}</Text>
            <Text style={styles.muted}>
              {item.condition} · {item.campus} · Seller: {item.seller}
            </Text>
            <Text style={styles.description}>
              {item.description || "No extra description provided."}
            </Text>

            <Pressable
              style={[styles.primary, isMyListing && styles.disabled]}
              onPress={onContact}
              disabled={Boolean(isMyListing)}
            >
              <Text style={styles.primaryText}>
                {isMyListing
                  ? "This is your listing"
                  : user
                  ? `Message ${item.seller}`
                  : "Sign in to contact seller"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// -------------------------------------------------------------
// Component: Authentication Modal
// -------------------------------------------------------------
function AuthModal({
  visible,
  onClose,
  onSignIn,
  error,
  firebaseConfigured,
}: {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  error: string;
  firebaseConfigured: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.auth}>
          <Text style={styles.formTitle}>Campus Marketplace</Text>
          <Text style={styles.authMessage}>
            Sign in to contact campus sellers, save your favorite
            items, and publish your own listings.
          </Text>
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <Pressable style={styles.googleButton} onPress={onSignIn}>
            <Text style={styles.googleMark}>
              {Platform.OS === "web" ? "G" : "👤"}
            </Text>
            <Text style={styles.googleButtonText}>
              {Platform.OS === "web"
                ? firebaseConfigured
                  ? "Continue with Google"
                  : "Continue with Google (Demo)"
                : "Sign In as Student"}
            </Text>
          </Pressable>
          {!firebaseConfigured && (
            <Text style={styles.demoNote}>
              💡 Demo Mode active. Clicking Continue signs you in immediately as a student.
            </Text>
          )}
          <Pressable style={styles.outline} onPress={onClose}>
            <Text style={styles.outlineText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// -------------------------------------------------------------
// Component: Sell Item Modal
// -------------------------------------------------------------
function SellModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    price: string,
    category: string,
    campus: string,
    condition: string,
    description: string,
    imageUrl: string
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Textbooks");
  const [campus, setCampus] = useState("North Campus");
  const [condition, setCondition] = useState("Good condition");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const handlePublish = () => {
    if (!title.trim() || !price.trim()) return;
    onSubmit(
      title,
      price,
      selectedCategory,
      campus,
      condition,
      description,
      imageUrl
    );
    // Reset form
    setTitle("");
    setPrice("");
    setDescription("");
    setImageUrl("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Sell an Item</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formScroll}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Organic Chemistry 4th Edition"
              placeholderTextColor="#87918C"
              style={styles.field}
            />

            <Text style={styles.label}>Price ($) *</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="e.g. 45"
              placeholderTextColor="#87918C"
              style={styles.field}
            />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {categories.filter((c) => c !== "All items").map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setSelectedCategory(c)}
                  style={[
                    styles.pill,
                    selectedCategory === c && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedCategory === c && styles.pillTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Condition</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {["Brand new", "Like new", "Good condition", "Fair"].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCondition(c)}
                  style={[
                    styles.pill,
                    condition === c && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      condition === c && styles.pillTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Campus Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {["North Campus", "West Village", "East Quad"].map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => setCampus(loc)}
                  style={[
                    styles.pill,
                    campus === loc && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      campus === loc && styles.pillTextActive,
                    ]}
                  >
                    {loc}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add details about condition, meetup spots..."
              placeholderTextColor="#87918C"
              multiline
              numberOfLines={3}
              style={[styles.field, styles.textArea]}
            />

            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... or leave empty for default"
              placeholderTextColor="#87918C"
              style={styles.field}
            />

            <Pressable
              disabled={!title.trim() || !price.trim()}
              style={[
                styles.primary,
                (!title.trim() || !price.trim()) && styles.disabled,
              ]}
              onPress={handlePublish}
            >
              <Text style={styles.primaryText}>Publish Listing</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// -------------------------------------------------------------
// Stylesheet
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F4" },
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 82,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EBE5",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: { alignItems: "center", minWidth: 54 },
  navIcon: { color: "#83918A", fontSize: 22 },
  navLabel: { color: "#83918A", fontSize: 10, marginTop: 3 },
  navActive: { color: "#1D6B54", fontWeight: "700" },
  badge: {
    position: "absolute",
    right: -12,
    top: -3,
    backgroundColor: "#C3535B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  sellButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F0E6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 4,
  },
  sellPlus: { color: "#247055", fontSize: 20, fontWeight: "800" },
  sellText: { color: "#247055", fontWeight: "800", fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.45)",
    justifyContent: "flex-end",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  detail: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    overflow: "hidden",
  },
  detailScroll: {
    flexGrow: 0,
  },
  detailImage: { width: "100%", height: 230 },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeText: { color: "#173C34", fontSize: 26, lineHeight: 28 },
  detailBody: { padding: 24 },
  detailCategory: {
    color: "#23775D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  detailTitle: {
    color: "#173C34",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 8,
  },
  detailPrice: {
    color: "#1C7057",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  muted: { color: "#87918C", fontSize: 12, marginTop: 4 },
  description: {
    color: "#66736D",
    fontSize: 14,
    lineHeight: 21,
    marginVertical: 20,
  },
  primary: {
    height: 50,
    backgroundColor: "#1F5D4C",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  auth: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  form: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  formScroll: {
    paddingBottom: 20,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  formTitle: { color: "#173C34", fontSize: 22, fontWeight: "800" },
  authMessage: { color: "#87918C", lineHeight: 20, marginTop: 10 },
  authError: {
    color: "#B64950",
    backgroundColor: "#FBECEE",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    marginTop: 16,
  },
  googleButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7DDD8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 10,
  },
  googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "800" },
  googleButtonText: { color: "#173C34", fontWeight: "700" },
  demoNote: {
    fontSize: 11,
    color: "#23775D",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 15,
  },
  outline: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BCD0C3",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  outlineText: { color: "#1F5D4C", fontWeight: "800" },
  label: {
    color: "#365B4C",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 7,
  },
  field: {
    height: 48,
    borderWidth: 1,
    borderColor: "#DDE4DC",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#173C34",
    backgroundColor: "#FAFBF9",
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#ECEFE9",
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: "#1F5D4C",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64736C",
  },
  pillTextActive: {
    color: "#FFF",
  },
  disabled: { opacity: 0.45 },
});
