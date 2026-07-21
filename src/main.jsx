import "./sentry.js"; // must load first so Sentry can catch early errors
import React from "react";
import ReactDOM from "react-dom/client";
import FrontlineCoach from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      {({ session, signOut }) => <FrontlineCoach session={session} signOut={signOut} />}
    </AuthGate>
  </React.StrictMode>
);
