#include <Arduino.h>
#include <FastLED.h>

#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);
IPAddress serverIP(192, 168, 178, 51);
IPAddress static_GW(192, 168, 178, 1);
IPAddress static_SN(255, 255, 255, 0);

#define NUM_LEDS 1
#define DATA_PIN 13

// Define the array of leds
CRGB leds[NUM_LEDS];
void WiFiEvent(WiFiEvent_t event)
{
  switch (event)
  {
  case SYSTEM_EVENT_STA_GOT_IP:
    //When connected set
    Serial.print("WiFi connected! IP address: ");
    Serial.println(WiFi.localIP());
    //initializes the UDP state
    //This initializes the transfer buffer
    break;
  case SYSTEM_EVENT_STA_DISCONNECTED:
    Serial.println("WiFi lost connection");
    break;
  default:
    break;
  }
}
const char *ssid = "Salami";
const char *pw = "ckqc-go05-m2kn";

void setup()
{
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);

  WiFi.config(serverIP, static_GW, static_SN);
  //register event handler
  WiFi.onEvent(WiFiEvent);

  //Initiate connection
  WiFi.begin(ssid, pw);

  server.on("/", []() {
    server.send(200, "text/plain", "hello from esp32!");
  });

  server.on("/rgb/{}/{}/{}", []() {
    String r = server.pathArg(0);
    String g = server.pathArg(1);
    String b = server.pathArg(2);
    leds[0].r = r.toInt();
    leds[0].g = g.toInt();
    leds[0].b = b.toInt();
    server.send(200, "text/plain", "worked: true");
  });

  server.on("/brightness/{}", []() {
    String brightness = server.pathArg(0);
    FastLED.setBrightness(brightness.toInt());
    server.send(200, "text/plain", "worked: true");
  });

  server.onNotFound([]() {
    Serial.println("Not found!");
    server.send(200, "text/plain", "404");
  });

  server.begin();

  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(5);
}

long previousMillis = 0;

void loop()
{
  server.handleClient();
  FastLED.delay(10);
}