import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Request } from 'express';
import { env } from '../config/env';
import { ALLOWED_MIME_TYPES } from '../constants';
import { ApiError } from '../utils/ApiError';

/** Vercel/Lambda filesystem is read-only except `/tmp`. */
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const uploadDir = isServerless
  ? path.join(os.tmpdir(), 'tvk-uploads')
  : path.join(process.cwd(), env.UPLOAD_DIR);

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  // Do not crash the whole API if uploads dir cannot be created at import time.
  console.warn('Upload directory unavailable', { uploadDir, error });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Allowed: images, PDF, text, and Word documents') as unknown as null, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
});

export const uploadAttachments = upload.array('attachments', 8);

const ASSISTANT_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES,
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const assistantFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  if (ASSISTANT_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new ApiError(
      400,
      'Invalid file type. Allowed: images, PDF, text, and Word documents'
    ) as unknown as null,
    false
  );
};

export const uploadAssistantFiles = multer({
  storage,
  fileFilter: assistantFileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
}).array('attachments', 5);
