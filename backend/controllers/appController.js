// controllers/appController.js
import AppVersion from '../models/appVersionModel.js';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { broadcastAppUpdate } from './notificationController.js';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../config/r2.js';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// ─── Public endpoints ──────────────────────────────────────────────

/**
 * GET /api/app/version
 * Public – check for updates
 */
export const getAppVersion = async (req, res) => {
  try {
    const { platform = 'android', currentVersion, token } = req.query;

    const latestVersion = await AppVersion.findOne({ platform, isActive: true })
      .sort({ createdAt: -1 });

    if (!latestVersion) {
      return res.status(200).json({
        success: true,
        data: { hasUpdate: false, message: 'No active version found' },
      });
    }

    let userVersion = currentVersion;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('appVersion');
        if (user?.appVersion) userVersion = user.appVersion;
      } catch {}
    }

    let hasUpdate = false, isRequired = false;
    if (userVersion) {
      try {
        const semver = await import('semver');
        hasUpdate = semver.gt(latestVersion.version, userVersion);
        isRequired = latestVersion.isRequired && hasUpdate;
      } catch {
        hasUpdate = latestVersion.version !== userVersion;
        isRequired = latestVersion.isRequired && hasUpdate;
      }
    } else {
      hasUpdate = true;
      isRequired = latestVersion.isRequired;
    }

    res.status(200).json({
      success: true,
      data: {
        hasUpdate,
        isRequired,
        _id: latestVersion._id,
        version: latestVersion.version,
        releaseNotes: latestVersion.releaseNotes,
        fileUrl: latestVersion.fileUrl,
        fileSize: latestVersion.fileSize,
        fileName: latestVersion.fileName,
        releasedAt: latestVersion.createdAt,
        userVersion,
      },
    });
  } catch (error) {
    console.error('getAppVersion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching app version',
      error: error.message,
    });
  }
};

/**
 * GET /api/app/version/:versionId
 * Public – get version details
 */
export const getAppVersionById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await AppVersion.findById(versionId);
    if (!version || !version.isActive) {
      return res.status(404).json({ success: false, message: 'App version not found' });
    }
    res.status(200).json({
      success: true,
      data: {
        _id: version._id,
        version: version.version,
        releaseNotes: version.releaseNotes,
        fileSize: version.fileSize,
        fileName: version.fileName,
        isRequired: version.isRequired,
        platform: version.platform,
        releasedAt: version.createdAt,
      },
    });
  } catch (error) {
    console.error('getAppVersionById error:', error);
    res.status(500).json({ success: false, message: 'Error fetching version', error: error.message });
  }
};

/**
 * GET /api/app/download/:versionId
 * Public – stream file from R2 and update user version
 */
export const downloadApp = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { token } = req.query;

    const appVersion = await AppVersion.findById(versionId);
    if (!appVersion || !appVersion.isActive) {
      return res.status(404).json({ success: false, message: 'App version not found or inactive' });
    }

    if (!appVersion.fileName) {
      return res.status(404).json({ success: false, message: 'File not found for this version' });
    }

    // ── Update user version if token provided ──
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(decoded.id, {
          appVersion: appVersion.version,
          appVersionUpdatedAt: new Date(),
        });
        console.log(`✅ User ${decoded.id} version updated to ${appVersion.version} on download`);
      } catch (error) {
        console.log('⚠️ Download token invalid, skipping version update');
      }
    }

    // ── Stream from R2 ──
    const fileName = `xircle-v${appVersion.version}.apk`;

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: appVersion.fileName, // R2 object key, stored at upload time
      });
      const r2Response = await r2Client.send(command);

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (appVersion.fileSize) res.setHeader('Content-Length', appVersion.fileSize);

      r2Response.Body.pipe(res);
      r2Response.Body.on('error', (err) => {
        console.error('R2 stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Error streaming file' });
        }
        res.end();
      });
      res.on('finish', () => console.log(`✅ Download complete: ${fileName}`));
    } catch (err) {
      console.error('R2 fetch error:', err);
      return res.status(404).json({ success: false, message: 'File not found on R2' });
    }
  } catch (error) {
    console.error('downloadApp error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error downloading app', error: error.message });
    }
  }
};

/**
 * POST /api/app/update-version
 * Public – update user's app version (login/startup)
 */
