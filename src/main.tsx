import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GameSessionProvider } from "./game/GameSession";
import "./styles.css";
import "./features.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameSessionProvider>
      <App />
    </GameSessionProvider>
  </React.StrictMode>,
);
