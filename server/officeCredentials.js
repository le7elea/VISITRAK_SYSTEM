import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { Buffer } from "node:buffer";

const CREDENTIAL_ALGO = "pbkdf2-sha512";
const CREDENTIAL_ITERATIONS = 210000;
const CREDENTIAL_KEY_LENGTH = 32;
const CREDENTIAL_DIGEST = "sha512";

export const MIN_PASSWORD_LENGTH = 8;

const toBase64 = (value) => Buffer.from(value).toString("base64");
const fromBase64 = (value) => Buffer.from(String(value || ""), "base64");

export const isValidPassword = (value, minLength = MIN_PASSWORD_LENGTH) =>
  typeof value === "string" && value.trim().length >= minLength;

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Hashes the given password using the PBKDF2 algorithm
 * and returns the resulting hash along with the used salt,
 * algorithm, iterations, and key length.
 *
 * @throws {Error} If the password is empty or null.
 *
 * @param {string} password The password to hash.
 * @returns {Object} An object containing the resulting hash, salt, algorithm, iterations, and key length.
 */
/*******  cc2ab7ee-de21-470e-8f3f-190de568047c  *******/
export const hashOfficePassword = (password) => {
  const cleanPassword = String(password || "");
  if (!cleanPassword) {
    throw new Error("Password is required.");
  }

  const salt = randomBytes(16);
  const derivedKey = pbkdf2Sync(
    cleanPassword,
    salt,
    CREDENTIAL_ITERATIONS,
    CREDENTIAL_KEY_LENGTH,
    CREDENTIAL_DIGEST
  );

  return {
    credentialHash: toBase64(derivedKey),
    credentialSalt: toBase64(salt),
    credentialAlgo: CREDENTIAL_ALGO,
    credentialIterations: CREDENTIAL_ITERATIONS,
    credentialKeyLength: CREDENTIAL_KEY_LENGTH,
  };
};

export const verifyOfficePassword = (password, officeData = {}) => {
  const cleanPassword = String(password || "");
  const credentialHash = String(officeData.credentialHash || "");
  const credentialSalt = String(officeData.credentialSalt || "");

  if (!cleanPassword || !credentialHash || !credentialSalt) {
    return false;
  }

  const iterations = Number(
    officeData.credentialIterations || CREDENTIAL_ITERATIONS
  );
  const keyLength = Number(officeData.credentialKeyLength || CREDENTIAL_KEY_LENGTH);

  if (
    !Number.isFinite(iterations) ||
    iterations < 10000 ||
    !Number.isFinite(keyLength) ||
    keyLength < 16
  ) {
    return false;
  }

  try {
    const saltBuffer = fromBase64(credentialSalt);
    const storedHashBuffer = fromBase64(credentialHash);
    const derivedBuffer = pbkdf2Sync(
      cleanPassword,
      saltBuffer,
      iterations,
      storedHashBuffer.length || keyLength,
      CREDENTIAL_DIGEST
    );

    if (storedHashBuffer.length !== derivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedHashBuffer, derivedBuffer);
  } catch {
    return false;
  }
};

export const ensureAuthUser = async ({
  admin,
  uid,
  role,
  displayName = "",
  disabled = false,
  email = undefined,
  password = "",
}) => {
  const auth = admin.auth();
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) {
    throw new Error("uid is required.");
  }

  const cleanDisplayName = String(displayName || "").trim();
  const hasEmailInput = email !== undefined;
  const cleanEmail =
    typeof email === "string" ? String(email).trim().toLowerCase() : "";
  const authUpdatePayload = {
    disabled: !!disabled,
  };

  if (cleanDisplayName) authUpdatePayload.displayName = cleanDisplayName;
  if (hasEmailInput) {
    authUpdatePayload.email = cleanEmail || null;
  }

  let shouldCreateUser = false;

  try {
    await auth.updateUser(cleanUid, authUpdatePayload);
  } catch (error) {
    const errorCode = String(error?.code || "");

    if (
      hasEmailInput &&
      authUpdatePayload.email === null &&
      errorCode === "auth/invalid-email"
    ) {
      const fallbackUpdatePayload = {
        disabled: !!disabled,
      };
      if (cleanDisplayName) fallbackUpdatePayload.displayName = cleanDisplayName;
      try {
        await auth.updateUser(cleanUid, fallbackUpdatePayload);
      } catch (fallbackError) {
        const fallbackCode = String(fallbackError?.code || "");
        if (fallbackCode === "auth/user-not-found") {
          shouldCreateUser = true;
        } else {
          throw fallbackError;
        }
      }
    } else if (errorCode === "auth/user-not-found") {
      shouldCreateUser = true;
    } else {
      throw error;
    }

    if (!shouldCreateUser) {
      if (role) {
        await auth.setCustomUserClaims(cleanUid, { role });
      }
      return cleanUid;
    }

    const createPayload = {
      uid: cleanUid,
      disabled: !!disabled,
    };
    if (cleanDisplayName) createPayload.displayName = cleanDisplayName;
    if (cleanEmail) createPayload.email = cleanEmail;
    if (password) createPayload.password = String(password);

    await auth.createUser(createPayload);
  }

  if (role) {
    await auth.setCustomUserClaims(cleanUid, { role });
  }

  return cleanUid;
};
