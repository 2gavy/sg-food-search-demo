import React from "react";
import ReactDOM from "react-dom/client";
import { CompareShell } from "./components/CompareShell";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CompareShell />
  </React.StrictMode>,
);
