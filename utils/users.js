const users = new Map();

function userJoin(socketId, peerId, username, room) {
  const user = {
    id: socketId,
    peerId: peerId || socketId,
    username: sanitize(username),
    room: sanitize(room),
    joinedAt: Date.now()
  };
  users.set(socketId, user);
  return user;
}

function getCurrentUser(socketId) {
  return users.get(socketId) || null;
}

function userLeave(socketId) {
  const user = users.get(socketId);
  if (user) {
    users.delete(socketId);
    return user;
  }
  return null;
}

function getRoomUsers(room) {
  const roomUsers = [];
  for (const user of users.values()) {
    if (user.room === room) {
      roomUsers.push({ id: user.id, peerId: user.peerId, username: user.username });
    }
  }
  return roomUsers;
}

function userExists(room, username) {
  for (const user of users.values()) {
    if (user.room === room && user.username.toLowerCase() === username.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function getAllUsers() {
  return [...users.values()];
}

function sanitize(str) {
  return String(str)
    .replace(/[<>]/g, '')
    .replace(/[&"']/g, '')
    .trim()
    .substring(0, 50);
}

module.exports = { userJoin, getCurrentUser, userLeave, getRoomUsers, userExists, getAllUsers };