# 🎓 Campus Marketplace - Mobile App

A modern, student-centric marketplace mobile application built with **React Native**, **Expo (SDK 57)**, **TypeScript**, and **Firebase (Cloud Firestore & Authentication)** for **CSC211S2: Emerging Trends in Computer Science**.

---

## 👥 Group 8 Members & Contributions

| Member Name | Student Registration No | GitHub Username | Assigned Feature Branch | Contribution Summary |
| :--- | :--- | :--- | :--- | :--- |
| **J.S.N. Thilakasiri** | `2023/CSC/029` | `@SanduniNavodya530` | `feature/auth-and-profile` | Google OAuth lifecycle, persistent user sessions, Firestore profile provisioning (`users/{uid}`), and Profile screen. |
| **E.M.D.H. Ekanayake** | `2023/CSC/023` | `@hirushan26` | `feature/explore-and-search` | Explore feed, memoized search and category filtering engine (`useMemo`), category pills, and reusable card UI components. |
| **K.M.S.L. Wijesekara** | `2023/CSC/036` | `@shalithawijesekara117` | `feature/listing-management` | Core TypeScript interfaces (`types.ts`), Sell modal form validation, client-side `sellerId` gating, and "My Listings" dashboard with deletion. |
| **G.A.K.N.D. Jayasooriya** | `2023/CSC/025` | `@dilhara918` | `feature/chat-and-messaging` | Real-time buyer-seller chat room (`ChatRoomModal.tsx`), Firestore `conversations` and `messages` subcollection listeners, self-chat guards. |
| **H.M.S.D. Jayalal** | `2023/CSC/026` | `@dinushankha` | `feature/saved-and-security` | Saved/Favorites Firestore synchronization (`users/{uid}/saved`), Firestore Security Rules deployment, compound indexing, and QA testing. |

---

Demonstration video link - https://drive.google.com/file/d/1ZIqAYzZqHifLuWGClq-S3Z8H0ioaWvwg/view?usp=sharing

## ✨ Key Features Implemented

### 1. 🔍 Instant Search & Category Filtering
* **Client-Side Filtering**: High-performance memoized text search by title and description.
* **Category Filtering**: Fast category pills for *Textbooks*, *Tech*, *Furniture*, *Fashion*, and *All items*.
* **Instant Reset**: Clearing search parameters instantly restores the complete catalog with zero network latency.

### 2. 📦 Listing Publication & Seller Inventory
* **Publishing Flow**: Multi-field form with client validation (Title, Price, Category, Campus Location, Condition, Description, and Image URL).
* **"My Listings" Dashboard**: Filtered view querying `where('sellerId', '==', user.uid)` allowing students to manage and delete their active listings.

### 3. 💬 Real-Time Buyer/Seller Chat System
* **Real-time Messaging**: Instant bidirectional communication powered by Firestore `onSnapshot` listeners.
* **Subcollection Architecture**: `conversations/{id}/messages/{msgId}` hierarchy for efficient, lightweight data fetching.
* **Self-Contact Prevention**: Enforces business logic preventing sellers from messaging their own listings.

### 4. ❤️ Cross-Device Saved / Favorites
* **Cloud Bookmarking**: Synchronized with Firestore subcollection `users/{uid}/saved/{listingId}`.
* **Badge Indicators**: Live badge counter in the bottom navigation bar showing total saved items.

---

## 🛠️ Tech Stack & Architecture

* **Frontend Framework**: React Native (via Expo SDK 57)
* **Language**: TypeScript 6.0 (Strict mode)
* **Backend & Cloud Database**: Google Firebase 12.18.0 (Cloud Firestore NoSQL)
* **Authentication**: Firebase Authentication (Google OAuth 2.0)
* **Security**: Granular Firestore Security Rules with document ownership validation

---

## 🚀 How to Run the Project Locally

### Prerequisites
* **Node.js**: v22.13 or newer
* **Expo CLI**: `npx expo`

### Installation & Startup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hirushan26/campus-marketplace.git
   cd campus-marketplace
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start the Web Application**:
   ```bash
   npx expo start -c --web
   ```

5. **Start on Mobile (Expo Go)**:
   ```bash
   npx expo start
   ```
