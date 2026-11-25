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
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityNr;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoWcdma;
import android.telephony.CellSignalStrengthNr;
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

    private int earfcnToMhz(int earfcn) {
        if (earfcn >= 0 && earfcn <= 599) return 2110 + (int)((earfcn - 0) * 0.1);
        if (earfcn >= 1200 && earfcn <= 1949) return 1805 + (int)((earfcn - 1200) * 0.1);
        if (earfcn >= 2400 && earfcn <= 2649) return 869 + (int)((earfcn - 2400) * 0.1);
        if (earfcn >= 2750 && earfcn <= 3449) return 2620 + (int)((earfcn - 2750) * 0.1);
        if (earfcn >= 3450 && earfcn <= 3799) return 925 + (int)((earfcn - 3450) * 0.1);
        if (earfcn >= 6150 && earfcn <= 6449) return 791 + (int)((earfcn - 6150) * 0.1);
        if (earfcn >= 9210 && earfcn <= 9659) return 758 + (int)((earfcn - 9210) * 0.1);
        return 1800;
    }

    private String earfcnToBand(int earfcn) {
        if (earfcn <= 599) return "LTE B1 (2100 MHz)";
        if (earfcn >= 1200 && earfcn <= 1949) return "LTE B3 (1800 MHz)";
        if (earfcn >= 2400 && earfcn <= 2649) return "LTE B5 (850 MHz)";
        if (earfcn >= 2750 && earfcn <= 3449) return "LTE B7 (2600 MHz)";
        if (earfcn >= 3450 && earfcn <= 3799) return "LTE B8 (900 MHz)";
        if (earfcn >= 6150 && earfcn <= 6449) return "LTE B20 (800 MHz)";
        if (earfcn >= 9210 && earfcn <= 9659) return "LTE B28 (700 MHz)";
        return "LTE EARFCN " + earfcn;
    }

    @JavascriptInterface
    public String getTelemetryJson() {
        JSONObject root = new JSONObject();
        JSONArray cellList = new JSONArray();
        try {
            root.put("mode", "CELL");
            root.put("dbm", -87);
            root.put("sinr", 8);
            root.put("freqMhz", 1800);
            root.put("band", "Auto");
            root.put("carrier", "Operadora");
            root.put("pci", 0);
            root.put("tac", 0);
            root.put("ci", 0);

            WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wm.isWifiEnabled()) {
                WifiInfo info = wm.getConnectionInfo();
                if (info != null && info.getRssi() != -127 && info.getNetworkId() != -1) {
                    root.put("mode", "WIFI");
                    root.put("dbm", info.getRssi());
                    int freq = info.getFrequency();
                    root.put("freqMhz", freq);
                    root.put("band", freq >= 4900 ? "Wi-Fi 5 GHz" : "Wi-Fi 2.4 GHz");
                    root.put("carrier", info.getSSID() != null ? info.getSSID().replace("\"", "") : "Wi-Fi");
                }
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    List<ScanResult> results = wm.getScanResults();
                    JSONArray wifiArr = new JSONArray();
                    if (results != null) {
                        for (int i = 0; i < Math.min(results.size(), 12); i++) {
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
                    String op = tm.getNetworkOperatorName();
                    if (op != null && !op.isEmpty() && !"WIFI".equals(root.optString("mode"))) {
                        root.put("carrier", op);
                    }
                    List<CellInfo> cells = tm.getAllCellInfo();
                    if (cells != null) {
                        for (CellInfo ci : cells) {
                            JSONObject cObj = new JSONObject();
                            cObj.put("registered", ci.isRegistered());
                            if (ci instanceof CellInfoLte) {
                                CellInfoLte lte = (CellInfoLte) ci;
                                CellIdentityLte id = lte.getCellIdentity();
                                int dbm = lte.getCellSignalStrength().getDbm();
                                int earfcn = Build.VERSION.SDK_INT >= 24 ? id.getEarfcn() : 1800;
                                int mhz = earfcnToMhz(earfcn);
                                String band = earfcnToBand(earfcn);
                                int sinr = Build.VERSION.SDK_INT >= 26 ? lte.getCellSignalStrength().getRssnr() : 8;
                                if (sinr == Integer.MAX_VALUE) sinr = 8;
                                cObj.put("tech", "4G LTE");
                                cObj.put("dbm", dbm);
                                cObj.put("pci", id.getPci());
                                cObj.put("tac", id.getTac());
                                cObj.put("band", band);
                                cObj.put("freqMhz", mhz);
                                cellList.put(cObj);
                                if (ci.isRegistered() && !"WIFI".equals(root.optString("mode"))) {
                                    root.put("mode", "LTE");
                                    root.put("dbm", dbm);
                                    root.put("sinr", sinr);
                                    root.put("freqMhz", mhz);
                                    root.put("band", band);
                                    root.put("pci", id.getPci());
                                    root.put("tac", id.getTac());
                                    root.put("ci", id.getCi());
                                }
                            } else if (Build.VERSION.SDK_INT >= 29 && ci instanceof CellInfoNr) {
                                CellInfoNr nr = (CellInfoNr) ci;
                                CellIdentityNr id = (CellIdentityNr) nr.getCellIdentity();
                                CellSignalStrengthNr ss = (CellSignalStrengthNr) nr.getCellSignalStrength();
                                int dbm = ss.getDbm();
                                int sinr = ss.getSsSinr() != Integer.MAX_VALUE ? ss.getSsSinr() : 12;
                                cObj.put("tech", "5G NR");
                                cObj.put("dbm", dbm);
                                cObj.put("pci", id.getPci());
                                cObj.put("tac", id.getTac());
                                cObj.put("band", "5G NR n" + id.getNrarfcn());
                                cObj.put("freqMhz", 3500);
                                cellList.put(cObj);
                                if (ci.isRegistered() && dbm != Integer.MAX_VALUE && !"WIFI".equals(root.optString("mode"))) {
                                    root.put("mode", "5G NR");
                                    root.put("dbm", dbm);
                                    root.put("sinr", sinr);
                                    root.put("freqMhz", 3500);
                                    root.put("band", "5G NR (" + id.getNrarfcn() + ")");
                                    root.put("pci", id.getPci());
                                    root.put("tac", id.getTac());
                                }
                            } else if (ci instanceof CellInfoWcdma) {
                                CellInfoWcdma w = (CellInfoWcdma) ci;
                                CellIdentityWcdma id = w.getCellIdentity();
                                int dbm = w.getCellSignalStrength().getDbm();
                                cObj.put("tech", "3G WCDMA");
                                cObj.put("dbm", dbm);
                                cObj.put("pci", id.getPsc());
                                cObj.put("tac", id.getLac());
                                cObj.put("band", "3G UARFCN " + (Build.VERSION.SDK_INT >= 24 ? id.getUarfcn() : 900));
                                cObj.put("freqMhz", 900);
                                cellList.put(cObj);
                                if (ci.isRegistered() && !"WIFI".equals(root.optString("mode"))) {
                                    root.put("mode", "3G");
                                    root.put("dbm", dbm);
                                    root.put("freqMhz", 900);
                                    root.put("band", "3G WCDMA (900 MHz)");
                                    root.put("pci", id.getPsc());
                                    root.put("tac", id.getLac());
                                    root.put("ci", id.getCid());
                                }
                            } else if (ci instanceof CellInfoGsm) {
                                CellInfoGsm g = (CellInfoGsm) ci;
                                CellIdentityGsm id = g.getCellIdentity();
                                int dbm = g.getCellSignalStrength().getDbm();
                                cObj.put("tech", "2G GSM");
                                cObj.put("dbm", dbm);
                                cObj.put("pci", 0);
                                cObj.put("tac", id.getLac());
                                cObj.put("band", "2G GSM 900");
                                cObj.put("freqMhz", 900);
                                cellList.put(cObj);
                                if (ci.isRegistered() && !"WIFI".equals(root.optString("mode"))) {
                                    root.put("mode", "2G");
                                    root.put("dbm", dbm);
                                    root.put("freqMhz", 900);
                                    root.put("band", "2G GSM (900 MHz)");
                                    root.put("tac", id.getLac());
                                    root.put("ci", id.getCid());
                                }
                            }
                        }
                    }
                }
                root.put("cellList", cellList);

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
