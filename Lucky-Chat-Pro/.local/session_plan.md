# Objective
Complete set of new features and fixes for Lucky Chat:
1. Cancel button going off-screen fix (scanning phase)
2. Profile avatar section compact with scroll (less space)
3. Level system based on chat+match stats (visible to others, Firebase cost-efficient)
4. Complete block user system (chat UI, settings danger zone, search/match filtering)
5. Gender-based suggested users (free=10 mix, paid male=50 more female, paid female=50 mix)
6. Boost Profile real-time countdown timer
7. All settings functional in real-time
8. Firebase security rules updated (Facebook-level security + block awareness)

---

# Tasks

### T001: Fix Cancel Button Off-Screen + Add Gender Field to UserProfile
- **Blocked By**: []
- **Details**:
  - In `app/(tabs)/index.tsx`, the `scanFooter` view needs `position: 'absolute'`, `bottom: insets.bottom + 20`, `left: 0`, `right: 0`, `alignItems: 'center'` so the Cancel Search button is always visible and correctly anchored inside the screen, not pushed off-screen.
  - The parent scanning phase container (`fullPhase`) needs `position: 'relative'` / `flex: 1`.
  - In `contexts/AuthContext.tsx`, add `gender?: 'male' | 'female' | 'other'` and `level?: number`, `totalChats?: number`, `totalMatches?: number`, `blockedUsers?: string[]` fields to `UserProfile` interface.
  - In `signUp()`, add defaults: `gender: ''`, `level: 1`, `totalChats: 0`, `totalMatches: 0`, `blockedUsers: []`.
  - Files: `app/(tabs)/index.tsx`, `contexts/AuthContext.tsx`
  - Acceptance: Cancel button stays on-screen during scanning; UserProfile has new fields.

### T002: Profile Avatar Section — Compact Horizontal Scroll
- **Blocked By**: [T001]
- **Details**:
  - In `app/profile.tsx`, when `activeTab === 'avatar'`, replace the full wrap-grid (`flexWrap: 'wrap'`) with a `ScrollView horizontal={false}` of fixed height (e.g., `maxHeight: 220`) wrapping a `FlatList` or a `View` with `flexDirection: 'row'`, `flexWrap: 'wrap'` inside a `ScrollView` with `style={{ maxHeight: 220 }}` so it shows 2 rows and is scrollable vertically within that box.
  - Add a gender selector row (Male / Female / Other pill chips) in the profile form section below bio, saving to Firestore on Save.
  - Files: `app/profile.tsx`
  - Acceptance: Avatar grid is compact (max 220px height, internally scrollable); gender selector visible.

### T003: Level System (Firebase Cost-Efficient)
- **Blocked By**: [T001]
- **Details**:
  - **Level calculation** (client-side, no extra queries): Based on `totalChats + totalMatches` stored on user doc.
    - Level 1 (Newbie 🌱): 0–9
    - Level 2 (Explorer 🔍): 10–29
    - Level 3 (Chatter 💬): 30–74
    - Level 4 (Social Star ⭐): 75–149
    - Level 5 (Lucky Legend 🏆): 150+
  - Create a helper function `getUserLevel(totalChats, totalMatches)` in `lib/levels.ts` returning `{ level, title, emoji, nextAt }`.
  - In `hooks/useChat.ts`: When `sendChatRequest` is accepted OR `sendMessage` is called for the first time in a new conversation, increment `totalChats` by 1 on the user's Firestore doc using `increment(1)` (single write, cheap).
  - In `hooks/useMatch.ts`: When a match is found, increment `totalMatches` by 1 on user doc.
  - Display level badge on:
    - Search user cards (show emoji + level title next to name)
    - Profile hero card (show level badge below name)
    - Settings profile card (show level badge)
  - Files: `lib/levels.ts` (new), `hooks/useChat.ts`, `hooks/useMatch.ts`, `app/profile.tsx`, `app/(tabs)/search.tsx`, `app/(tabs)/settings.tsx`, `contexts/AuthContext.tsx`
  - Acceptance: Level badge visible on profile, search cards, and settings. Increments correctly.

