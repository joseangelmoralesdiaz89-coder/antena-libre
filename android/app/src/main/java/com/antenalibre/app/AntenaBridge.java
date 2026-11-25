package com.antenalibre.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiManager;
import android.provider.Settings;
import android.telephony.CellInfo;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoWcdma;
import android.telephony.CellSignalStrengthLte;
import android.telephony.CellSignalStrengthNr;
import android.telephony.TelephonyManager;
import android.webkit.JavascriptInterface;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;

public class AntenaBridge {
    private final Context ctx;

    public AntenaBridge(Context ctx) {
        this.ctx = ctx;
    }

    @JavascriptInterface
    public void openNetworkSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public String getTelemetryJson() {
        JSONObject root = new JSONObject();
        int bestDbm = -95;
        int sinr = 6;
        int freqMhz = 1842;
        String band = "LTE / Móvil";
        JSONArray cellArr = new JSONArray();
        JSONArray wifiArr = new JSONArray();

        try {
            boolean hasLoc = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm != null && hasLoc) {
                List<CellInfo> infos = tm.getAllCellInfo();
                if (infos != null) {
                    for (CellInfo ci : infos) {
                        JSONObject item = new JSONObject();
                        if (ci instanceof CellInfoLte) {
                            CellSignalStrengthLte lte = ((CellInfoLte) ci).getCellSignalStrength();
                            int dbm = lte.getDbm();
                            item.put("tech", "4G LTE");
                            item.put("dbm", dbm);
                            item.put("band", "LTE");
                            cellArr.put(item);
                            if (ci.isRegistered() || dbm > bestDbm) {
                                bestDbm = dbm;
                                sinr = lte.getRssnr() != Integer.MAX_VALUE ? Math.max(-10, Math.min(30, lte.getRssnr() / 10)) : 8;
                                band = "4G LTE";
                                freqMhz = 1842;
                            }
                        } else if (android.os.Build.VERSION.SDK_INT >= 29 && ci instanceof CellInfoNr) {
                            CellSignalStrengthNr nr = (CellSignalStrengthNr) ((CellInfoNr) ci).getCellSignalStrength();
                            int dbm = nr.getDbm();
                            item.put("tech", "5G NR");
                            item.put("dbm", dbm);
                            item.put("band", "5G");
                            cellArr.put(item);
                            if (ci.isRegistered() || dbm > bestDbm) {
                                bestDbm = dbm;
                                sinr = nr.getSsSinr() != Integer.MAX_VALUE ? nr.getSsSinr() : 12;
                                band = "5G NR";
                                freqMhz = 3500;
                            }
                        } else if (ci instanceof CellInfoWcdma) {
                            int dbm = ((CellInfoWcdma) ci).getCellSignalStrength().getDbm();
                            item.put("tech", "3G");
                            item.put("dbm", dbm);
                            item.put("band", "UMTS");
                            cellArr.put(item);
                            if (ci.isRegistered() || dbm > bestDbm) {
                                bestDbm = dbm;
                                band = "3G UMTS";
                                freqMhz = 900;
                            }
                        }
                    }
                }
            }

            WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && hasLoc) {
                List<ScanResult> scans = wm.getScanResults();
                if (scans != null) {
                    for (int i = 0; i < Math.min(8, scans.size()); i++) {
                        ScanResult sr = scans.get(i);
                        JSONObject w = new JSONObject();
                        w.put("ssid", sr.SSID != null && !sr.SSID.isEmpty() ? sr.SSID : "Red oculta");
                        w.put("rssi", sr.level);
                        w.put("freqMhz", sr.frequency);
                        wifiArr.put(w);
                    }
                }
            }

            LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null && hasLoc) {
                Location loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (loc == null) loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (loc != null) {
                    root.put("lat", loc.getLatitude());
                    root.put("lon", loc.getLongitude());
                }
            }
        } catch (Exception ignored) {}

        try {
            root.put("dbm", bestDbm);
            root.put("sinr", sinr);
            root.put("freqMhz", freqMhz);
            root.put("band", band);
            root.put("cellList", cellArr);
            root.put("wifiList", wifiArr);
        } catch (Exception ignored) {}
        return root.toString();
    }
}
