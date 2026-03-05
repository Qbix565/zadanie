#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <time.h>

const char* ssid = "PLAY_Swiatlowodowy_B44B";
const char* password = "$PgmKe$5Mnk2";

const int RELAY_PIN = D5;  // ZMIENIONE z D1 na D5

ESP8266WebServer server(80);

bool manualMode = false;
bool manualState = false;
bool currentRelayState = false;
String lastStatusMessage = "";
unsigned long manualStart = 0;
const unsigned long MANUAL_DURATION = 30000UL; // 30 sekund

void printStatus(String message) {
  if (message != lastStatusMessage) {
    Serial.println(message);
    lastStatusMessage = message;
  }
}

String getTimeString() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  char timeStr[9];
  strftime(timeStr, sizeof(timeStr), "%H:%M:%S", timeinfo);
  return String(timeStr);
}

bool shouldBeOn() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  
  int hour = timeinfo->tm_hour;
  int minute = timeinfo->tm_min;
  int month = timeinfo->tm_mon + 1;
  
  int offHour = (month >= 4 && month <= 10) ? 22 : 21;
  
  if (hour > offHour || (hour == offHour && minute >= 30)) {
    return false;
  }
  if (hour < 9) {
    return false;
  }
  
  return true;
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body { font-family: Arial; text-align: center; margin: 50px; }";
  html += ".button { padding: 20px 40px; font-size: 20px; margin: 10px; cursor: pointer; border-radius: 10px; border: none; }";
  html += ".on { background-color: #4CAF50; color: white; }";
  html += ".off { background-color: #f44336; color: white; }";
  html += ".auto { background-color: #2196F3; color: white; }";
  html += ".status { font-size: 24px; margin: 20px; padding: 20px; border-radius: 10px; }";
  html += ".active { background-color: #90EE90; }";
  html += ".inactive { background-color: #FFB6C1; }";
  html += "</style></head><body>";
  html += "<h1>Sterowanie Odświeżaczem</h1>";
  
  html += "<div class='status " + String(currentRelayState ? "active" : "inactive") + "'>";
  html += "<b>Status:</b> " + String(currentRelayState ? "WŁĄCZONY" : "WYŁĄCZONY");
  html += "</div>";
  
  html += "<div><b>Czas:</b> " + getTimeString() + "</div>";
  html += "<div><b>Tryb:</b> " + String(manualMode ? "MANUALNY" : "AUTOMATYCZNY") + "</div>";
  html += "<div><b>Pin D5:</b> " + String(digitalRead(RELAY_PIN) ? "HIGH" : "LOW") + "</div>";
  
  html += "<div style='margin-top: 30px;'>";
  html += "<form action='/on' method='POST'><button class='button on'>WŁĄCZ</button></form>";
  html += "<form action='/off' method='POST'><button class='button off'>WYŁĄCZ</button></form>";
  html += "<form action='/auto' method='POST'><button class='button auto'>TRYB AUTO</button></form>";
  html += "</div>";
  
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleOn() {
  manualMode = true;
  manualState = true;
  currentRelayState = true;
  manualStart = millis();
  digitalWrite(RELAY_PIN, HIGH);
  Serial.print("ZMIANA: Włączono ręcznie | Pin D5 = ");
  Serial.println(digitalRead(RELAY_PIN) ? "HIGH" : "LOW");
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleOff() {
  manualMode = true;
  manualState = false;
  currentRelayState = false;
  manualStart = millis();
  digitalWrite(RELAY_PIN, LOW);
  Serial.print("ZMIANA: Wyłączono ręcznie | Pin D5 = ");
  Serial.println(digitalRead(RELAY_PIN) ? "HIGH" : "LOW");
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleAuto() {
  manualMode = false;
  Serial.println("ZMIANA: Przełączono na tryb automatyczny");
  server.sendHeader("Location", "/");
  server.send(303);
}
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ODŚWIEŻACZ POWIETRZA ===");
  
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  currentRelayState = false;
  Serial.println("Pin D5 ustawiony jako OUTPUT");
  Serial.print("Stan początkowy D5: ");
  Serial.println(digitalRead(RELAY_PIN) ? "HIGH" : "LOW");
  
  Serial.print("Łączenie z WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi połączone!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    setenv("TZ", "CET-1CEST,M3.5.0,M10.5.0/3", 1);
    tzset();
    
    Serial.println("Synchronizacja czasu...");
    delay(3000);
    
    Serial.print("Aktualny czas: ");
    Serial.println(getTimeString());
  } else {
    Serial.println("\nBłąd połączenia WiFi!");
  }
  
  server.on("/", handleRoot);
  server.on("/on", HTTP_POST, handleOn);
  server.on("/off", HTTP_POST, handleOff);
  server.on("/auto", HTTP_POST, handleAuto);
  server.begin();
  Serial.println("Serwer WWW uruchomiony");
  
  Serial.println("=========================\n");
}

void loop() {
  server.handleClient();
  
  bool newState;

  if (manualMode && (millis() - manualStart >= MANUAL_DURATION)) {
    manualMode = false;
    Serial.println("Manualny tryb wygasł — przełączam na AUTO");
  }

  if (manualMode) {
    newState = manualState;
  } else {
    newState = shouldBeOn();
  }
  
  if (newState != currentRelayState) {
    currentRelayState = newState;
    digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
    
    String mode = manualMode ? "MANUAL" : "AUTO";
    String state = currentRelayState ? "WŁĄCZONY" : "WYŁĄCZONY";
    Serial.print("ZMIANA STANU [" + mode + "]: " + state + " | Czas: " + getTimeString());
    Serial.print(" | Pin D5 = ");
    Serial.println(digitalRead(RELAY_PIN) ? "HIGH" : "LOW");
  }
  
  delay(1000);
}