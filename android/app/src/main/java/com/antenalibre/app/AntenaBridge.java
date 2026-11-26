package com.antenalibre.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.telephony.CellSignalStrength;
import android.telephony.CellSignalStrengthGsm;
import android.telephony.CellSignalStrengthLte;
import android.telephony.CellSignalStrengthNr;
import android.telephony.CellSignalStrengthWcdma;
import android.telephony.ServiceState;
import android.telephony.SignalStrength;
import android.telephony.TelephonyManager;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Vibrator;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityNr;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoWcdma;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.json.JSONObject;

public class AntenaBridge implements SensorEventListener, LocationListener {
  private static final int NA = Integer.MIN_VALUE;

  private final Activity act;
  private final TelephonyManager tm;
  private final LocationManager lm;
  private final SensorManager sm;
  private final ConnectivityManager cm;

  private WebView web;
  private volatile Location loc;
  private volatile float azimuth = -1f;
  private final float[] grav = new float[3];
  private final float[] mag = new float[3];
  private boolean haveGrav = false;
  private boolean haveMag = false;

  public AntenaBridge(Activity a) {
    act = a;
    tm = (TelephonyManager) a.getSystemService(Context.TELEPHONY_SERVICE);
    lm = (LocationManager) a.getSystemService(Context.LOCATION_SERVICE);
    sm = (SensorManager) a.getSystemService(Context.SENSOR_SERVICE);
    cm = (ConnectivityManager) a.getSystemService(Context.CONNECTIVITY_SERVICE);
  }

  // ---------- permisos ----------
  private boolean has(String p) {
    return act.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
  }

  public boolean hasAllPermissions() {
    return has(Manifest.permission.ACCESS_FINE_LOCATION) && has(Manifest.permission.READ_PHONE_STATE);
  }

  public void askPermissions() {
    act.requestPermissions(new String[] {
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.READ_PHONE_STATE }, 1);
  }

  @JavascriptInterface
  public void requestPerms() {
    act.runOnUiThread(new Runnable() {
      @Override public void run() { askPermissions(); }
    });
  }

