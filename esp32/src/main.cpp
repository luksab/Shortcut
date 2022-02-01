#include <Arduino.h>
#include <FastLED.h>

#include <WiFi.h>
#include <WebServer.h>

#include <Preferences.h>
Preferences preferences;

WebServer server(80);
IPAddress serverIP(192, 168, 178, 52);
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

String get_hall(int num_samples)
{
  int avg = 0;
  int max = 0;
  int min = 0;
  for (size_t i = 0; i < num_samples; i++)
  {
    // hall += String(hallRead()) + "\n";
    int reading = hallRead();
    if (reading > max)
      max = reading;
    if (reading < min)
      min = reading;
    avg += hallRead();
    // ets_delay_us(10);
  }
  float res = float(avg) / float(num_samples);
  return String(res) + " " + String(min) + " " + String(max);
}

void setup()
{
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);

  preferences.begin("shortcut", false);

  // WiFi.config(serverIP, static_GW, static_SN);
  //register event handler
  WiFi.onEvent(WiFiEvent);

  //Initiate connection
  WiFi.begin(ssid, pw);

  server.on("/", []()
            { server.send(200, "text/plain", "hello from esp32!"); });

  server.on("/rgb", []()
            {
              if (server.hasArg("r"))
              {
                int r = server.arg("r").toInt();
                leds[0].r = r;
                preferences.putUChar("r", r);
              }
              if (server.hasArg("g"))
              {
                int g = server.arg("g").toInt();
                leds[0].g = g;
                preferences.putUChar("g", g);
              }
              if (server.hasArg("b"))
              {
                int b = server.arg("b").toInt();
                leds[0].b = b;
                preferences.putUChar("b", b);
              }
              server.send(200, "text/plain", String(leds[0].r) + " " + String(leds[0].g) + " " + String(leds[0].b));
            });

  server.on("/brightness", []()
            {
              if (server.hasArg("brightness"))
              {
                String brightness = server.arg("brightness");
                FastLED.setBrightness(brightness.toInt());
                server.send(200, "text/plain", "brightness set to " + brightness);
                preferences.putUChar("brightness", brightness.toInt());
              }
              server.send(200, "text/plain", "please provide a brightness value");
            });

  server.on("/hall", []()
            {
              if (server.hasArg("num_samples"))
              {
                int num_samples = server.arg("num_samples").toInt();
                String hall = get_hall(num_samples);
                server.send(200, "text/plain", hall);
              }
              else
              {
                server.send(200, "text/plain", get_hall(1000));
              }
            });

  server.onNotFound([]()
                    {
                      Serial.println("Not found!");
                      server.send(404, "text/plain", "404");
                    });

  server.begin();

  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(preferences.getUChar("brightness", 5));
  leds[0].r = preferences.getUChar("r", 0);
  leds[0].g = preferences.getUChar("g", 0);
  leds[0].b = preferences.getUChar("b", 0);
}

void loop()
{
  server.handleClient();
  // WiFi.disconnect();
  // Serial.println(get_hall(100));
  // WiFi.reconnect();
  FastLED.delay(10);
}