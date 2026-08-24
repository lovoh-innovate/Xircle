// controllers/appController.js
import AppVersion from '../models/appVersionModel.js';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { createAndSendNotification } from './notificationController.js';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../config/r2.js';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// ─── Notification helper ──────────────────────────────────────────────
async function notifyUser(userId, { title, body, data = {}, emailHtml = null }) {
  if (!userId) return;
  try {
    await createAndSendNotification({
      recipient: userId,
      title,
      body,
      data,
      sendPush: true,
      emailEventType: 'newMessage',
      emailSubject: title,
      emailHtml: emailHtml || `<p>${body}</p>`,
    });
  } catch (err) {
    console.error(`Notification to ${userId} failed:`, err.message);
  }
}

async function notifyMultipleUsers(userIds, { title, body, data = {}, emailHtml = null }) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;
  for (const userId of userIds) {
    await notifyUser(userId, { title, body, data, emailHtml });
  }
}

// ─── Public endpoints ──────────────────────────────────────────────────

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
        const user = await User.findByIdAndUpdate(decoded.id, {
          appVersion: appVersion.version,
          appVersionUpdatedAt: new Date(),
        }, { new: true });

        if (user) {
          console.log(`✅ User ${decoded.id} version updated to ${appVersion.version} on download`);
          
          // Notify user of successful update
          await notifyUser(decoded.id, {
            title: '📱 App Updated',
            body: `You've successfully updated to version ${appVersion.version}`,
            data: {
              type: 'app_update',
              version: appVersion.version,
            },
          });
        }
      } catch (error) {
        console.log('⚠️ Download token invalid, skipping version update');
      }
    }

    // ── Stream from R2 ──
    const fileName = `xircle-v${appVersion.version}.apk`;

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: appVersion.fileName,
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

// ─── Admin endpoints ──────────────────────────────────────────────────

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
      fileName: req.file.key,
      filePublicId: req.file.key,
      isRequired: isRequired === 'true' || isRequired === true,
      platform,
      uploadedBy: userId,
      isActive: true,
    });
    await appVersion.save();

    // ── Get uploader info for notification ──
    const uploader = await User.findById(userId).select('name email');
    const uploaderName = uploader?.name || 'An admin';

    // ── Notify ALL users with active tokens about the update ──
    const users = await User.find({
      'pushTokens.isActive': true,
    }).select('_id name');

    const userIds = users.map(u => u._id.toString());
    const notificationData = {
      title: `📱 New App Update v${version}`,
      body: isRequired 
        ? `Version ${version} is required. Please update to continue.`
        : `Version ${version} is now available with new features.`,
      data: {
        type: 'app_update',
        version,
        isRequired: String(isRequired),
        versionId: appVersion._id.toString(),
        releaseNotes: releaseNotes || '',
      },
      emailHtml: `
        <h2>📱 New App Update</h2>
        <p><strong>Version ${version}</strong> is now available for download.</p>
        ${isRequired ? '<p style="color:red;font-weight:bold;">⚠️ This update is required.</p>' : ''}
        ${releaseNotes ? `<p><strong>What\'s new:</strong><br/>${releaseNotes}</p>` : ''}
        <p>Click the link below to download:</p>
        <p><a href="${fileUrl}">Download v${version}</a></p>
        <hr/>
        <p style="color:#666;">Uploaded by: ${uploaderName}</p>
      `,
    };

    // Send to all users asynchronously (don't block response)
    notifyMultipleUsers(userIds, notificationData)
      .catch(err => console.error('Failed to send update notifications:', err));

    // Also send confirmation to uploader
    await notifyUser(userId, {
      title: '✅ App Uploaded Successfully',
      body: `Version ${version} has been uploaded and notifications sent to all users.`,
      data: {
        type: 'upload_confirmation',
        version,
      },
    });

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
        notificationsSent: userIds.length,
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

    const changes = {};
    if (version && version !== appVersion.version) changes.version = version;
    if (releaseNotes !== undefined && releaseNotes !== appVersion.releaseNotes) changes.releaseNotes = releaseNotes;
    if (isRequired !== undefined && isRequired !== appVersion.isRequired) changes.isRequired = isRequired;
    if (isActive !== undefined && isActive !== appVersion.isActive) changes.isActive = isActive;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    if (version) appVersion.version = version;
    if (releaseNotes !== undefined) appVersion.releaseNotes = releaseNotes;
    if (isRequired !== undefined) appVersion.isRequired = isRequired;
    if (isActive !== undefined) appVersion.isActive = isActive;
    appVersion.updatedAt = new Date();
    await appVersion.save();

    // ── Notify the admin who made the change ──
    await notifyUser(userId, {
      title: '✅ App Version Updated',
      body: `Version ${appVersion.version} has been updated successfully.`,
      data: {
        type: 'version_updated',
        versionId: appVersion._id.toString(),
        version: appVersion.version,
        changes: Object.keys(changes).join(', '),
      },
    });

    // ── If marked as required, notify users about the required update ──
    if (isRequired && changes.isRequired) {
      const users = await User.find({
        'pushTokens.isActive': true,
      }).select('_id');
      const userIds = users.map(u => u._id.toString());
      
      if (userIds.length > 0) {
        await notifyMultipleUsers(userIds, {
          title: `⚠️ Required Update: v${appVersion.version}`,
          body: `Version ${appVersion.version} is now marked as required. Please update your app immediately.`,
          data: {
            type: 'app_update',
            version: appVersion.version,
            isRequired: 'true',
            versionId: appVersion._id.toString(),
          },
          emailHtml: `
            <h2>⚠️ Required App Update</h2>
            <p><strong>Version ${appVersion.version}</strong> is now marked as required.</p>
            <p>Please update your app immediately to continue using it.</p>
            <p><a href="/app-versions">Click here to download the update</a></p>
          `,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'App version updated',
      data: appVersion,
      changes,
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

    const versionInfo = {
      version: appVersion.version,
      platform: appVersion.platform,
    };

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

    // ── Notify the admin who deleted it ──
    await notifyUser(userId, {
      title: '🗑️ App Version Deleted',
      body: `Version ${versionInfo.version} has been deleted successfully.`,
      data: {
        type: 'version_deleted',
        version: versionInfo.version,
        platform: versionInfo.platform,
      },
    });

    res.status(200).json({ 
      success: true, 
      message: 'App version deleted',
      deleted: versionInfo,
    });
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