  // ---------- ciclo de vida ----------
  public void start() {
    try {
      lm.removeUpdates(this);
      if (has(Manifest.permission.ACCESS_FINE_LOCATION)) {
        Location best = null;
        String[] provs = { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER };
        for (String p : provs) {
          try {
            Location l = lm.getLastKnownLocation(p);
            if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
          } catch (Exception ignored) { }
        }
        if (best != null && loc == null) loc = best;
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER))
          lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000L, 0f, this);
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
          lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000L, 0f, this);
      }
    } catch (Exception ignored) { }
    try {
      sm.unregisterListener(this);
      Sensor rv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
      if (rv != null) {
        sm.registerListener(this, rv, SensorManager.SENSOR_DELAY_UI);
      } else {
        Sensor ac = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        Sensor mg = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (ac != null) sm.registerListener(this, ac, SensorManager.SENSOR_DELAY_UI);
        if (mg != null) sm.registerListener(this, mg, SensorManager.SENSOR_DELAY_UI);
      }
    } catch (Exception ignored) { }
  }

  public void stop() {
    try { lm.removeUpdates(this); } catch (Exception ignored) { }
    try { sm.unregisterListener(this); } catch (Exception ignored) { }
  }

  // ---------- LocationListener ----------
  @Override public void onLocationChanged(Location l) { loc = l; }
  @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
  @Override public void onProviderEnabled(String provider) { }
  @Override public void onProviderDisabled(String provider) { }

  // ---------- SensorEventListener ----------
  @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }

  @Override
  public void onSensorChanged(SensorEvent e) {
    float[] r = new float[9];
    boolean ok = false;
    int type = e.sensor.getType();
    if (type == Sensor.TYPE_ROTATION_VECTOR) {
      float[] v = new float[] { e.values[0], e.values[1], e.values[2] };
      SensorManager.getRotationMatrixFromVector(r, v);
      ok = true;
    } else if (type == Sensor.TYPE_ACCELEROMETER) {
      System.arraycopy(e.values, 0, grav, 0, 3);
      haveGrav = true;
    } else if (type == Sensor.TYPE_MAGNETIC_FIELD) {
      System.arraycopy(e.values, 0, mag, 0, 3);
      haveMag = true;
    }
    if (!ok && haveGrav && haveMag) ok = SensorManager.getRotationMatrix(r, null, grav, mag);
    if (ok) {
      float[] o = new float[3];
      SensorManager.getOrientation(r, o);
      float deg = ((float) Math.toDegrees(o[0]) + 360f) % 360f;
      float cur = azimuth;
      if (cur < 0) {
        azimuth = deg;
      } else {
        float d = ((deg - cur + 540f) % 360f) - 180f;
        azimuth = (cur + 0.25f * d + 360f) % 360f;
      }
    }
  }

  // ---------- señal ----------
  private static int ok(int v) { return v == Integer.MAX_VALUE ? NA : v; }

  private static void put(JSONObject o, String k, int v) throws Exception {
    if (v == NA) o.put(k, JSONObject.NULL); else o.put(k, v);
  }

  private String netType() {
    try {
      int t = (Build.VERSION.SDK_INT >= 24) ? tm.getDataNetworkType() : tm.getNetworkType();
      switch (t) {
        case TelephonyManager.NETWORK_TYPE_NR: return "5G";
        case TelephonyManager.NETWORK_TYPE_LTE: return "4G LTE";
        case TelephonyManager.NETWORK_TYPE_UMTS:
        case TelephonyManager.NETWORK_TYPE_HSDPA:
        case TelephonyManager.NETWORK_TYPE_HSUPA:
        case TelephonyManager.NETWORK_TYPE_HSPA:
        case TelephonyManager.NETWORK_TYPE_HSPAP: return "3G";
        case TelephonyManager.NETWORK_TYPE_GPRS:
        case TelephonyManager.NETWORK_TYPE_EDGE: return "2G";
        case TelephonyManager.NETWORK_TYPE_UNKNOWN: return "Sin datos";
        default: return "Otra";
      }
    } catch (Exception e) {
      return "Desconocida";
    }
  }

  private String serviceState() {
    try {
      if (Build.VERSION.SDK_INT >= 26 && has(Manifest.permission.READ_PHONE_STATE)) {
        ServiceState s = tm.getServiceState();
        if (s != null) {
          switch (s.getState()) {
            case ServiceState.STATE_IN_SERVICE: return "IN_SERVICE";
            case ServiceState.STATE_OUT_OF_SERVICE: return "OUT_OF_SERVICE";
            case ServiceState.STATE_EMERGENCY_ONLY: return "EMERGENCY_ONLY";
            case ServiceState.STATE_POWER_OFF: return "POWER_OFF";
            default: break;
          }
        }
      }
    } catch (Exception ignored) { }
    return "UNKNOWN";
  }

  private NetworkCapabilities caps() {
    try {
      Network n = cm.getActiveNetwork();
      return n == null ? null : cm.getNetworkCapabilities(n);
    } catch (Exception e) {
      return null;
    }
  }

  @JavascriptInterface
  public String getSignal() {
    JSONObject o = new JSONObject();
    try {
      o.put("t", System.currentTimeMillis());
      o.put("airplane", Settings.Global.getInt(act.getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0) == 1);
      o.put("phonePerm", has(Manifest.permission.READ_PHONE_STATE));
      o.put("locPerm", has(Manifest.permission.ACCESS_FINE_LOCATION));
      String op = "";
      try { op = tm.getNetworkOperatorName(); } catch (Exception ignored) { }
      o.put("operator", op == null ? "" : op);
      o.put("net", netType());
      o.put("state", serviceState());

      NetworkCapabilities c = caps();
      o.put("wifi", c != null && c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
      o.put("internet", c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET));
      o.put("validated", c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));

      int rsrp = NA, rsrq = NA, sinr = NA, dbm = NA, level = -1;
      String tech = "";
      if (Build.VERSION.SDK_INT >= 28) {
        SignalStrength ss = tm.getSignalStrength();
        if (ss != null) {
          level = ss.getLevel();
          if (Build.VERSION.SDK_INT >= 29) {
            List<CellSignalStrength> list = ss.getCellSignalStrengths();
            for (CellSignalStrength cs : list) {
              if (cs instanceof CellSignalStrengthNr) {
                CellSignalStrengthNr n = (CellSignalStrengthNr) cs;
                int v = ok(n.getSsRsrp());
                if (v != NA) {
                  rsrp = v; rsrq = ok(n.getSsRsrq()); sinr = ok(n.getSsSinr());
                  dbm = ok(n.getDbm()); tech = "5G";
                }
              } else if (cs instanceof CellSignalStrengthLte) {
                CellSignalStrengthLte x = (CellSignalStrengthLte) cs;
                if (tech.isEmpty()) {
                  rsrp = ok(x.getRsrp()); rsrq = ok(x.getRsrq()); sinr = ok(x.getRssnr());
                  if (sinr != NA && (sinr > 40 || sinr < -30)) sinr = Math.round(sinr / 10f);
                  dbm = ok(x.getDbm()); tech = "4G";
                }
              } else if (cs instanceof CellSignalStrengthWcdma || cs instanceof CellSignalStrengthGsm) {
                if (tech.isEmpty()) {
                  dbm = ok(cs.getDbm());
                  tech = (cs instanceof CellSignalStrengthWcdma) ? "3G" : "2G";
                }
              }
            }
          }
        }
      }
      put(o, "rsrp", rsrp);
      put(o, "rsrq", rsrq);
      put(o, "sinr", sinr);
      put(o, "dbm", dbm);
      o.put("level", level);
      o.put("tech", tech);
    } catch (Exception ignored) { }
    return o.toString();
  }

  // ---------- ubicación y brújula ----------
  @JavascriptInterface
  public String getLocation() {
    JSONObject o = new JSONObject();
    try {
      Location l = loc;
      if (l != null) {
        o.put("lat", l.getLatitude());
        o.put("lon", l.getLongitude());
        o.put("acc", Math.round(l.getAccuracy()));
        o.put("age", (System.currentTimeMillis() - l.getTime()) / 1000L);
      }
    } catch (Exception ignored) { }
    return o.toString();
  }

  @JavascriptInterface
  public String getHeading() {
    JSONObject o = new JSONObject();
    try {
      float az = azimuth;
      o.put("mag", az < 0 ? -1.0 : Math.round(az * 10f) / 10.0);
      Location l = loc;
      if (l != null && az >= 0) {
        GeomagneticField gf = new GeomagneticField((float) l.getLatitude(), (float) l.getLongitude(),
            (float) l.getAltitude(), System.currentTimeMillis());
        float tn = (az + gf.getDeclination() + 360f) % 360f;
        o.put("trueN", Math.round(tn * 10f) / 10.0);
        o.put("decl", Math.round(gf.getDeclination() * 10f) / 10.0);
        o.put("hasDecl", true);
      } else {
        o.put("hasDecl", false);
      }
    } catch (Exception ignored) { }
    return o.toString();
  }

  // ---------- acciones ----------
  @JavascriptInterface
  public void openSettings(String kind) {
    final String k = kind == null ? "" : kind;
    act.runOnUiThread(new Runnable() {
      @Override public void run() {
        String a;
        if (k.equals("operator")) a = Settings.ACTION_NETWORK_OPERATOR_SETTINGS;
        else if (k.equals("airplane")) a = Settings.ACTION_AIRPLANE_MODE_SETTINGS;
        else if (k.equals("panel") && Build.VERSION.SDK_INT >= 29) a = Settings.Panel.ACTION_INTERNET_CONNECTIVITY;
        else if (k.equals("panel")) a = Settings.ACTION_WIRELESS_SETTINGS;
        else a = Settings.ACTION_DATA_ROAMING_SETTINGS;
        try {
          act.startActivity(new Intent(a));
        } catch (Exception e) {
          try { act.startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Exception ignored) { }
        }
      }
    });
  }

  @JavascriptInterface
  public void keepScreenOn(final boolean on) {
    act.runOnUiThread(new Runnable() {
      @Override public void run() {
        if (on) act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else act.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      }
    });
  }

  @JavascriptInterface
  public String saveFile(String name, String mime, String content) {
    try {
      byte[] data = content.getBytes(StandardCharsets.UTF_8);
      if (Build.VERSION.SDK_INT >= 29) {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download");
        Uri u = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (u == null) return "ERR: no se pudo crear el archivo";
        OutputStream os = act.getContentResolver().openOutputStream(u);
        try { os.write(data); } finally { os.close(); }
        return "Descargas/" + name;
      } else {
        File dir = act.getExternalFilesDir(null);
        if (dir == null) dir = act.getFilesDir();
        File f = new File(dir, name);
        FileOutputStream os = new FileOutputStream(f);
        try { os.write(data); } finally { os.close(); }
        return f.getAbsolutePath();
      }
    } catch (Exception e) {
      return "ERR: " + e.getMessage();
    }
  }

  @JavascriptInterface
  public void shareText(final String title, final String text) {
    act.runOnUiThread(new Runnable() {
      @Override public void run() {
        try {
          Intent i = new Intent(Intent.ACTION_SEND);
          i.setType("text/plain");
          i.putExtra(Intent.EXTRA_SUBJECT, title);
          i.putExtra(Intent.EXTRA_TEXT, text);
          act.startActivity(Intent.createChooser(i, title));
        } catch (Exception ignored) { }
      }
    });
  }

  public void setWebView(WebView w) { web = w; }

  private static void putI(JSONObject o, String k, int v) throws Exception {
    if (v == Integer.MAX_VALUE || v == Integer.MIN_VALUE) o.put(k, JSONObject.NULL); else o.put(k, v);
  }

  // ---------- celdas (servidora + vecinas) ----------
  @JavascriptInterface
  public String getCells() {
    JSONArray arr = new JSONArray();
    try {
      if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) return "[]";
      List<CellInfo> list = tm.getAllCellInfo();
      if (list == null) return "[]";
      for (CellInfo ci : list) {
        try {
          JSONObject o = new JSONObject();
          o.put("reg", ci.isRegistered());
          if (ci instanceof CellInfoLte) {
            CellInfoLte c = (CellInfoLte) ci;
            CellIdentityLte id = c.getCellIdentity();
            CellSignalStrengthLte ss = c.getCellSignalStrength();
            o.put("type", "LTE");
            if (Build.VERSION.SDK_INT >= 28) {
              o.put("mcc", id.getMccString()); o.put("mnc", id.getMncString());
              putI(o, "bw", id.getBandwidth());
            }
            putI(o, "tac", id.getTac()); putI(o, "ci", id.getCi()); putI(o, "pci", id.getPci());
            putI(o, "earfcn", id.getEarfcn());
            if (Build.VERSION.SDK_INT >= 30) {
              JSONArray b = new JSONArray();
              for (int x : id.getBands()) b.put(x);
              o.put("bands", b);
            }
            putI(o, "rsrp", ss.getRsrp()); putI(o, "rsrq", ss.getRsrq());
            int sn = ss.getRssnr();
            if (sn != Integer.MAX_VALUE && (sn > 40 || sn < -30)) sn = Math.round(sn / 10f);
            putI(o, "sinr", sn);
            putI(o, "ta", ss.getTimingAdvance());
          } else if (Build.VERSION.SDK_INT >= 29 && ci instanceof CellInfoNr) {
            CellInfoNr c = (CellInfoNr) ci;
            CellIdentityNr id = (CellIdentityNr) c.getCellIdentity();
            CellSignalStrengthNr ss = (CellSignalStrengthNr) c.getCellSignalStrength();
            o.put("type", "NR");
            o.put("mcc", id.getMccString()); o.put("mnc", id.getMncString());
            putI(o, "tac", id.getTac()); putI(o, "pci", id.getPci()); putI(o, "nrarfcn", id.getNrarfcn());
            long nci = id.getNci();
            if (nci != Long.MAX_VALUE) o.put("nci", nci);
            if (Build.VERSION.SDK_INT >= 30) {
              JSONArray b = new JSONArray();
              for (int x : id.getBands()) b.put(x);
              o.put("bands", b);
            }
            putI(o, "rsrp", ss.getSsRsrp()); putI(o, "rsrq", ss.getSsRsrq()); putI(o, "sinr", ss.getSsSinr());
          } else if (ci instanceof CellInfoWcdma) {
            CellInfoWcdma c = (CellInfoWcdma) ci;
            CellIdentityWcdma id = c.getCellIdentity();
            o.put("type", "WCDMA");
            if (Build.VERSION.SDK_INT >= 28) { o.put("mcc", id.getMccString()); o.put("mnc", id.getMncString()); }
            putI(o, "lac", id.getLac()); putI(o, "cid", id.getCid()); putI(o, "uarfcn", id.getUarfcn());
            putI(o, "rsrp", c.getCellSignalStrength().getDbm());
          } else if (ci instanceof CellInfoGsm) {
            CellInfoGsm c = (CellInfoGsm) ci;
            CellIdentityGsm id = c.getCellIdentity();
            o.put("type", "GSM");
            if (Build.VERSION.SDK_INT >= 28) { o.put("mcc", id.getMccString()); o.put("mnc", id.getMncString()); }
            putI(o, "lac", id.getLac()); putI(o, "cid", id.getCid()); putI(o, "arfcn", id.getArfcn());
            putI(o, "rsrp", c.getCellSignalStrength().getDbm());
          } else {
            continue;
          }
          arr.put(o);
        } catch (Exception ignored) { }
      }
    } catch (Exception ignored) { }
    return arr.toString();
  }

  // ---------- Wi-Fi ----------
  @JavascriptInterface
  public String getWifi() {
    JSONObject o = new JSONObject();
    try {
      WifiManager wm = (WifiManager) act.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      o.put("enabled", wm.isWifiEnabled());
      WifiInfo wi = wm.getConnectionInfo();
      if (wi != null && wi.getNetworkId() != -1) {
        o.put("ssid", wi.getSSID()); o.put("rssi", wi.getRssi());
        o.put("freq", wi.getFrequency()); o.put("speed", wi.getLinkSpeed());
      }
      JSONArray arr = new JSONArray();
      if (has(Manifest.permission.ACCESS_FINE_LOCATION)) {
        List<ScanResult> rs = wm.getScanResults();
        if (rs != null) {
          for (ScanResult r : rs) {
            JSONObject x = new JSONObject();
            x.put("ssid", r.SSID); x.put("rssi", r.level); x.put("freq", r.frequency); x.put("cap", r.capabilities);
            arr.put(x);
          }
        }
      }
      o.put("scan", arr);
    } catch (Exception ignored) { }
    return o.toString();
  }

  @JavascriptInterface
  public boolean startWifiScan() {
    try {
      WifiManager wm = (WifiManager) act.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      return wm.startScan();
    } catch (Exception e) { return false; }
  }

  // ---------- varios ----------
  @JavascriptInterface
  public void vibrate(int ms) {
    try {
      Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
      if (v != null) v.vibrate((long) ms);
    } catch (Exception ignored) { }
  }

  @JavascriptInterface
  public void openDialer(final String code) {
    act.runOnUiThread(new Runnable() {
      @Override public void run() {
        try { act.startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(code)))); }
        catch (Exception ignored) { }
      }
    });
  }

  // Consulta HTTPS solo a opencellid.org (ubicación de torres). Respuesta asíncrona a window.__native(id, texto)
  @JavascriptInterface
  public void fetchUrl(final String id, final String url) {
    new Thread(new Runnable() {
      @Override public void run() {
        String res;
        try {
          Uri u = Uri.parse(url);
          if (!"https".equals(u.getScheme()) || !"opencellid.org".equals(u.getHost())) throw new Exception("host");
          HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
          c.setConnectTimeout(8000); c.setReadTimeout(12000);
          c.setRequestProperty("User-Agent", "AntenaLibre/0.3");
          InputStream in = c.getInputStream();
          ByteArrayOutputStream bo = new ByteArrayOutputStream();
          byte[] b = new byte[4096]; int n;
          while ((n = in.read(b)) > 0) bo.write(b, 0, n);
          in.close();
          res = bo.toString("UTF-8");
        } catch (Exception e) {
          res = "{\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
        final String out = res;
        act.runOnUiThread(new Runnable() {
          @Override public void run() {
            if (web != null) web.evaluateJavascript("window.__native && window.__native(" + JSONObject.quote(id) + "," + JSONObject.quote(out) + ")", null);
          }
        });
      }
    }).start();
  }

  // Telemetría unificada para el módulo de tablita: señal + datos de la celda servidora
  @JavascriptInterface
  public String getTelemetryJson() {
    try {
      JSONObject o = new JSONObject(getSignal());
      o.put("source", "native");
      JSONArray cells = new JSONArray(getCells());
      String[] keys = { "type", "earfcn", "nrarfcn", "bands", "pci", "ci", "nci", "mcc", "mnc", "tac", "ta", "bw" };
      for (int i = 0; i < cells.length(); i++) {
        JSONObject c = cells.getJSONObject(i);
        if (c.optBoolean("reg", false)) {
          for (String k : keys) { if (c.has(k)) o.put(k, c.get(k)); }
          break;
        }
      }
      return o.toString();
    } catch (Exception e) {
      return "{}";
    }
  }
}
