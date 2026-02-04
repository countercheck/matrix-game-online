import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Use UPLOADS_DIR env var for Railway volume, fallback to local uploads folder
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = getExtensionFromMime(file.mimetype);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// File filter - only accept images
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Map MIME type to file extension
const getExtensionFromMime = (mimetype: string): string => {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return mimeMap[mimetype] || '.jpg';
};

// Configure multer
const parsedMaxFileSize = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10);
const maxFileSize = Number.isFinite(parsedMaxFileSize) && parsedMaxFileSize > 0 ? parsedMaxFileSize : 5242880; // 5MB default

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});
