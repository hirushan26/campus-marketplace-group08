export interface Listing {
  id: string;
  title: string;
  price: number;
  category: string;
  seller: string;
  sellerId?: string;
  campus: string;
  condition: string;
  image: string;
  description?: string;
  createdAt?: number | any;
}

export type Tab = "Explore" | "Saved" | "Messages" | "Profile" | "MyListings";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  campus: string;
  updatedAt?: any;
}

export interface Conversation {
  id: string;
  memberIds: string[];
  memberNames: { [uid: string]: string };
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  lastMessage: string;
  lastSenderId?: string;
  updatedAt: number | any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number | any;
}
