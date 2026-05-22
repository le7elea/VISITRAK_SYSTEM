const USER_STORAGE_KEY = "user";
const OFFICE_USER_STORAGE_KEY = "officeUser";
const AUTH_TOKEN_STORAGE_KEY = "authToken";

const getSessionStorage = () =>
  typeof window !== "undefined" ? window.sessionStorage : null;

const getLocalStorage = () =>
  typeof window !== "undefined" ? window.localStorage : null;

export const getStoredUser = () => {
  const session = getSessionStorage();
  const local = getLocalStorage();
  return session?.getItem(USER_STORAGE_KEY) || local?.getItem(USER_STORAGE_KEY) || null;
};

export const setStoredUser = (userData) => {
  const session = getSessionStorage();
  const local = getLocalStorage();
  const serializedUser = JSON.stringify(userData);

  session?.setItem(USER_STORAGE_KEY, serializedUser);
  local?.removeItem(USER_STORAGE_KEY);
};

export const clearStoredSession = () => {
  const session = getSessionStorage();
  const local = getLocalStorage();

  [USER_STORAGE_KEY, OFFICE_USER_STORAGE_KEY, AUTH_TOKEN_STORAGE_KEY].forEach((key) => {
    session?.removeItem(key);
    local?.removeItem(key);
  });
};

export const setStoredOfficeSession = (officeUser) => {
  const session = getSessionStorage();
  const local = getLocalStorage();

  session?.setItem(OFFICE_USER_STORAGE_KEY, JSON.stringify(officeUser));
  session?.setItem(AUTH_TOKEN_STORAGE_KEY, "authenticated");
  local?.removeItem(OFFICE_USER_STORAGE_KEY);
  local?.removeItem(AUTH_TOKEN_STORAGE_KEY);
};
