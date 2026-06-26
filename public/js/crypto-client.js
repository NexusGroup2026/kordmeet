// CryptoClient — E2EE usando NaCl/libsodium via tweetnacl
const CryptoClient = (() => {
  let keyPair = null;
  const sharedSecrets = {};
  const nonceCounter = {};

  async function init() {
    keyPair = nacl.box.keyPair();
    return naclUtil.encodeBase64(keyPair.publicKey);
  }

  function getPublicKeyB64() {
    return naclUtil.encodeBase64(keyPair.publicKey);
  }

  function computeSharedSecret(theirPublicKeyB64, userId) {
    const theirPK = naclUtil.decodeBase64(theirPublicKeyB64);
    const shared = nacl.box.before(theirPK, keyPair.secretKey);
    sharedSecrets[userId] = shared;
    nonceCounter[userId] = 0;
  }

  function encrypt(plaintext, userId) {
    if (!sharedSecrets[userId]) return plaintext;
    const nonce = new Uint8Array(24);
    const counter = nonceCounter[userId]++;
    nonce[0] = counter & 0xFF;
    nonce[1] = (counter >> 8) & 0xFF;
    const messageBytes = naclUtil.decodeUTF8(plaintext);
    const encrypted = nacl.box.after(messageBytes, nonce, sharedSecrets[userId]);
    return naclUtil.encodeBase64(encrypted);
  }

  function decrypt(ciphertextB64, userId) {
    if (!sharedSecrets[userId]) return ciphertextB64;
    const nonce = new Uint8Array(24);
    const encrypted = naclUtil.decodeBase64(ciphertextB64);
    const decrypted = nacl.box.open.after(encrypted, nonce, sharedSecrets[userId]);
    if (!decrypted) return '[Mensagem criptografada — chave inválida]';
    return naclUtil.encodeUTF8(decrypted);
  }

  function hasKeyFor(userId) {
    return !!sharedSecrets[userId];
  }

  return { init, getPublicKeyB64, computeSharedSecret, encrypt, decrypt, hasKeyFor };
})();