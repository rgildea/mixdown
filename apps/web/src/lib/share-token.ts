/** Shape of a share-link token (matches the share_links.token check constraint). */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