export const updateUserAppVersion = async (req, res) => {
  try {
    const { token, version } = req.body;
    if (!token || !version) {
      return res.status(400).json({ success: false, message: 'Token and version are required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { appVersion: version, appVersionUpdatedAt: new Date() },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const latestVersion = await AppVersion.findOne({ platform: 'android', isActive: true })
      .sort({ createdAt: -1 });
    let needsUpdate = false, isRequired = false, updateInfo = null;
    if (latestVersion) {
      let hasUpdate = false;
      try {
        const semver = await import('semver');
        hasUpdate = semver.gt(latestVersion.version, version);
      } catch {
        hasUpdate = latestVersion.version !== version;
      }
      if (hasUpdate) {
        needsUpdate = true;
        isRequired = latestVersion.isRequired || false;
        updateInfo = {
          _id: latestVersion._id,
          version: latestVersion.version,
          releaseNotes: latestVersion.releaseNotes,
          fileSize: latestVersion.fileSize,
          fileName: latestVersion.fileName,
          isRequired: latestVersion.isRequired,
        };
      }
    }
    res.status(200).json({
      success: true,
      data: {
        appVersion: user.appVersion,
        appVersionUpdatedAt: user.appVersionUpdatedAt,
        needsUpdate,
        isRequired,
        updateInfo,
      },
    });
  } catch (error) {
    console.error('updateUserAppVersion error:', error);
    res.status(500).json({ success: false, message: 'Error updating app version', error: error.message });
  }
};

// ─── Admin endpoints – authentication only, no role checks ──────

/**
 * POST /api/app/admin/upload
 * Any authenticated user – upload new APK/AAB (R2 storage via multer-s3)
 */
export const uploadApp = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { version, releaseNotes, isRequired = false, platform = 'android' } = req.body;
    if (!version || !req.file) {
      return res.status(400).json({ success: false, message: 'Version and APK file are required' });
    }

    const existing = await AppVersion.findOne({ version, platform });
    if (existing) {
      return res.status(400).json({ success: false, message: `Version ${version} already exists for ${platform}` });
    }

    // ── req.file.key comes from multer-s3, req.file.location is the full URL ──
    const fileUrl = `${R2_PUBLIC_URL}/${req.file.key}`;

    const appVersion = new AppVersion({
      version,
      releaseNotes: releaseNotes || '',
      fileUrl,
      fileSize: req.file.size,
      fileName: req.file.key, // R2 object key, used for download/delete
      filePublicId: req.file.key,
      isRequired: isRequired === 'true' || isRequired === true,
      platform,
      uploadedBy: userId,
      isActive: true,
    });
    await appVersion.save();

    // 🚀 Broadcast push notification
    broadcastAppUpdate({
      _id: appVersion._id,
      version: appVersion.version,
      isRequired: appVersion.isRequired,
      releaseNotes: appVersion.releaseNotes,
    }).catch(err => console.error('Push broadcast failed:', err));

    res.status(201).json({
      success: true,
      message: 'App version uploaded successfully',
      data: {
        id: appVersion._id,
        version: appVersion.version,
        platform: appVersion.platform,
        fileSize: appVersion.fileSize,
        fileUrl: appVersion.fileUrl,
        createdAt: appVersion.createdAt,
      },
    });
  } catch (error) {
    console.error('uploadApp error:', error);
    res.status(500).json({ success: false, message: 'Error uploading app', error: error.message });
  }
};

/**
 * PUT /api/app/admin/update/:versionId
 * Any authenticated user – update version metadata
 */
export const updateApp = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { versionId } = req.params;
    const { version, releaseNotes, isRequired, isActive } = req.body;

    const appVersion = await AppVersion.findById(versionId);
    if (!appVersion) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    if (version) appVersion.version = version;
    if (releaseNotes !== undefined) appVersion.releaseNotes = releaseNotes;
    if (isRequired !== undefined) appVersion.isRequired = isRequired;
    if (isActive !== undefined) appVersion.isActive = isActive;
    appVersion.updatedAt = new Date();
    await appVersion.save();

    res.status(200).json({
      success: true,
      message: 'App version updated',
      data: appVersion,
    });
  } catch (error) {
    console.error('updateApp error:', error);
    res.status(500).json({ success: false, message: 'Error updating app', error: error.message });
  }
};

/**
 * DELETE /api/app/admin/delete/:versionId
 * Any authenticated user – delete version and R2 object
 */
export const deleteApp = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { versionId } = req.params;
    const appVersion = await AppVersion.findById(versionId);
    if (!appVersion) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    // ── Delete object from R2 if exists ──
    if (appVersion.fileName) {
      try {
        await r2Client.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: appVersion.fileName,
        }));
        console.log(`🗑️ Deleted R2 object: ${appVersion.fileName}`);
      } catch (err) {
        console.error('R2 delete error:', err);
        // continue — don't block DB deletion on R2 failure
      }
    }

    await AppVersion.findByIdAndDelete(versionId);
    res.status(200).json({ success: true, message: 'App version deleted' });
  } catch (error) {
    console.error('deleteApp error:', error);
    res.status(500).json({ success: false, message: 'Error deleting app', error: error.message });
  }
};

/**
 * GET /api/app/admin/versions
 * Any authenticated user – list all versions
 */
export const getAppVersions = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { platform = 'android' } = req.query;
    const versions = await AppVersion.find({ platform }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('getAppVersions error:', error);
    res.status(500).json({ success: false, message: 'Error fetching versions', error: error.message });
  }
};