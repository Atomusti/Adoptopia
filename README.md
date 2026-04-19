# Adoptopia 🐾 - Interactive OR Engine Demo

Adoptopia is a technical demonstration of Operations Research directly integrated into a modern Next.js web application, showcasing the immense power of **GAMSPy** natively computing NP-hard combinatorial Assignment & Routing problems behind the scenes of an interactive UI.

## Setup Instructions

### 1. Launch the FastAPI Backend Engine
The Python ecosystem drives the AI solving mechanics.

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*Note: The backend starts on `http://localhost:8000`. Keep this terminal open.*

### 2. Launch the Next.js Frontend UI
The UI layers handle user intervention, animation, and map rendering natively.

```bash
cd ..
npm install
npm run dev
```

### 3. Open the Dashboard
Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

### 4. Cinematic Presentation Demo Mode 🎥
To run the fully automated, timed interactive presentation scenario (used during live pitch decks without requiring manual clicks), simply append `?demo=true` to the URL:
[http://localhost:3000?demo=true](http://localhost:3000?demo=true)

---

## Technical Details
- **Solver Runtime:** React issues a 30s timeout restriction to the `POST /optimize` payload.
- **Failover Safe:** If GAMSPy environments fail or dependencies break in production, the engine automatically catches `ImportError` exceptions and defaults gracefully to an internal `Greedy` fallback logic pipeline.
