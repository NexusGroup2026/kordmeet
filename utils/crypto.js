const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    secretKey: naclUtil.encodeBase64(keyPair.secretKey)
  };
}

function deriveSharedSecret(theirPublicKeyB64, mySecretKeyB64) {
  const theirPK = naclUtil.decodeBase64(theirPublicKeyB64);
  const mySK = naclUtil.decodeBase64(mySecretKeyB64);
  return naclUtil.encodeBase64(nacl.box.before(theirPK, mySK));
}

module.exports = { generateKeyPair, deriveSharedSecret };