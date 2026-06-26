# Changelog - Kord

All notable changes to this project will be documented in this file.

## [2.4.0] - 2026-06-25

### Added
- **AI News Auto-Update Channel**: New channel that automatically fetches and displays latest AI news from multiple RSS sources (TechCrunch AI, VentureBeat AI, The Verge AI). Updates every 6 hours, shows only today's news.
- **NVIDIA AI API Integration**: Efficient token usage with NVIDIA's API for AI features
- **Voice Call Screen Share Fullscreen Fix**: Cursor duplication bug when screen sharing in fullscreen mode has been fixed
- **Voice Call Button Fix**: "Entrar na Call" button now properly hides when user is already in a call
- **Auto-Error Reporting**: Unhandled JavaScript errors are automatically captured and stored in Firebase for developer review
- **DisplayName Sync**: User's Firebase Auth displayName and photoURL are now saved to Realtime Database for proper call member identification

### Changed
- **Firebase Migration**: Complete migration to Kakaxicenter Firebase project with improved configuration
- **Firebase Security Rules**: Significantly strengthened security rules for all database paths
- **Error Handling**: Improved user-friendly error messages in Portuguese

### Security
- Firebase Realtime Database rules now enforce strict access controls
- Users can only access their own data
- Rate limiting on write operations
- Data validation on all write operations
- No admin access from client-side code

---

## [2.3.0] - 2026-06-24

### Added
- WebRTC P2P voice/video calls
- Screen sharing functionality
- Multi-server support with roles and permissions
- AI Tools integration
- Real-time presence indicators
- Typing indicators
- Message reactions

### Changed
- Improved connection stability
- Optimized token usage for AI features
- Enhanced mobile responsiveness

---

## [2.2.0] - 2026-06-15

### Added
- Direct messages with end-to-end encryption concept
- Group creation and management
- Server customization (icon, banner, name)
- Channel categories

### Changed
- Refactored Firebase structure for better scalability
- Improved message loading performance

---

## [2.1.0] - 2026-06-10

### Added
- User profiles with avatars
- Online/offline status
- Notification settings
- Dark/Light theme support

### Fixed
- Various UI bugs
- Login state persistence

---

## [2.0.0] - 2026-06-05

### Added
- Complete rewrite with Firebase backend
- Real-time messaging
- Voice channels concept
- File sharing

---

## [1.0.0] - 2026-05-01

### Added
- Initial release
- Basic chat interface
- User authentication