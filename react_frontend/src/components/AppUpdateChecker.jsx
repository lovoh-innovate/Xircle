// components/AppUpdateChecker.jsx
import React, { useEffect, useState } from "react";
import {
  useGetAppVersionQuery,
  getAppDownloadUrl,
  useUpdateUserAppVersionMutation,
} from "../slices/appApiSlice";
import { useSelector } from "react-redux";
import { App as CapacitorApp } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { Download, X, AlertCircle, Loader2 } from "lucide-react";
import { useMobilePushNotifications } from "../hooks/useMobilePushNotifications";

// ─── Normalize version string ──────────────────────────────────────────
const normalizeVersion = (v) => {
  if (!v) return "";
  let str = v.replace(/^[vV]\s*/, "");
  const match = str.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : str.trim();
};

const AppUpdateChecker = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(true);
  const [isNative, setIsNative] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [versionVerified, setVersionVerified] = useState(false);
  const [updateFromLogin, setUpdateFromLogin] = useState(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(null);

  const { user, token, appUpdate } = useSelector((state) => state.auth);
  const [updateUserVersion] = useUpdateUserAppVersionMutation();
  const { isSupported } = useMobilePushNotifications();

  // ─── Debug logging ──────────────────────────────────────────────────
  useEffect(() => {
    console.log("🔍 AppUpdateChecker state:", {
      isNative,
      isLoadingVersion,
      versionVerified,
      currentVersion,
      hasToken: !!token,
      hasUpdate: !!updateFromLogin?.hasUpdate,
      isVisible,
      isFirstLaunch,
      dismissedUntil,
      updateInfo: updateFromLogin || null,
    });
  }, [
    isNative,
    isLoadingVersion,
    versionVerified,
    currentVersion,
    token,
    updateFromLogin,
    isVisible,
    isFirstLaunch,
    dismissedUntil,
  ]);

  // ─── Check for update from login response ──────────────────────────
  useEffect(() => {
    if (appUpdate?.hasUpdate && !isFirstLaunch && currentVersion) {
      const updateVer = normalizeVersion(appUpdate.version);
      const currentVer = normalizeVersion(currentVersion);
      if (updateVer !== currentVer) {
        console.log("📱 Update from login response:", appUpdate);
        setUpdateFromLogin(appUpdate);
        setIsVisible(true);
      } else {
        console.log("⏭️ Login update version matches current - ignoring");
      }
    }
  }, [appUpdate, isFirstLaunch, currentVersion]);

  // ─── Get device version on startup ──────────────────────────────────
  useEffect(() => {
    const getAppVersion = async () => {
      try {
        const isNativePlatform = window.Capacitor?.isNativePlatform();
        setIsNative(!!isNativePlatform);

        if (isNativePlatform) {
          const { Device } = await import("@capacitor/device");
          const info = await Device.getInfo();
          const rawDeviceVersion = info.appVersion;
          const normalizedDeviceVersion = normalizeVersion(rawDeviceVersion);

          const storedVersion = localStorage.getItem("appVersion");

          if (!storedVersion) {
            // FIRST LAUNCH
            console.log(
              "🆕 First launch detected! Raw:",
              rawDeviceVersion,
              "Normalized:",
              normalizedDeviceVersion,
            );
            localStorage.setItem("appVersion", normalizedDeviceVersion);
            setCurrentVersion(normalizedDeviceVersion);
            setIsFirstLaunch(true);
            setVersionVerified(true);
            setIsLoadingVersion(false);

            if (token && user?.id) {
              try {
                await updateUserVersion({
                  token,
                  version: normalizedDeviceVersion,
                }).unwrap();
                console.log("✅ Synced first launch version with backend");
              } catch (error) {
                console.error("Failed to sync version:", error);
              }
            }
            return; // EXIT - No update check for first launch
          }

          // ---- EXISTING USER ----
          console.log("📱 Existing user - raw device version:", rawDeviceVersion);
          console.log("📱 Normalized device version:", normalizedDeviceVersion);
          console.log("📱 Stored version:", storedVersion);

          let version = storedVersion;

          if (user?.appVersion) {
            const dbNorm = normalizeVersion(user.appVersion);
            if (dbNorm !== normalizeVersion(storedVersion)) {
              console.log("📱 DB version differs, using DB:", user.appVersion);
              version = dbNorm;
              localStorage.setItem("appVersion", version);
            }
          }

          setCurrentVersion(version);
          setVersionVerified(true);

          if (token && version) {
            try {
              const result = await updateUserVersion({
                token,
                version: version,
              }).unwrap();
              console.log("✅ Version verified on startup:", result);

              if (result.data?.needsUpdate) {
                const latestVersion = result.data?.updateInfo?.version;
                if (latestVersion) {
                  const normalizedLatest = normalizeVersion(latestVersion);
                  if (normalizedLatest !== version) {
                    console.log(
                      "📱 Update needed from startup check:",
                      result.data.updateInfo,
                    );
                    setUpdateFromLogin({
                      hasUpdate: true,
                      ...result.data.updateInfo,
                    });
                    setIsVisible(true);
                  } else {
                    console.log("✅ Latest version matches current - no update needed");
                  }
                }
              }
            } catch (error) {
              console.error("❌ Version verification failed:", error);
            }
          }
        } else {
          setVersionVerified(true);
        }
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersionVerified(true);
      } finally {
        setIsLoadingVersion(false);
      }
    };

    getAppVersion();
  }, [user?.appVersion, token, updateUserVersion]);

  // ─── Polling query ──────────────────────────────────────────────────
  const queryVersion = currentVersion || "0.0.0";
  const { data, isLoading, error, refetch } = useGetAppVersionQuery(
    {
      platform: "android",
      currentVersion: queryVersion,
      token: token || undefined,
    },
    {
      skip:
        !isNative ||
        isLoadingVersion ||
        !versionVerified ||
        isFirstLaunch ||
        !currentVersion,
      pollingInterval: 120000,
    }
  );

  // ─── Debug API response ─────────────────────────────────────────────
  useEffect(() => {
    if (data) {
      console.log("📡 API check response:", data);
      console.log("📡 Current version:", currentVersion);
      console.log("📡 Latest version:", data?.data?.version);
    }
    if (error) {
      console.error("❌ API check error:", error);
    }
  }, [data, error, currentVersion]);

  // ─── Push listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    let pushListener;

    const setupPushListener = async () => {
      try {
        pushListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("📩 PUSH RECEIVED:", notification);
            const payload = notification?.data || notification?.payload || {};
            if (payload.type === "APP_UPDATE") {
              console.log("🔄 APP_UPDATE push – calling refetch()");
              refetch();
            }
          },
        );
        console.log("✅ Push listener registered");
      } catch (err) {
        console.error("❌ Failed to register push listener:", err);
      }
    };

    setupPushListener();

    return () => {
      if (pushListener) {
        pushListener.remove();
        console.log("🗑️ Push listener removed");
      }
    };
  }, [isNative, refetch]);

  // ─── Resume listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    let listenerHandle;

    const setupResumeListener = async () => {
      listenerHandle = await CapacitorApp.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) {
            console.log("📱 App resumed – checking for updates");
            if (!isFirstLaunch) {
              refetch();
            }
          }
        },
      );
    };

    setupResumeListener();

    return () => {
      listenerHandle?.remove();
    };
  }, [isNative, refetch, isFirstLaunch]);

  // ─── Update from API response ───────────────────────────────────────
  useEffect(() => {
    if (
      data?.data?.hasUpdate &&
      !isLoading &&
      !isLoadingVersion &&
      versionVerified &&
      !isFirstLaunch &&
      currentVersion
    ) {
      console.log("📱 Update from API check:", data.data);

      const apiVersion = normalizeVersion(data.data.version);
      const currentVer = normalizeVersion(currentVersion);

      console.log("📱 Comparing versions - API:", apiVersion, "Current:", currentVer);

      if (apiVersion === currentVer) {
        console.log("✅ API version matches current - NO UPDATE NEEDED");
        return;
      }

      if (dismissedUntil && new Date() < new Date(dismissedUntil)) {
        console.log("⏳ Dismissed until:", dismissedUntil);
        return;
      }

      if (!updateFromLogin?.hasUpdate) {
        setUpdateFromLogin(data.data);
        setIsVisible(true);
      }
    }
  }, [
    data,
    isLoading,
    isLoadingVersion,
    versionVerified,
    updateFromLogin,
    isFirstLaunch,
    currentVersion,
    dismissedUntil,
  ]);

  // ─── Determine if we have an update ────────────────────────────────
  const hasUpdate =
    !isFirstLaunch &&
    (data?.data?.hasUpdate || updateFromLogin?.hasUpdate || false);
  const updateInfo = updateFromLogin?.hasUpdate ? updateFromLogin : data?.data;

  // ─── Download handler ──────────────────────────────────────────────
  const handleUpdateNow = async () => {
    if (!updateInfo?._id) {
      console.error("No version ID available");
      return;
    }

    setIsDownloading(true);

    try {
      const downloadUrl = getAppDownloadUrl(updateInfo._id, token);
      window.open(downloadUrl, "_system");

      if (token && user?.id) {
        try {
          await updateUserVersion({
            token,
            version: updateInfo.version,
          }).unwrap();
          console.log("✅ User version updated successfully");
        } catch (updateError) {
          console.error("❌ Failed to update version in database:", updateError);
        }
      }

      const normVersion = normalizeVersion(updateInfo.version);
      localStorage.setItem("appVersion", normVersion);
      setCurrentVersion(normVersion);

      if (!updateInfo?.isRequired) {
        setIsVisible(false);
      }
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDismiss = () => {
    if (!updateInfo?.isRequired) {
      setIsVisible(false);
    }
  };

  const handleLater = () => {
    if (!updateInfo?.isRequired) {
      const later = new Date();
      later.setHours(later.getHours() + 24);
      setDismissedUntil(later.toISOString());
      setIsVisible(false);
    }
  };

  // ─── Manual refetch (debug) ────────────────────────────────────────
  const forceCheck = () => {
    console.log("🔄 Manual refetch triggered");
    setDismissedUntil(null);
    refetch();
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (
    !isNative ||
    isLoading ||
    isLoadingVersion ||
    !versionVerified ||
    isFirstLaunch ||
    !currentVersion
  ) {
    return null;
  }

  const isDev = import.meta.env.DEV;

  return (
    <>
      {/* Debug button (only in development) */}
      {isDev && (
        <button
          onClick={forceCheck}
          className="fixed bottom-20 right-2 z-[9999] bg-teal-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg hover:bg-teal-700 transition"
        >
          Force Check
        </button>
      )}

      {/* Show current version in dev */}
      {isDev && (
        <div className="fixed bottom-28 right-2 z-[9999] bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded">
          v{currentVersion} {hasUpdate ? "🔴" : "✅"}
        </div>
      )}

      {/* Only show update banner if we have an update */}
      {hasUpdate && updateInfo && (
        <>
          {/* Desktop Banner */}
          <div className="hidden md:block fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 duration-300">
            <div
              className={`rounded-xl shadow-2xl border ${
                updateInfo.isRequired
                  ? "bg-red-50 border-red-200"
                  : "bg-white dark:bg-[#14141a] border-gray-200 dark:border-gray-700/60"
              } p-4`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    updateInfo.isRequired ? "bg-red-100" : "bg-teal-50 dark:bg-teal-900/20"
                  }`}
                >
                  {updateInfo.isRequired ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Download className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${
                      updateInfo.isRequired
                        ? "text-red-800"
                        : "text-gray-800 dark:text-white"
                    }`}
                  >
                    {updateInfo.isRequired
                      ? "Update Required"
                      : "New Update Available"}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Version {updateInfo.version} is now available.
                    {currentVersion && (
                      <span className="block text-gray-400 text-[10px] mt-0.5">
                        Your current version: v{currentVersion}
                      </span>
                    )}
                  </p>
                  {updateInfo.releaseNotes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {updateInfo.releaseNotes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleUpdateNow}
                      disabled={isDownloading}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                        updateInfo.isRequired
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
                      } ${isDownloading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Update Now</span>
                        </>
                      )}
                    </button>
                    {!updateInfo.isRequired && !isDownloading && (
                      <button
                        onClick={handleLater}
                        className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition"
                      >
                        Later
                      </button>
                    )}
                  </div>
                </div>
                {!updateInfo.isRequired && !isDownloading && (
                  <button
                    onClick={handleDismiss}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Banner */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div
              className={`rounded-t-2xl shadow-2xl border-t ${
                updateInfo.isRequired
                  ? "bg-red-50 border-red-200"
                  : "bg-white dark:bg-[#14141a] border-gray-200 dark:border-gray-700/60"
              } p-4`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    updateInfo.isRequired ? "bg-red-100" : "bg-teal-50 dark:bg-teal-900/20"
                  }`}
                >
                  {updateInfo.isRequired ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Download className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${
                      updateInfo.isRequired
                        ? "text-red-800"
                        : "text-gray-800 dark:text-white"
                    }`}
                  >
                    {updateInfo.isRequired
                      ? "Update Required"
                      : "New Update Available"}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Version {updateInfo.version} is now available.
                  </p>
                  {updateInfo.releaseNotes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {updateInfo.releaseNotes.length > 80
                        ? updateInfo.releaseNotes.slice(0, 80) + "..."
                        : updateInfo.releaseNotes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleUpdateNow}
                      disabled={isDownloading}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition ${
                        updateInfo.isRequired
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
                      } ${isDownloading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Update</span>
                        </>
                      )}
                    </button>
                    {!updateInfo.isRequired && !isDownloading && (
                      <button
                        onClick={handleLater}
                        className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition"
                      >
                        Later
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Required Update Overlay */}
          {updateInfo.isRequired && isVisible && (
            <div className="fixed inset-0 bg-black/50 z-40" />
          )}
        </>
      )}
    </>
  );
};

export default AppUpdateChecker;