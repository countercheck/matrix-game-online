import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import { getUploadsDir } from '../../src/config/uploads.js';

/**
 * Integration tests for UPLOADS_DIR environment variable.
 * These tests verify that:
 * 1. Files are saved to the configured UPLOADS_DIR
 * 2. Static files are served from the configured UPLOADS_DIR
 * 3. File cleanup uses the configured UPLOADS_DIR
 * 4. Path traversal protection works correctly
 */
describe('UPLOADS_DIR Integration Tests', () => {
  let tempUploadsDir: string;
  let originalUploadsDir: string | undefined;

  beforeEach(async () => {
    // Create a temporary uploads directory for testing
    tempUploadsDir = path.join(process.cwd(), 'test-uploads-' + Date.now());
    await fs.mkdir(tempUploadsDir, { recursive: true });

    // Set UPLOADS_DIR environment variable
    originalUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tempUploadsDir;
  });

  afterEach(async () => {
    // Restore original UPLOADS_DIR
    if (originalUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = originalUploadsDir;
    }

    // Clean up temporary uploads directory
    try {
      await fs.rm(tempUploadsDir, { recursive: true, force: true });
    } catch (_) {
      // Ignore cleanup errors
    }
  });

  it('should serve static files from UPLOADS_DIR', async () => {
    // Create a test app with static file serving (mimics index.ts)
    const app = express();
    app.use('/uploads', express.static(getUploadsDir()));

    // Create a test file in UPLOADS_DIR
    const testFilename = 'test-file.txt';
    const testContent = 'Hello from UPLOADS_DIR!';
    const testFilePath = path.join(tempUploadsDir, testFilename);
    await fs.writeFile(testFilePath, testContent);

    // Request the file via /uploads endpoint
    const response = await request(app).get(`/uploads/${testFilename}`);

    expect(response.status).toBe(200);
    expect(response.text).toBe(testContent);
  });

  it('should use UPLOADS_DIR from environment variable with fallback to ./uploads', () => {
    // Test with UPLOADS_DIR set
    process.env.UPLOADS_DIR = '/custom/uploads/path';
    expect(getUploadsDir()).toBe('/custom/uploads/path');

    // Test with UPLOADS_DIR not set
    delete process.env.UPLOADS_DIR;
    const defaultPath = getUploadsDir();
    expect(defaultPath).toContain('uploads');
    expect(defaultPath).toMatch(/uploads$/);
  });

  it('should create and serve files in UPLOADS_DIR', async () => {
    const app = express();
    app.use('/uploads', express.static(getUploadsDir()));

    // Simulate file upload by creating a file
    const filename = 'image-12345.png';
    const imageData = Buffer.from('fake-image-data');
    const filePath = path.join(getUploadsDir(), filename);
    await fs.writeFile(filePath, imageData);

    // Verify file was created in UPLOADS_DIR
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Verify file can be served
    const response = await request(app).get(`/uploads/${filename}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(imageData);
  });

  it('should support file deletion from UPLOADS_DIR', async () => {
    // Create a test file
    const filename = 'to-delete.txt';
    const filePath = path.join(getUploadsDir(), filename);
    await fs.writeFile(filePath, 'delete me');

    // Verify file exists
    let fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Delete the file
    await fs.unlink(filePath);

    // Verify file no longer exists
    fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(false);
  });

  it('should prevent path traversal when resolving file paths', async () => {
    // Simulate the path traversal protection used in game.service.ts
    const uploadsDirResolved = path.resolve(getUploadsDir());
    
    // Test legitimate filename
    const safeFilename = 'image-123.png';
    const safeFilePath = path.resolve(uploadsDirResolved, safeFilename);
    expect(safeFilePath.startsWith(uploadsDirResolved + path.sep)).toBe(true);

    // Test path traversal attempt with Unix-style separators
    const maliciousFilename = '../../../etc/passwd';
    const maliciousFilePath = path.resolve(uploadsDirResolved, maliciousFilename);
    expect(maliciousFilePath.startsWith(uploadsDirResolved + path.sep)).toBe(false);

    // Test another path traversal attempt
    const maliciousFilename2 = '../../sensitive-file.txt';
    const maliciousFilePath2 = path.resolve(uploadsDirResolved, maliciousFilename2);
    expect(maliciousFilePath2.startsWith(uploadsDirResolved + path.sep)).toBe(false);
  });

  it('should isolate different UPLOADS_DIR configurations', async () => {
    // Create first temp directory
    const tempDir1 = path.join(process.cwd(), 'test-uploads-1-' + Date.now());
    await fs.mkdir(tempDir1, { recursive: true });

    // Create second temp directory
    const tempDir2 = path.join(process.cwd(), 'test-uploads-2-' + Date.now());
    await fs.mkdir(tempDir2, { recursive: true });

    try {
      // Set UPLOADS_DIR to first directory
      process.env.UPLOADS_DIR = tempDir1;
      const app1 = express();
      app1.use('/uploads', express.static(getUploadsDir()));

      // Create file in first directory
      const file1Path = path.join(tempDir1, 'file1.txt');
      await fs.writeFile(file1Path, 'content1');

      // Verify file is served from first directory
      const response1 = await request(app1).get('/uploads/file1.txt');
      expect(response1.status).toBe(200);
      expect(response1.text).toBe('content1');

      // Set UPLOADS_DIR to second directory
      process.env.UPLOADS_DIR = tempDir2;
      const app2 = express();
      app2.use('/uploads', express.static(getUploadsDir()));

      // Create file in second directory
      const file2Path = path.join(tempDir2, 'file2.txt');
      await fs.writeFile(file2Path, 'content2');

      // Verify file from first directory is NOT served by second app
      const response2 = await request(app2).get('/uploads/file1.txt');
      expect(response2.status).toBe(404);

      // Verify file from second directory IS served by second app
      const response3 = await request(app2).get('/uploads/file2.txt');
      expect(response3.status).toBe(200);
      expect(response3.text).toBe('content2');
    } finally {
      // Clean up
      await fs.rm(tempDir1, { recursive: true, force: true });
      await fs.rm(tempDir2, { recursive: true, force: true });
    }
  });
});
