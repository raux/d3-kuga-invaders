const FIREBASE_ENV_FIELDS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  databaseId: 'VITE_FIREBASE_DATABASE_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

export function getFirebaseConfiguration(environment = import.meta.env) {
  const config = Object.fromEntries(
    Object.entries(FIREBASE_ENV_FIELDS)
      .map(([field, environmentKey]) => [field, environment[environmentKey]?.trim() || '']),
  );
  const missing = Object.entries(FIREBASE_ENV_FIELDS)
    .filter(([field]) => !config[field])
    .map(([, environmentKey]) => environmentKey);

  return {
    config,
    isConfigured: missing.length === 0,
    missing,
  };
}
