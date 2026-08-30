/*
 * SkyGuard AI - Edge Pre-Filter (Reference Implementation)
 * Target: ESP32 / Arduino
 * 
 * This snippet demonstrates how the rule-based anomaly pre-filter 
 * runs on constrained edge hardware before publishing via MQTT.
 */

#define WINDOW_SIZE 5

// Ring buffers for historical data
float temp_history[WINDOW_SIZE];
float press_history[WINDOW_SIZE];
float hum_history[WINDOW_SIZE];
int history_idx = 0;
bool history_filled = false;

// Sensor Limits
const float TEMP_MIN = -40.0; const float TEMP_MAX = 60.0; const float TEMP_MAX_ROC = 5.0;
const float PRESS_MIN = 800.0; const float PRESS_MAX = 1200.0; const float PRESS_MAX_ROC = 10.0;
const float HUM_MIN = 0.0; const float HUM_MAX = 100.0; const float HUM_MAX_ROC = 20.0;

bool check_frozen(float* history) {
    if (!history_filled) return false;
    
    float sum = 0;
    for (int i = 0; i < WINDOW_SIZE; i++) sum += history[i];
    float mean = sum / WINDOW_SIZE;
    
    float variance = 0;
    for (int i = 0; i < WINDOW_SIZE; i++) {
        variance += (history[i] - mean) * (history[i] - mean);
    }
    variance /= WINDOW_SIZE;
    
    return variance < 0.0001;
}

bool process_reading(float temp, float press, float hum) {
    bool suspect = false;

    // 1. Range Checks
    if (temp < TEMP_MIN || temp > TEMP_MAX) suspect = true;
    if (press < PRESS_MIN || press > PRESS_MAX) suspect = true;
    if (hum < HUM_MIN || hum > HUM_MAX) suspect = true;

    // 2. Rate of Change Checks
    int last_idx = (history_idx - 1 + WINDOW_SIZE) % WINDOW_SIZE;
    if (history_filled || history_idx > 0) {
        if (abs(temp - temp_history[last_idx]) > TEMP_MAX_ROC) suspect = true;
        if (abs(press - press_history[last_idx]) > PRESS_MAX_ROC) suspect = true;
        if (abs(hum - hum_history[last_idx]) > HUM_MAX_ROC) suspect = true;
    }

    // Update History
    temp_history[history_idx] = temp;
    press_history[history_idx] = press;
    hum_history[history_idx] = hum;
    
    history_idx++;
    if (history_idx >= WINDOW_SIZE) {
        history_idx = 0;
        history_filled = true;
    }

    // 3. Frozen Value Check
    if (check_frozen(temp_history) || check_frozen(press_history) || check_frozen(hum_history)) {
        suspect = true;
    }

    return suspect;
}

void loop() {
    // Example main loop
    float t = readTemperature();
    float p = readPressure();
    float h = readHumidity();
    
    bool is_suspect = process_reading(t, p, h);
    
    // Tag and publish (do not drop data silently)
    String payload = "{\"temperature\":" + String(t) + 
                     ",\"pressure\":" + String(p) + 
                     ",\"humidity\":" + String(h) + 
                     ",\"edge_flag\":\"" + (is_suspect ? "suspect" : "clean") + "\"}";
                     
    mqttClient.publish("awsnet/AWS_001/reading", payload.c_str());
    
    delay(5000);
}

// Dummy functions for compilation if needed
float readTemperature() { return 25.0; }
float readPressure() { return 1013.25; }
float readHumidity() { return 50.0; }
class DummyMQTT { public: void publish(const char* t, const char* p){} } mqttClient;
