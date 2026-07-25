package com.lovohcreate.xircle;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final String ACTION_OPEN_CALL = "OPEN_CALL";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

                String roomId = callData.getString("roomId");
                String callId = callData.getString("callId");
                String type = callData.getString("type");
                String callerName = callData.getString("callerName");

                String url = "/call/" + roomId + "?autoJoin=true";

                // Inject call data into the web app
                new Handler().postDelayed(() -> {
                    if (bridge != null && bridge.getWebView() != null) {
                        try {
                            JSONObject json = new JSONObject();
                            for (String key : callData.keySet()) {
                                json.put(key, callData.getString(key));
                            }
                            String js = "window.__callDataFromPush = " + json.toString() + ";";
                            bridge.getWebView().evaluateJavascript(js, null);
                            String eventJs = "window.dispatchEvent(new CustomEvent('call-push-received', { detail: window.__callDataFromPush }));";
                            bridge.getWebView().evaluateJavascript(eventJs, null);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }, 500);

                loadUrl(url);
            }
        }
    }

    private void loadUrl(String url) {
        if (bridge != null && bridge.getWebView() != null) {
            String fullUrl = bridge.getWebView().getUrl();
            if (fullUrl == null) {
                // Fallback: use your production URL or localhost for dev
                fullUrl = "https://xircle.onrender.com"; // 🔁 Replace with your actual URL
            }
            int idx = fullUrl.indexOf("?");
            if (idx != -1) fullUrl = fullUrl.substring(0, idx);
            String newUrl = fullUrl + url;
            bridge.getWebView().loadUrl(newUrl);
        }
    }
}