### T004: Block User System (Complete)
- **Blocked By**: [T001]
- **Details**:
  - **AuthContext**: Add `blockUser(targetUid)` and `unblockUser(targetUid)` functions that use `arrayUnion`/`arrayRemove` on the user's `blockedUsers` field in Firestore.
  - **Chat interface** (`app/chat/[id].tsx`): Add "Block User" option to the long-press message menu (alongside Delete Message). Also add a "Block" option in the `...` header menu (alongside Delete Chat). Show confirmation alert. After blocking, navigate back.
  - **Settings Danger Zone** (`app/(tabs)/settings.tsx`): Add a "Blocked Users" row above Logout. When pressed, open a bottom sheet modal listing blocked users (showing Avatar + displayName). Each has an "Unblock" button that calls `unblockUser()`. If no blocked users, show "No blocked users yet".
  - **Search filtering** (`app/(tabs)/search.tsx`): In `loadSuggestedUsers` and `handleSearch`, filter out users who are in `currentUser.blockedUsers` OR who have the current user in their `blockedUsers`. For the second part (others who blocked me), since we can't query other users' blockedUsers arrays efficiently, we filter the fetched results client-side: `results.filter(u => !myBlockedUsers.includes(u.uid))`. The reverse (users who blocked me) will be filtered by Firestore security rules.
  - **Random match** (`hooks/useMatch.ts`): When selecting a match from scanQueue, skip users in `blockedUsers` array.
  - **Firestore rules**: Add rule that blocked users cannot read each other's conversations.
  - Files: `contexts/AuthContext.tsx`, `app/chat/[id].tsx`, `app/(tabs)/settings.tsx`, `app/(tabs)/search.tsx`, `hooks/useMatch.ts`
  - Acceptance: Block button in chat; blocked users list in settings with unblock; blocked users filtered from search and random match.

### T005: Gender-Based Suggested Users (Free=10, Paid=50)
- **Blocked By**: [T001, T003]
- **Details**:
  - In `app/(tabs)/search.tsx`, update `loadSuggestedUsers` function:
    - Query `users` collection where `discoverable !== false` and `uid !== currentUser.uid`.
    - **Free users**: Fetch `limit(10)`, order by `createdAt desc` for variety (cheap, single query).
    - **Paid users**: Fetch `limit(50)`. If current user is male → sort results so female users appear first (client-side sort after fetch). If female → keep mix. Use `orderBy('createdAt', 'desc')` with `limit(50)` (single query, cheap).
    - Filter out blocked users client-side after fetch.
  - Files: `app/(tabs)/search.tsx`
  - Acceptance: Free users see ≤10 suggestions; paid users see up to 50; male paid users see more females first.

### T006: Boost Profile Real-Time Countdown + All Settings Functional
- **Blocked By**: [T001]
- **Details**:
  - **Boost real-time timer** in `app/(tabs)/settings.tsx`:
    - Use a `useEffect` with `setInterval(1000)` that runs when `userProfile.boostedUntil` exists and is in the future.
    - Display formatted countdown: "Boost Active — 23m 47s remaining" updating every second.
    - When timer hits 0, clear interval and show "Boost Profile" again.
  - **Push Notifications**: The toggle already saves to Firestore. Add a call to `Notifications.requestPermissionsAsync()` (from `expo-notifications`) when toggled ON so it actually requests permission on native. On web, show an info alert "Notifications are managed by your browser settings".
  - **Matches Today display**: Show actual count of today's matches from `totalMatches` or a daily counter. Keep the display as-is (already shows correctly) but ensure it reads from live `userProfile`.
  - Files: `app/(tabs)/settings.tsx`
  - Acceptance: Boost shows live countdown; push notifications toggle requests permission; all 19 settings respond and update in real-time.

### T007: Firebase Security Rules — Facebook-Level Security
- **Blocked By**: [T004]
- **Details**:
  - Update `firestore.rules`:
    - **Users collection**: 
      - Any authenticated user can read basic profile (name, avatar, bio, level, gender, isOnline) but NOT sensitive fields (email, blockedUsers, boostedUntil).
      - Only owner can update own profile.
      - Protect `isPremium`, `blockedUsers`, `totalChats`, `totalMatches` from client manipulation:
        - `isPremium` cannot be self-set to true.
        - `blockedUsers` can only use `arrayUnion`/`arrayRemove` (validated by checking list diff).
        - `totalChats` and `totalMatches` can only be incremented (not set to arbitrary value) — validated via `request.resource.data.totalChats == resource.data.totalChats + 1`.
    - **Conversations collection**:
      - Read/write only if `request.auth.uid in resource.data.participants`.
      - Add check: neither participant should be in the other's `blockedUsers` array for creating new conversations. (Use `get()` to fetch both user docs and check blocked lists.)
    - **ScanQueue collection**:
      - Can only create/update own entry (`resource.data.uid == request.auth.uid`).
      - Read limited to own entry only (not all queue entries).
    - **Messages subcollection**: Keep existing rules + add check that sender is not blocked by recipient.
  - Files: `firestore.rules`
  - Acceptance: Security rules deployed; blocked users cannot create conversations; premium cannot be self-granted; sensitive fields protected.
