import path from 'path';

/**
 * Get the uploads directory path.
 * Uses UPLOADS_DIR environment variable if set (for Railway volume mounts),
 * otherwise falls back to local uploads folder.
 */
export const getUploadsDir = (): string => {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
};
