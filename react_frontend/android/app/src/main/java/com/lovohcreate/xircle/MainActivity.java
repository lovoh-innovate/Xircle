package com.lovohcreate.xircle;

import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final String ACTION_OPEN_CALL = "OPEN_CALL";

    // Polling config for waiting until the WebView/React app is ready
    private static final int POLL_INTERVAL_MS = 150;
    private static final int POLL_TIMEOUT_MS = 8000; // give up after 8s

    private final Handler pollHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Grant WebView permission requests (mic/camera) since we already
        // gate access with our own permission checks at the JS layer.
        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    request.grant(request.getResources());
                });
            }
        });

        // Force-release any stale audio focus this app might be holding
        // (e.g. leftover from ringtone playback or a dropped call), so the
        // mic doesn't get stuck reporting "busy" for getUserMedia().
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.abandonAudioFocus(null);
        }

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && ACTION_OPEN_CALL.equals(intent.getAction())) {
            Bundle callData = intent.getBundleExtra("callData");
            if (callData != null) {
                // Show over lock screen and turn screen on
                getWindow().addFlags(
                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                );

                try {
                    JSONObject json = new JSONObject();
                    for (String key : callData.keySet()) {
                        json.put(key, callData.getString(key));
                    }
                    dispatchWhenReady(json, System.currentTimeMillis());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    /**
     * Polls the WebView until window.__navigate exists (meaning React Router
     * and the RootLayout listeners have mounted), then dispatches the
     * 'mobile-push-tapped' event that main.jsx already listens for.
     * Falls back to dispatching anyway after POLL_TIMEOUT_MS in case
     * __navigate never appears for some reason (event listener may still
     * be registered even without navigate being set yet).
     */
    private void dispatchWhenReady(JSONObject json, long startTime) {
        if (bridge == null || bridge.getWebView() == null) {
            // Bridge not ready yet at all — retry shortly
            if (System.currentTimeMillis() - startTime < POLL_TIMEOUT_MS) {
                pollHandler.postDelayed(() -> dispatchWhenReady(json, startTime), POLL_INTERVAL_MS);
            }
            return;
        }

        String checkJs = "(typeof window.__navigate === 'function')";

        bridge.getWebView().evaluateJavascript(checkJs, result -> {
            boolean isReady = "true".equals(result);
            boolean timedOut = System.currentTimeMillis() - startTime >= POLL_TIMEOUT_MS;

            if (isReady || timedOut) {
                dispatchCallEvent(json);
            } else {
                pollHandler.postDelayed(() -> dispatchWhenReady(json, startTime), POLL_INTERVAL_MS);
            }
        });
    }

    private void dispatchCallEvent(JSONObject json) {
        if (bridge == null || bridge.getWebView() == null) return;

        // Dispatch the event main.jsx's RootLayout already listens for
        String eventJs =
                "window.dispatchEvent(new CustomEvent('mobile-push-tapped', { detail: " + json.toString() + " }));";
        bridge.getWebView().evaluateJavascript(eventJs, null);
    }
}