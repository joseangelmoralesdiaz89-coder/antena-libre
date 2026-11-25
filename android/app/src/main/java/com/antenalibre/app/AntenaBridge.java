package com.antenalibre.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.telephony.CellInfo;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.TelephonyManager;
import android.webkit.JavascriptInterface;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;

public class AntenaBridge {
    private final Context context;

    public AntenaBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public String getTelemetryJson() {
        JSONObject root = new JSONObject();
        try {
            root.put("mode", "CELL");
            root.put("dbm", -87);
            root.put("sinr", 8);
            root.put("freqMhz", 1800);
            root.put("band", "Auto");

            WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wm.isWifiEnabled()) {
                WifiInfo info = wm.getConnectionInfo();
                if (info != null && info.getRssi() != -127) {
                    root.put("mode", "WIFI");
                    root.put("dbm", info.getRssi());
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        int freq = info.getFrequency();
                        root.put("freqMhz", freq);
                        root.put("band", freq >= 4900 ? "Wi-Fi 5 GHz" : "Wi-Fi 2.4 GHz");
                    }
                }
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    List<ScanResult> results = wm.getScanResults();
                    JSONArray wifiArr = new JSONArray();
                    if (results != null) {
                        for (int i = 0; i < Math.min(results.size(), 10); i++) {
                            ScanResult sr = results.get(i);
                            JSONObject item = new JSONObject();
                            item.put("ssid", sr.SSID);
                            item.put("rssi", sr.level);
                            item.put("freqMhz", sr.frequency);
                            wifiArr.put(item);
                        }
                    }
                    root.put("wifiList", wifiArr);
                }
            }

            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null) {
                    List<CellInfo> cells = tm.getAllCellInfo();
                    if (cells != null) {
                        for (CellInfo ci : cells) {
                            if (ci.isRegistered()) {
                                if (ci instanceof CellInfoLte) {
                                    CellInfoLte lte = (CellInfoLte) ci;
                                    root.put("mode", "LTE");
                                    root.put("dbm", lte.getCellSignalStrength().getDbm());
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                        root.put("sinr", lte.getCellSignalStrength().getRssnr());
                                    }
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                        int earfcn = lte.getCellIdentity().getEarfcn();
                                        root.put("band", "LTE EARFCN " + earfcn);
                                    }
                                    break;
                                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && ci instanceof CellInfoNr) {
                                    CellInfoNr nr = (CellInfoNr) ci;
                                    int dbm = nr.getCellSignalStrength().getDbm();
                                    if (dbm != Integer.MAX_VALUE && dbm != 0) {
                                        root.put("mode", "5G NR");
                                        root.put("dbm", dbm);
                                        root.put("band", "5G NR");
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    Location loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (loc == null) loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    if (loc != null) {
                        root.put("lat", loc.getLatitude());
                        root.put("lon", loc.getLongitude());
                    }
                }
            }
        } catch (Exception ignored) {}
        return root.toString();
    }

    @JavascriptInterface
    public void scanWifi() {
        WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            try { wm.startScan(); } catch (Exception ignored) {}
        }
    }

    @JavascriptInterface
    public void openNetworkSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void vibrateMs(long ms) {
        try {
            Vibrator vib = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vib != null && vib.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vib.vibrate(ms);
                }
            }
        } catch (Exception ignored) {}
    }
}