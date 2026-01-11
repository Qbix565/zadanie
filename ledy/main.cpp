#include "FastLED.h"

#define NUM_LEDS 60
#define DATA_PIN 3
#define BUTTON_PIN 4

CRGB leds[NUM_LEDS];

// State machine:
// 0 = White (default)
// 1 = Blue
// 2 = Purple
// 3 = Red
// 4 = Green
// 5 = Slow flowing rainbow
// 6 = Off
uint8_t state = 0;

// Button debouncing
int lastReading = HIGH;
int buttonState = HIGH; // stable state
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

// Rainbow animation
uint8_t rainbowStart = 0;
unsigned long lastRainbowMs = 0;
const unsigned long rainbowInterval = 80; // ms between steps (slow)

void applyState(uint8_t s) {
    switch(s) {
        case 0: // White
            fill_solid(leds, NUM_LEDS, CRGB::White);
            FastLED.show();
            break;
        case 1: // Blue
            fill_solid(leds, NUM_LEDS, CRGB::Blue);
            FastLED.show();
            break;
        case 2: // Purple
            fill_solid(leds, NUM_LEDS, CRGB::Purple);
            FastLED.show();
            break;
        case 3: // Red
            fill_solid(leds, NUM_LEDS, CRGB::Red);
            FastLED.show();
            break;
        case 4: // Green
            fill_solid(leds, NUM_LEDS, CRGB::Green);
            FastLED.show();
            break;
        case 5: // Rainbow: handled in loop for animation
            // initialize rainbow frame immediately
            fill_rainbow(leds, NUM_LEDS, rainbowStart, 8);
            FastLED.show();
            break;
        case 6: // Off
            fill_solid(leds, NUM_LEDS, CRGB::Black);
            FastLED.show();
            break;
    }
}

void setup() {
    FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    // default state: white
    state = 0;
    applyState(state);
}

void loop() {
    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastReading) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        if (reading != buttonState) {
            buttonState = reading;
            // button pressed (using INPUT_PULLUP => LOW when pressed)
            if (buttonState == LOW) {
                state = (state + 1) % 7; // advance and wrap
                applyState(state);
            }
        }
    }

    lastReading = reading;

    // If in rainbow state, animate smoothly but still check button
    if (state == 5) {
        unsigned long now = millis();
        if (now - lastRainbowMs >= rainbowInterval) {
            lastRainbowMs = now;
            rainbowStart += 1; // slow drift
            fill_rainbow(leds, NUM_LEDS, rainbowStart, 8);
            FastLED.show();
        }
    }
}